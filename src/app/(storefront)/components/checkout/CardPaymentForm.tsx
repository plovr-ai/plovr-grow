"use client";

import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

export interface CardPaymentFormRef {
  confirmPayment: () => Promise<{
    success: boolean;
    error?: string;
  }>;
}

interface CardPaymentFormProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  defaultCountry?: string;
}

export const CardPaymentForm = forwardRef<
  CardPaymentFormRef,
  CardPaymentFormProps
>(function CardPaymentForm({ onReady, onError, disabled, defaultCountry }, ref) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  // Notify parent when Stripe is ready
  useEffect(() => {
    if (stripe && elements && isReady) {
      onReady?.();
    }
  }, [stripe, elements, isReady, onReady]);

  // Expose confirmPayment method to parent
  useImperativeHandle(ref, () => ({
    confirmPayment: async () => {
      if (!stripe || !elements) {
        return {
          success: false,
          error: "Payment system not ready",
        };
      }

      try {
        // First submit the elements to validate and collect payment details
        const { error: submitError } = await elements.submit();
        if (submitError) {
          const errorMessage = submitError.message || "Please check your card details";
          onError?.(errorMessage);
          return {
            success: false,
            error: errorMessage,
          };
        }

        // Then confirm the payment
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.href,
          },
          redirect: "if_required",
        });

        if (error) {
          const errorMessage = error.message || "Payment failed";
          onError?.(errorMessage);
          return {
            success: false,
            error: errorMessage,
          };
        }

        if (paymentIntent?.status === "succeeded") {
          return { success: true };
        }

        // Handle other statuses
        if (paymentIntent?.status === "processing") {
          return { success: true }; // Will be confirmed via webhook
        }

        return {
          success: false,
          error: `Payment status: ${paymentIntent?.status}`,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Payment failed";
        onError?.(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Card Details</h2>

      <PaymentElement
        options={{
          layout: "tabs",
          wallets: {
            applePay: "auto",
            googlePay: "auto",
          },
          defaultValues: {
            billingDetails: {
              address: {
                country: defaultCountry || "US",
              },
            },
          },
        }}
        onReady={() => setIsReady(true)}
      />

      {/* Security notice */}
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <LockIcon className="w-4 h-4" />
        <span>Your payment info is encrypted and secure</span>
      </div>
    </div>
  );
});

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}
