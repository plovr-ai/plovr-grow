"use client";

import { useState, useCallback } from "react";
import { usePhoneInput } from "@/hooks";
import { useCompanySlug, useLoyalty, type LoyaltyMember } from "@/contexts";
import { OtpModal } from "../checkout/OtpModal";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SignInModal({ isOpen, onClose, onSuccess }: SignInModalProps) {
  const companySlug = useCompanySlug();
  const { login } = useLoyalty();
  const { format: formatPhone } = usePhoneInput();

  // UI state
  const [phone, setPhone] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);

  // Loading state
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Error state
  const [sendError, setSendError] = useState("");
  const [verifyError, setVerifyError] = useState("");

  // Points per dollar for login context
  const [localPointsPerDollar, setLocalPointsPerDollar] = useState(1);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setSendError("");
  };

  const formatPhoneForApi = (formattedPhone: string): string => {
    const digits = formattedPhone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
    return `+${digits}`;
  };

  const handleSendOtp = useCallback(async () => {
    if (!companySlug || !phone) return;

    setIsSendingOtp(true);
    setSendError("");

    try {
      const response = await fetch("/api/storefront/loyalty/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formatPhoneForApi(phone),
          companySlug,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setSendError(data.error || "Failed to send verification code");
        return;
      }

      // Get points per dollar from status API
      try {
        const statusRes = await fetch(
          `/api/storefront/loyalty/status?phone=${encodeURIComponent(formatPhoneForApi(phone))}&companySlug=${encodeURIComponent(companySlug)}`
        );
        const statusData = await statusRes.json();
        if (statusData.success && statusData.data?.config?.pointsPerDollar) {
          setLocalPointsPerDollar(statusData.data.config.pointsPerDollar);
        }
      } catch {
        // Ignore status fetch errors, use default
      }

      setShowOtpModal(true);
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  }, [companySlug, phone]);

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      if (!companySlug) return;

      setIsVerifying(true);
      setVerifyError("");

      try {
        const response = await fetch("/api/storefront/loyalty/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: formatPhoneForApi(phone),
            code,
            companySlug,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          setVerifyError(data.error || "Verification failed");
          return;
        }

        // Login successful - update context state
        const memberData: LoyaltyMember = {
          id: data.data.member.id,
          phone: data.data.member.phone,
          name: data.data.member.name,
          points: data.data.member.points,
        };

        login(memberData, localPointsPerDollar);
        setShowOtpModal(false);
        handleClose();
        onSuccess?.();
      } catch {
        setVerifyError("Network error. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    },
    [companySlug, phone, localPointsPerDollar, login, onSuccess]
  );

  const handleResendOtp = useCallback(async () => {
    if (!companySlug || !phone) return;

    const response = await fetch("/api/storefront/loyalty/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: formatPhoneForApi(phone),
        companySlug,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }
  }, [companySlug, phone]);

  const handleClose = () => {
    setPhone("");
    setSendError("");
    setVerifyError("");
    setShowOtpModal(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

        {/* Modal Content */}
        <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-xl shadow-xl p-6">
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            aria-label="Close"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-theme-primary-light rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-theme-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Sign In to Earn Rewards
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter your phone number to sign in or create an account
            </p>
          </div>

          {/* Phone Input */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                disabled={isSendingOtp}
              />
              {sendError && (
                <p className="text-sm text-red-500 mt-1">{sendError}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSendOtp}
              disabled={phone.replace(/\D/g, "").length < 10 || isSendingOtp}
              className="w-full py-3 bg-theme-primary text-theme-primary-foreground font-medium rounded-lg hover:bg-theme-primary-hover transition-colors disabled:bg-gray-200 disabled:text-gray-400"
            >
              {isSendingOtp ? "Sending..." : "Send Verification Code"}
            </button>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      <OtpModal
        isOpen={showOtpModal}
        phone={phone}
        onClose={() => {
          setShowOtpModal(false);
          setVerifyError("");
        }}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        isVerifying={isVerifying}
        error={verifyError}
      />
    </>
  );
}
