"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatPrice, usePhoneInput } from "@/hooks";
import type { GiftcardConfig } from "@/types/company";

interface GiftcardPageClientProps {
  companySlug: string;
  companyName: string;
  config: GiftcardConfig;
}

interface FormState {
  selectedAmount: number | null;
  recipientName: string;
  recipientEmail: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  message: string;
}

interface FormErrors {
  selectedAmount?: string;
  recipientEmail?: string;
  buyerName?: string;
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
    recipientName: "",
    recipientEmail: "",
    buyerName: "",
    buyerPhone: "",
    buyerEmail: "",
    message: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Amount validation
    if (effectiveAmount === null) {
      newErrors.selectedAmount = "Please select an amount";
    }

    // Buyer info validation
    if (!formState.buyerName.trim()) {
      newErrors.buyerName = "Name is required";
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

    // Optional recipient email validation
    if (formState.recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.recipientEmail)) {
      newErrors.recipientEmail = "Invalid email format";
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

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/storefront/${companySlug}/giftcard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: effectiveAmount,
          recipientName: formState.recipientName || undefined,
          recipientEmail: formState.recipientEmail || undefined,
          buyerName: formState.buyerName,
          buyerPhone: formState.buyerPhone,
          buyerEmail: formState.buyerEmail,
          message: formState.message || undefined,
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Gift Cards</h1>
        <p className="text-gray-600">Give the gift of {companyName}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Denomination Selection */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Select Amount</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {config.denominations.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleDenominationSelect(amount)}
                className={`p-6 rounded-lg border-2 transition-colors ${
                  formState.selectedAmount === amount
                    ? "border-theme-primary bg-theme-primary-light"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-2xl font-bold">{formatPrice(amount)}</div>
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

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formState.buyerName}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, buyerName: e.target.value }))
                }
                placeholder="Your name"
                className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                  errors.buyerName
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-theme-primary"
                } focus:outline-none focus:ring-2 focus:border-transparent transition-colors`}
              />
              {errors.buyerName && (
                <p className="text-sm text-red-600 mt-1">{errors.buyerName}</p>
              )}
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

        {/* Recipient Information (Optional) */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-2">Recipient Information</h2>
          <p className="text-sm text-gray-600 mb-4">Optional - for future email delivery</p>

          <div className="space-y-4">
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
                Recipient Email
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
                placeholder="Optional message to recipient"
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
        </div>

        {/* Order Summary */}
        {effectiveAmount !== null && !isNaN(effectiveAmount) && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            <div className="flex justify-between text-lg">
              <span>Total</span>
              <span className="font-bold">{formatPrice(effectiveAmount)}</span>
            </div>
          </div>
        )}

        {/* Submit Error */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {submitError}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || effectiveAmount === null}
          className="w-full bg-theme-primary text-theme-primary-foreground py-3 rounded-lg font-semibold hover:bg-theme-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Processing..." : "Purchase Gift Card"}
        </button>
      </form>
    </div>
  );
}
