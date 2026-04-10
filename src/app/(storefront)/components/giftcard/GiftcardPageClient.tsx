"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormatPrice, usePhoneInput } from "@/hooks";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import {
  StripeProvider,
  CardPaymentForm,
  CheckoutPageLayout,
  SubmitButton,
  ErrorAlert,
  PaymentLoadingState,
  type CardPaymentFormRef,
} from "@storefront/components/checkout";
import { usePaymentIntent } from "@storefront/hooks";
import type { GiftcardConfig } from "@/types/tenant";

interface GiftcardPageClientProps {
  companySlug: string;
  companyName: string;
  config: GiftcardConfig;
}

interface FormState {
  selectedAmount: number | null;
  isGiftForSelf: boolean;
  recipientName: string;
  recipientEmail: string;
  buyerFirstName: string;
  buyerLastName: string;
  buyerPhone: string;
  buyerEmail: string;
  message: string;
}

interface FormErrors {
  selectedAmount?: string;
  recipientEmail?: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  message?: string;
}

export function GiftcardPageClient({
  companySlug,
  companyName,
  config,
}: GiftcardPageClientProps) {
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const { format: formatPhoneInput } = usePhoneInput();

  // Default to second denomination (index 1)
  const defaultAmount = config.denominations[1] ?? config.denominations[0] ?? null;

  const [formState, setFormState] = useState<FormState>({
    selectedAmount: defaultAmount,
    isGiftForSelf: true,
    recipientName: "",
    recipientEmail: "",
    buyerFirstName: "",
    buyerLastName: "",
    buyerPhone: "",
    buyerEmail: "",
    message: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const cardPaymentFormRef = useRef<CardPaymentFormRef>(null);

  // Get loyalty member for auto-fill
  const { member, isLoading: isLoyaltyLoading } = useLoyalty();

  // Use payment intent hook
  const {
    clientSecret,
    paymentIntentId,
    isCreatingPaymentIntent,
    error: paymentIntentError,
  } = usePaymentIntent({
    amount: formState.selectedAmount,
    apiPath: `/api/storefront/${companySlug}/payment-intent`,
    loyaltyMemberId: member?.id,
  });

  // Sync payment intent error with submit error
  useEffect(() => {
    if (paymentIntentError) {
      setSubmitError(paymentIntentError);
    }
  }, [paymentIntentError]);

  // Auto-fill form when member is logged in
  useEffect(() => {
    if (member && !isLoyaltyLoading) {
      setFormState((prev) => ({
        ...prev,
        buyerFirstName: member.firstName || prev.buyerFirstName,
        buyerLastName: member.lastName || prev.buyerLastName,
        buyerPhone: member.phone ? formatPhoneInput(member.phone) : prev.buyerPhone,
        buyerEmail: member.email || prev.buyerEmail,
      }));
    }
  }, [member?.id, isLoyaltyLoading, formatPhoneInput]);

  // Get effective amount (only from selected denomination)
  const effectiveAmount = formState.selectedAmount;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setFormState((prev) => ({ ...prev, buyerPhone: formatted }));
  };

  const handleDenominationSelect = (amount: number) => {
    setFormState((prev) => ({
      ...prev,
      selectedAmount: amount,
    }));
    setErrors((prev) => ({ ...prev, selectedAmount: undefined }));
  };

  const handleRecipientTypeChange = (isForSelf: boolean) => {
    setFormState((prev) => ({
      ...prev,
      isGiftForSelf: isForSelf,
      // Clear recipient fields when switching back to "For myself"
      ...(isForSelf && {
        recipientName: "",
        recipientEmail: "",
        message: "",
      }),
    }));
    // Clear recipient-related errors
    if (isForSelf) {
      setErrors((prev) => ({
        ...prev,
        recipientEmail: undefined,
        message: undefined,
      }));
    }
  };

  // Reset payment ready state when client secret changes
  useEffect(() => {
    if (!clientSecret) {
      setIsPaymentReady(false);
    }
  }, [clientSecret]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Amount validation
    if (effectiveAmount === null) {
      newErrors.selectedAmount = "Please select an amount";
    }

    // Buyer info validation
    if (!formState.buyerFirstName.trim()) {
      newErrors.buyerFirstName = "First name is required";
    }

    if (!formState.buyerLastName.trim()) {
      newErrors.buyerLastName = "Last name is required";
    }

    if (!formState.buyerPhone) {
      newErrors.buyerPhone = "Phone is required";
    } else if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(formState.buyerPhone)) {
      newErrors.buyerPhone = "Phone must be in format (xxx) xxx-xxxx";
    }

    if (!formState.buyerEmail) {
      newErrors.buyerEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.buyerEmail)) {
      newErrors.buyerEmail = "Invalid email format";
    }

    // Recipient email validation (required when sending to someone else)
    if (!formState.isGiftForSelf) {
      if (!formState.recipientEmail) {
        newErrors.recipientEmail = "Recipient email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.recipientEmail)) {
        newErrors.recipientEmail = "Invalid email format";
      }
    }

    // Message length validation
    if (formState.message && formState.message.length > 200) {
      newErrors.message = "Message too long (max 200 characters)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Ensure payment is ready
    if (!isPaymentReady || !cardPaymentFormRef.current) {
      setSubmitError("Payment form not ready");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Confirm Stripe payment
      const paymentResult = await cardPaymentFormRef.current.confirmPayment();
      if (!paymentResult.success) {
        setSubmitError(paymentResult.error || "Payment failed");
        setIsSubmitting(false);
        return;
      }

      // Step 2: Create giftcard order with payment intent ID
      const response = await fetch(`/api/storefront/${companySlug}/giftcard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: effectiveAmount,
          recipientName: formState.recipientName || undefined,
          recipientEmail: formState.recipientEmail || undefined,
          buyerFirstName: formState.buyerFirstName,
          buyerLastName: formState.buyerLastName,
          buyerPhone: formState.buyerPhone,
          buyerEmail: formState.buyerEmail,
          message: formState.message || undefined,
          stripePaymentIntentId: paymentIntentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      // Redirect to success page
      router.push(`/${companySlug}/giftcard/success?orderId=${data.data.orderId}`);
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
        {/* Left Column - Form Sections */}
        <div className="lg:col-span-2 space-y-6 pb-40 lg:pb-0">
          {/* Denomination Selection */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Select Amount</h2>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {config.denominations.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleDenominationSelect(amount)}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  formState.selectedAmount === amount
                    ? "border-theme-primary bg-theme-primary-light"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-lg font-bold">{formatPrice(amount)}</div>
              </button>
            ))}
          </div>

          {errors.selectedAmount && (
            <p className="text-sm text-red-600 mt-4">{errors.selectedAmount}</p>
          )}
        </div>

        {/* Buyer Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Your Information</h2>

          {/* Loyalty promotion for non-members */}
          {!member && !isLoyaltyLoading && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <svg
                className="w-5 h-5 text-amber-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
              <span className="text-sm text-gray-700">
                Join our rewards program! Earn{" "}
                <span className="font-semibold text-amber-700">2x points</span>{" "}
                when you spend with gift cards.
              </span>
            </div>
          )}

          {member && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-green-700">
                Logged in as rewards member
              </span>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formState.buyerFirstName}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, buyerFirstName: e.target.value }))
                  }
                  placeholder="First name"
                  className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                    errors.buyerFirstName
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-theme-primary"
                  } focus:outline-none focus:ring-2 focus:border-transparent transition-colors`}
                />
                {errors.buyerFirstName && (
                  <p className="text-sm text-red-600 mt-1">{errors.buyerFirstName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formState.buyerLastName}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, buyerLastName: e.target.value }))
                  }
                  placeholder="Last name"
                  className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                    errors.buyerLastName
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-theme-primary"
                  } focus:outline-none focus:ring-2 focus:border-transparent transition-colors`}
                />
                {errors.buyerLastName && (
                  <p className="text-sm text-red-600 mt-1">{errors.buyerLastName}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                value={formState.buyerPhone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                  errors.buyerPhone
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-theme-primary"
                } focus:outline-none focus:ring-2 focus:border-transparent transition-colors`}
              />
              {errors.buyerPhone && (
                <p className="text-sm text-red-600 mt-1">{errors.buyerPhone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={formState.buyerEmail}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, buyerEmail: e.target.value }))
                }
                placeholder="your@email.com"
                className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                  errors.buyerEmail
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-theme-primary"
                } focus:outline-none focus:ring-2 focus:border-transparent transition-colors`}
              />
              {errors.buyerEmail && (
                <p className="text-sm text-red-600 mt-1">{errors.buyerEmail}</p>
              )}
            </div>
          </div>
        </div>

        {/* Recipient Selection */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">This gift card is for</h2>

          {/* Radio Toggle */}
          <div className="flex items-center gap-6 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                checked={formState.isGiftForSelf}
                onChange={() => handleRecipientTypeChange(true)}
                className="w-4 h-4 text-theme-primary focus:ring-theme-primary"
              />
              <span className="text-gray-700">Myself</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                checked={!formState.isGiftForSelf}
                onChange={() => handleRecipientTypeChange(false)}
                className="w-4 h-4 text-theme-primary focus:ring-theme-primary"
              />
              <span className="text-gray-700">Someone else</span>
            </label>
          </div>

          {/* Recipient Fields (shown only when "Someone else" is selected) */}
          {!formState.isGiftForSelf && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={formState.recipientName}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, recipientName: e.target.value }))
                  }
                  placeholder="Recipient's name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={formState.recipientEmail}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, recipientEmail: e.target.value }))
                  }
                  placeholder="recipient@email.com"
                  className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                    errors.recipientEmail
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-theme-primary"
                  } focus:outline-none focus:ring-2 focus:border-transparent transition-colors`}
                />
                {errors.recipientEmail && (
                  <p className="text-sm text-red-600 mt-1">{errors.recipientEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gift Message
                </label>
                <textarea
                  value={formState.message}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, message: e.target.value }))
                  }
                  placeholder="Add a personal message (optional)"
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-theme-primary ${
                    errors.message ? "border-red-500" : "border-gray-300"
                  }`}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formState.message.length}/200 characters
                </p>
                {errors.message && (
                  <p className="text-sm text-red-600 mt-1">{errors.message}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Payment Section */}
        {effectiveAmount !== null && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Payment</h2>

            {isCreatingPaymentIntent && <PaymentLoadingState />}

            {clientSecret && (
              <StripeProvider clientSecret={clientSecret}>
                <CardPaymentForm
                  ref={cardPaymentFormRef}
                  onReady={() => setIsPaymentReady(true)}
                  onError={(error) => setSubmitError(error)}
                  disabled={isSubmitting}
                />
              </StripeProvider>
            )}

            {!clientSecret && !isCreatingPaymentIntent && (
              <div className="text-center text-gray-500 py-4">
                Unable to load payment form. Please try again.
              </div>
            )}
          </div>
        )}
        </div>

        {/* Right Column - Desktop Sticky Summary */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              {/* Order Summary */}
              <h2 className="text-lg font-semibold mb-3">Order Summary</h2>
              <div className="flex justify-between text-lg mb-4">
                <span>Total</span>
                <span className="font-bold">
                  {effectiveAmount ? formatPrice(effectiveAmount) : "--"}
                </span>
              </div>

              <ErrorAlert message={submitError} className="mb-4" />

              <SubmitButton
                type="submit"
                isSubmitting={isSubmitting}
                disabled={isSubmitting || effectiveAmount === null || !isPaymentReady}
                amount={effectiveAmount}
                label="Pay"
                submittingLabel="Processing..."
                variant="theme"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Fixed Footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">Total</span>
          <span className="text-lg font-bold">
            {effectiveAmount ? formatPrice(effectiveAmount) : "--"}
          </span>
        </div>

        <ErrorAlert message={submitError} className="mb-3" />

        <SubmitButton
          type="submit"
          isSubmitting={isSubmitting}
          disabled={isSubmitting || effectiveAmount === null || !isPaymentReady}
          amount={effectiveAmount}
          label="Pay"
          submittingLabel="Processing..."
          variant="theme"
        />
      </div>
    </form>
  );
}
