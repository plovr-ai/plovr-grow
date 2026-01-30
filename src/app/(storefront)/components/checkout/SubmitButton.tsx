"use client";

import { useFormatPrice } from "@/hooks";

interface SubmitButtonProps {
  isSubmitting: boolean;
  disabled: boolean;
  amount?: number | null;
  label?: string;
  submittingLabel?: string;
  variant?: "primary" | "theme";
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
}

export function SubmitButton({
  isSubmitting,
  disabled,
  amount,
  label = "Submit",
  submittingLabel = "Processing...",
  variant = "primary",
  type = "button",
  onClick,
  className = "",
}: SubmitButtonProps) {
  const formatPrice = useFormatPrice();

  const variantClasses =
    variant === "primary"
      ? "bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white"
      : "bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-foreground disabled:opacity-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed ${variantClasses} ${className}`}
    >
      {isSubmitting ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
          <span>{submittingLabel}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          {amount !== undefined && amount !== null && (
            <span className="font-bold">{formatPrice(amount)}</span>
          )}
        </>
      )}
    </button>
  );
}
