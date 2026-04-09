"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface OtpModalProps {
  isOpen: boolean;
  phone: string;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  isVerifying: boolean;
  error?: string;
}

export function OtpModal({
  isOpen,
  phone,
  onClose,
  onVerify,
  onResend,
  isVerifying,
  error,
}: OtpModalProps) {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCode(["", "", "", "", "", ""]);
      setCountdown(60);
      setCanResend(false);
      // Focus first input after a short delay
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || countdown <= 0) {
      if (countdown <= 0) setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  const handleInputChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      const digit = value.replace(/\D/g, "").slice(-1);

      setCode((prev) => {
        const newCode = [...prev];
        newCode[index] = digit;

        // Auto-submit when all digits entered
        if (digit && index === 5) {
          const fullCode = newCode.join("");
          if (fullCode.length === 6) {
            onVerify(fullCode);
          }
        }

        return newCode;
      });

      // Auto-focus next input
      if (digit && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [onVerify]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    []
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pastedData) {
        const newCode = ["", "", "", "", "", ""];
        for (let i = 0; i < pastedData.length; i++) {
          newCode[i] = pastedData[i];
        }
        setCode(newCode);

        // Focus the appropriate input
        const nextIndex = Math.min(pastedData.length, 5);
        inputRefs.current[nextIndex]?.focus();

        // Auto-submit if complete
        if (pastedData.length === 6) {
          onVerify(pastedData);
        }
      }
    },
    [onVerify]
  );

  const handleResend = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    try {
      await onResend();
      setCountdown(60);
      setCanResend(false);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = () => {
    const fullCode = code.join("");
    if (fullCode.length === 6) {
      onVerify(fullCode);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-xl shadow-xl p-6">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Enter Verification Code</h2>
          <p className="text-sm text-gray-500 mt-1">
            Code sent to {phone}
          </p>
        </div>

        {/* OTP Input */}
        <div className="flex justify-center gap-2 mb-4">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isVerifying}
              className={`w-11 h-12 text-center text-xl font-semibold border-2 rounded-lg focus:outline-none focus:border-theme-primary transition-colors ${
                error ? "border-red-300" : "border-gray-200"
              } disabled:bg-gray-50 disabled:text-gray-400`}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-500 text-center mb-4">{error}</p>
        )}

        {/* Resend */}
        <div className="text-center mb-6">
          {canResend ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-sm text-theme-primary hover:text-theme-primary-hover font-medium disabled:text-gray-400"
            >
              {isResending ? "Sending..." : "Resend code"}
            </button>
          ) : (
            <span className="text-sm text-gray-500">
              Resend code in {countdown}s
            </span>
          )}
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={code.join("").length !== 6 || isVerifying}
          className="w-full py-3 bg-theme-primary text-theme-primary-foreground font-medium rounded-lg hover:bg-theme-primary-hover transition-colors disabled:bg-gray-200 disabled:text-gray-400"
        >
          {isVerifying ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  );
}
