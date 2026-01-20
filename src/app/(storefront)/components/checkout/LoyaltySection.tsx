"use client";

import { useState, useCallback } from "react";
import { usePhoneInput } from "@/hooks";
import { useCompanySlug, useLoyalty, type LoyaltyMember } from "@/contexts";
import { OtpModal } from "./OtpModal";

interface LoyaltySectionProps {
  subtotal: number;
  onMemberLogin?: (member: LoyaltyMember) => void;
  onMemberLogout?: () => void;
}

export function LoyaltySection({
  subtotal,
  onMemberLogin,
  onMemberLogout,
}: LoyaltySectionProps) {
  const companySlug = useCompanySlug();
  const { member, isLoading, pointsPerDollar, login, logout } = useLoyalty();
  const { format: formatPhone } = usePhoneInput();

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [phone, setPhone] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);

  // Loading state
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Error state
  const [sendError, setSendError] = useState("");
  const [verifyError, setVerifyError] = useState("");

  // Local pointsPerDollar for pre-login display (before context has the value)
  const [localPointsPerDollar, setLocalPointsPerDollar] = useState(1);

  // Use context's pointsPerDollar when logged in, local value when not
  const effectivePointsPerDollar = member ? pointsPerDollar : localPointsPerDollar;

  // Calculate estimated points
  const estimatedPoints = Math.floor(subtotal * effectivePointsPerDollar);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setSendError("");
  };

  const formatPhoneForApi = (formattedPhone: string): string => {
    const digits = formattedPhone.replace(/\D/g, "");
    // Add +1 for US numbers if not already present
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

      // Get points per dollar from status API for new/existing members
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
        // Cookie is already set by the API
        const memberData: LoyaltyMember = {
          id: data.data.member.id,
          phone: data.data.member.phone,
          name: data.data.member.name,
          points: data.data.member.points,
        };

        login(memberData, localPointsPerDollar);
        setShowOtpModal(false);
        setIsExpanded(false);
        onMemberLogin?.(memberData);
      } catch {
        setVerifyError("Network error. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    },
    [companySlug, phone, localPointsPerDollar, login, onMemberLogin]
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

  const handleLogout = async () => {
    await logout();
    setPhone("");
    setIsExpanded(false);
    onMemberLogout?.();
  };

  // Don't render if company slug is not available (loyalty not configured)
  if (!companySlug) {
    return null;
  }

  // Show loading state while checking session
  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48"></div>
      </div>
    );
  }

  // Logged in state - show member card
  if (member) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-green-800">Rewards Member</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Current Points</span>
            <span className="font-medium text-gray-900">{member.points} pts</span>
          </div>
          {estimatedPoints > 0 && (
            <div className="flex justify-between text-green-600">
              <span>You&apos;ll earn</span>
              <span className="font-medium">+{estimatedPoints} pts</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not logged in - show login prompt
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
      {!isExpanded ? (
        // Collapsed state - show prompt
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            <span className="text-gray-700">
              Sign in to earn <span className="font-medium text-theme-primary">rewards points</span>
            </span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        // Expanded state - show phone input
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              <span className="font-medium text-gray-700">Earn Rewards</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-3">
            Enter your phone number to sign in or create an account
          </p>

          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              disabled={isSendingOtp}
            />
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={phone.replace(/\D/g, "").length < 10 || isSendingOtp}
              className="px-4 py-2 bg-theme-primary text-theme-primary-foreground font-medium rounded-lg hover:bg-theme-primary-hover transition-colors disabled:bg-gray-200 disabled:text-gray-400 whitespace-nowrap"
            >
              {isSendingOtp ? "Sending..." : "Send Code"}
            </button>
          </div>

          {sendError && (
            <p className="text-sm text-red-500 mt-2">{sendError}</p>
          )}

          {estimatedPoints > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              You&apos;ll earn <span className="font-medium text-theme-primary">+{estimatedPoints} pts</span> on this order
            </p>
          )}
        </div>
      )}

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
    </div>
  );
}
