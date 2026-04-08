"use client";

import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useMemo } from "react";
import type { ReactNode } from "react";

interface StripeProviderProps {
  clientSecret: string;
  stripeAccountId?: string;
  defaultCountry?: string;
  children: ReactNode;
}

export function StripeProvider({ clientSecret, stripeAccountId, defaultCountry, children }: StripeProviderProps) {
  // Load Stripe dynamically based on stripeAccountId for Connect support
  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return null;
    return loadStripe(key, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined);
  }, [stripeAccountId]);

  // Show warning if Stripe is not configured
  if (!stripePromise) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              Payment Not Available
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
              Online payment is not configured. Please select "Pay at Pickup/Delivery" or contact the restaurant.
            </p>
          </div>
        </div>
      </div>
    );
  }
  const options = {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#dc2626", // Match theme-primary (red-600)
        colorBackground: "#ffffff",
        colorText: "#1f2937",
        colorDanger: "#dc2626",
        fontFamily: "system-ui, sans-serif",
        borderRadius: "8px",
      },
      rules: {
        ".Input": {
          border: "1px solid #d1d5db",
          boxShadow: "none",
        },
        ".Input:focus": {
          border: "1px solid #dc2626",
          boxShadow: "0 0 0 1px #dc2626",
        },
        ".Label": {
          fontWeight: "500",
          color: "#374151",
        },
      },
    },
    defaultValues: {
      billingDetails: {
        address: {
          country: defaultCountry || "US",
        },
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
