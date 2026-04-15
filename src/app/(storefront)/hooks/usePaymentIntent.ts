"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { getApiErrorMessage } from "@/lib/api";

interface UsePaymentIntentOptions {
  amount: number | null;
  apiPath: string;
  loyaltyMemberId?: string | null;
  autoCreate?: boolean;
}

interface UsePaymentIntentReturn {
  clientSecret: string | null;
  paymentIntentId: string | null;
  stripeAccountId: string | null;
  isCreatingPaymentIntent: boolean;
  error: string | null;
  reset: () => void;
}

export function usePaymentIntent({
  amount,
  apiPath,
  loyaltyMemberId,
  autoCreate = true,
}: UsePaymentIntentOptions): UsePaymentIntentReturn {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [isCreatingPaymentIntent, setIsCreatingPaymentIntent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last amount we created a payment intent for
  const lastAmountRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setStripeAccountId(null);
    setError(null);
    lastAmountRef.current = null;
  }, []);

  const createPaymentIntent = useCallback(async () => {
    if (
      amount === null ||
      amount <= 0 ||
      isCreatingPaymentIntent ||
      clientSecret
    ) {
      return;
    }

    setIsCreatingPaymentIntent(true);
    setError(null);

    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "USD",
          loyaltyMemberId: loyaltyMemberId || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setClientSecret(data.data.clientSecret);
        setPaymentIntentId(data.data.paymentIntentId);
        setStripeAccountId(data.data.stripeAccountId ?? null);
        lastAmountRef.current = amount;
      } else {
        setError(getApiErrorMessage(data.error, "Failed to initialize payment"));
      }
    } catch (err) {
      console.error("Payment intent creation failed:", err);
      setError("Failed to initialize payment");
    } finally {
      setIsCreatingPaymentIntent(false);
    }
  }, [amount, apiPath, loyaltyMemberId, isCreatingPaymentIntent, clientSecret]);

  // Auto-create when amount is set and autoCreate is enabled
  useEffect(() => {
    if (
      autoCreate &&
      amount !== null &&
      amount > 0 &&
      !clientSecret &&
      !isCreatingPaymentIntent
    ) {
      createPaymentIntent();
    }
  }, [
    autoCreate,
    amount,
    clientSecret,
    isCreatingPaymentIntent,
    createPaymentIntent,
  ]);

  // Reset when amount changes
  useEffect(() => {
    if (
      lastAmountRef.current !== null &&
      amount !== lastAmountRef.current &&
      clientSecret
    ) {
      reset();
    }
  }, [amount, clientSecret, reset]);

  return {
    clientSecret,
    paymentIntentId,
    stripeAccountId,
    isCreatingPaymentIntent,
    error,
    reset,
  };
}
