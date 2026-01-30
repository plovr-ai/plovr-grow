"use client";

interface ErrorAlertProps {
  message: string | null;
  className?: string;
}

export function ErrorAlert({ message, className = "" }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div
      className={`p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}
    >
      <p className="text-sm text-red-600 text-center">{message}</p>
    </div>
  );
}
