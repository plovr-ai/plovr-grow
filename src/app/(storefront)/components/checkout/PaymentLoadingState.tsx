"use client";

interface PaymentLoadingStateProps {
  message?: string;
  className?: string;
}

export function PaymentLoadingState({
  message = "Loading payment form...",
  className = "",
}: PaymentLoadingStateProps) {
  return (
    <div className={`flex items-center justify-center gap-2 py-8 ${className}`}>
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500" />
      <span className="text-sm text-gray-500">{message}</span>
    </div>
  );
}
