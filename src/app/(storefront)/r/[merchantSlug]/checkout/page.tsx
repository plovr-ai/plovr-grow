"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCartStore, useCartHydration } from "@/stores";
import { useFormatPrice, usePricing } from "@/hooks";
import {
  OrderTypeSelector,
  ContactInfoForm,
  DeliveryAddressForm,
  TipSelector,
  OrderSummary,
  PriceSummary,
} from "@storefront/components/checkout";
import {
  checkoutFormSchema,
  deliveryAddressSchema,
  type OrderType,
} from "@storefront/lib/validations/checkout";
import type { TipInput } from "@/lib/pricing";

interface FormState {
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: {
    street: string;
    apt: string;
    city: string;
    state: string;
    zipCode: string;
    instructions: string;
  };
  tip: TipInput | null;
  notes: string;
}

interface FormErrors {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: {
    street?: string;
    apt?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    instructions?: string;
  };
  notes?: string;
}

const initialFormState: FormState = {
  orderType: "pickup",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  deliveryAddress: {
    street: "",
    apt: "",
    city: "",
    state: "",
    zipCode: "",
    instructions: "",
  },
  tip: null,
  notes: "",
};

export default function CheckoutPage() {
  const params = useParams<{ merchantSlug: string }>();
  const router = useRouter();
  const merchantSlug = params.merchantSlug;

  const hydrated = useCartHydration();
  const formatPrice = useFormatPrice();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Calculate totals using unified pricing module
  const pricing = usePricing(items, formState.tip);
  const calculations = useMemo(() => {
    const deliveryFee = formState.orderType === "delivery" ? 3.99 : 0;
    const totalAmount = Math.round((pricing.totalAmount + deliveryFee) * 100) / 100;

    return {
      subtotal: pricing.subtotal,
      taxAmount: pricing.taxAmount,
      deliveryFee,
      tipAmount: pricing.tipAmount,
      totalAmount,
    };
  }, [pricing, formState.orderType]);

  // Handle form field changes
  const handleContactChange = (
    field: "customerName" | "customerPhone" | "customerEmail",
    value: string
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAddressChange = (
    field: keyof FormState["deliveryAddress"],
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      deliveryAddress: { ...prev.deliveryAddress, [field]: value },
    }));
    setErrors((prev) => ({
      ...prev,
      deliveryAddress: prev.deliveryAddress
        ? { ...prev.deliveryAddress, [field]: undefined }
        : undefined,
    }));
  };

  const handleOrderTypeChange = (type: OrderType) => {
    setFormState((prev) => ({ ...prev, orderType: type }));
    // Clear delivery address errors when switching away from delivery
    if (type !== "delivery") {
      setErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
    }
  };

  const handleTipChange = (tip: TipInput | null) => {
    setFormState((prev) => ({ ...prev, tip }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormState((prev) => ({ ...prev, notes: e.target.value }));
  };

  // Validate and submit
  const handleSubmit = async () => {
    setSubmitError(null);

    // Prepare data for validation
    const formData = {
      orderType: formState.orderType,
      customerName: formState.customerName,
      customerPhone: formState.customerPhone,
      customerEmail: formState.customerEmail || undefined,
      tipAmount: pricing.tipAmount, // Send calculated tip amount
      notes: formState.notes || undefined,
      deliveryAddress:
        formState.orderType === "delivery"
          ? {
              street: formState.deliveryAddress.street,
              apt: formState.deliveryAddress.apt || undefined,
              city: formState.deliveryAddress.city,
              state: formState.deliveryAddress.state as typeof formState.deliveryAddress.state,
              zipCode: formState.deliveryAddress.zipCode,
              instructions:
                formState.deliveryAddress.instructions || undefined,
            }
          : undefined,
    };

    // Validate form
    const result = checkoutFormSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      const flatErrors = result.error.flatten().fieldErrors;

      if (flatErrors.customerName) {
        fieldErrors.customerName = flatErrors.customerName[0];
      }
      if (flatErrors.customerPhone) {
        fieldErrors.customerPhone = flatErrors.customerPhone[0];
      }
      if (flatErrors.customerEmail) {
        fieldErrors.customerEmail = flatErrors.customerEmail[0];
      }

      // Handle delivery address errors
      if (formState.orderType === "delivery") {
        const addressResult = deliveryAddressSchema.safeParse(
          formState.deliveryAddress
        );
        if (!addressResult.success) {
          const addressErrors = addressResult.error.flatten().fieldErrors;
          fieldErrors.deliveryAddress = {
            street: addressErrors.street?.[0],
            city: addressErrors.city?.[0],
            state: addressErrors.state?.[0],
            zipCode: addressErrors.zipCode?.[0],
          };
        }
      }

      setErrors(fieldErrors);
      return;
    }

    // Submit order
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/r/${merchantSlug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice,
            selectedModifiers: item.selectedModifiers,
            specialInstructions: item.specialInstructions,
            taxConfigId: item.taxConfigId,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to place order");
      }

      // Success - clear cart and redirect
      clearCart();
      router.push(`/r/${merchantSlug}/menu?orderSuccess=${data.data.orderNumber}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to place order"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  // Redirect to menu if cart is empty
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Link
                href={`/r/${merchantSlug}/cart`}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <h1 className="ml-4 text-lg font-semibold text-gray-900">
                Checkout
              </h1>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-500 mb-6">
            Add some items before checking out
          </p>
          <Link
            href={`/r/${merchantSlug}/menu`}
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Browse Menu
          </Link>
        </main>
      </div>
    );
  }

  const paymentLabel =
    formState.orderType === "delivery" ? "Pay at delivery" : "Pay at pickup";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link
              href={`/r/${merchantSlug}/cart`}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <h1 className="ml-4 text-lg font-semibold text-gray-900">
              Checkout
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-72 space-y-4">
        <OrderTypeSelector
          value={formState.orderType}
          onChange={handleOrderTypeChange}
          disabled={isSubmitting}
        />

        <ContactInfoForm
          values={{
            customerName: formState.customerName,
            customerPhone: formState.customerPhone,
            customerEmail: formState.customerEmail,
          }}
          errors={{
            customerName: errors.customerName,
            customerPhone: errors.customerPhone,
            customerEmail: errors.customerEmail,
          }}
          onChange={handleContactChange}
          disabled={isSubmitting}
        />

        {formState.orderType === "delivery" && (
          <DeliveryAddressForm
            values={formState.deliveryAddress}
            errors={errors.deliveryAddress || {}}
            onChange={handleAddressChange}
            disabled={isSubmitting}
          />
        )}

        <TipSelector
          subtotal={calculations.subtotal}
          value={formState.tip}
          onChange={handleTipChange}
          disabled={isSubmitting}
        />

        {/* Order Notes */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Order Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={formState.notes}
            onChange={handleNotesChange}
            disabled={isSubmitting}
            placeholder="Any special requests for your order?"
            rows={2}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        <OrderSummary items={items} merchantSlug={merchantSlug} />
      </main>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <PriceSummary
            subtotal={calculations.subtotal}
            taxAmount={calculations.taxAmount}
            deliveryFee={calculations.deliveryFee}
            tipAmount={calculations.tipAmount}
            totalAmount={calculations.totalAmount}
          />

          {/* Payment Notice */}
          <div className="flex items-center justify-center gap-2 mt-4 text-gray-500">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <span className="text-sm">{paymentLabel}</span>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{submitError}</p>
            </div>
          )}

          {/* Place Order Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full mt-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>Placing Order...</span>
              </>
            ) : (
              <>
                <span>Place Order</span>
                <span className="font-bold">
                  {formatPrice(calculations.totalAmount)}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
