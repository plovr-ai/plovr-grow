"use client";

import { useState } from "react";
import { getApiErrorMessage } from "@/lib/api";
import { useFormatPrice } from "@/hooks";
import { useMerchantConfig } from "@/contexts";
import { formatGiftCardNumber, normalizeGiftCardNumber } from "@/lib/giftcard";

export interface AppliedGiftCard {
  giftCardId: string;
  cardNumber: string;
  availableBalance: number;
  amountToApply: number;
}

interface GiftCardInputProps {
  totalAmount: number;
  appliedGiftCard: AppliedGiftCard | null;
  onApply: (giftCard: AppliedGiftCard) => void;
  onRemove: () => void;
  disabled?: boolean;
}

type ValidationState = "idle" | "loading" | "success" | "error";

export function GiftCardInput({
  totalAmount,
  appliedGiftCard,
  onApply,
  onRemove,
  disabled = false,
}: GiftCardInputProps) {
  const formatPrice = useFormatPrice();
  const { companySlug } = useMerchantConfig();

  const [inputValue, setInputValue] = useState("");
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Allow only alphanumeric and dashes
    const cleaned = value.replace(/[^A-Z0-9-]/g, "");
    setInputValue(cleaned);
    setValidationState("idle");
    setErrorMessage("");
  };

  const handleApply = async () => {
    if (!inputValue.trim()) {
      setErrorMessage("Please enter a gift card number");
      setValidationState("error");
      return;
    }

    setValidationState("loading");
    setErrorMessage("");

    try {
      // Normalize the input for API call
      const normalized = normalizeGiftCardNumber(inputValue);
      const formatted = formatGiftCardNumber(normalized);

      const response = await fetch(
        `/api/storefront/${companySlug}/giftcard/validate?cardNumber=${encodeURIComponent(formatted)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setValidationState("error");
        setErrorMessage(getApiErrorMessage(data.error, "Invalid gift card"));
        return;
      }

      const { giftCardId, balance, cardNumber } = data.data;

      // Calculate amount to apply (min of balance and total)
      const amountToApply = Math.min(balance, totalAmount);

      setValidationState("success");
      onApply({
        giftCardId,
        cardNumber,
        availableBalance: balance,
        amountToApply,
      });
      setInputValue("");
    } catch {
      setValidationState("error");
      setErrorMessage("Failed to validate gift card");
    }
  };

  const handleRemove = () => {
    onRemove();
    setInputValue("");
    setValidationState("idle");
    setErrorMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  // If a gift card is already applied, show the applied state
  if (appliedGiftCard) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Gift Card</h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-medium text-green-800">
                  {appliedGiftCard.cardNumber}
                </span>
              </div>
              <div className="text-sm text-green-700 mt-1">
                {appliedGiftCard.amountToApply >= appliedGiftCard.availableBalance ? (
                  <span>Using full balance: {formatPrice(appliedGiftCard.amountToApply)}</span>
                ) : (
                  <span>
                    Using {formatPrice(appliedGiftCard.amountToApply)} of{" "}
                    {formatPrice(appliedGiftCard.availableBalance)} balance
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Gift Card</h2>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            disabled={disabled || validationState === "loading"}
            className={`w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase
              focus:outline-none focus:ring-2 focus:ring-theme-primary/50 focus:border-theme-primary
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${validationState === "error" ? "border-red-300" : "border-gray-200"}
            `}
          />
          {errorMessage && (
            <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled || validationState === "loading" || !inputValue.trim()}
          className="px-4 py-2 bg-theme-primary text-theme-primary-foreground rounded-lg text-sm font-medium
            hover:bg-theme-primary-hover disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors flex items-center gap-2"
        >
          {validationState === "loading" ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Checking...</span>
            </>
          ) : (
            "Apply"
          )}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Enter your gift card number to apply it to this order
      </p>
    </div>
  );
}
