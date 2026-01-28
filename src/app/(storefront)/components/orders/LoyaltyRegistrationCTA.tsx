"use client";

import { useState, useEffect } from "react";
import { useLoyalty, useCompanySlug } from "@/contexts";
import { usePhoneInput } from "@/hooks";
import { OtpModal } from "@storefront/components/checkout/OtpModal";
import {
  loyaltyRegistrationSchema,
  type LoyaltyRegistrationData,
} from "@storefront/lib/validations/loyalty";

interface LoyaltyRegistrationCTAProps {
  orderId: string;
  customerPhone: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  subtotal: number;
  /** Gift card orders don't earn points - show different messaging */
  isGiftcardOrder?: boolean;
}

export function LoyaltyRegistrationCTA({
  orderId,
  customerPhone,
  customerFirstName,
  customerLastName,
  customerEmail,
  subtotal,
  isGiftcardOrder = false,
}: LoyaltyRegistrationCTAProps) {
  const companySlug = useCompanySlug();
  const { member, isLoading, pointsPerDollar, login } = useLoyalty();
  const { format: formatPhone } = usePhoneInput();

  // State
  const [pointsAlreadyAwarded, setPointsAlreadyAwarded] = useState<
    boolean | null
  >(null);
  const [checkingPoints, setCheckingPoints] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [phone, setPhone] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sendError, setSendError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // Registration form state (pre-filled from order info)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof LoyaltyRegistrationData, string>>
  >({});

  // Calculate estimated points
  const estimatedPoints = Math.floor(subtotal * pointsPerDollar);

  // Check if points already awarded for this order
  useEffect(() => {
    async function checkPoints() {
      if (!companySlug) {
        setCheckingPoints(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/storefront/loyalty/order-points-status?orderId=${orderId}&companySlug=${companySlug}`
        );
        const data = await response.json();
        setPointsAlreadyAwarded(data.data?.pointsAwarded ?? false);
      } catch {
        setPointsAlreadyAwarded(false);
      } finally {
        setCheckingPoints(false);
      }
    }

    checkPoints();
  }, [orderId, companySlug]);

  // Pre-fill form from order on initial load
  useEffect(() => {
    if (customerPhone && !phone) {
      setPhone(formatPhone(customerPhone));
    }
    if (customerFirstName && !firstName) {
      setFirstName(customerFirstName);
    }
    if (customerLastName && !lastName) {
      setLastName(customerLastName);
    }
    if (customerEmail && !email) {
      setEmail(customerEmail);
    }
  }, [customerPhone, customerFirstName, customerLastName, customerEmail, phone, firstName, lastName, email, formatPhone]);

  // Don't render if:
  // - No company slug (loyalty not configured)
  // - Still loading
  // - Already a member
  // - Points already awarded
  if (!companySlug || isLoading || checkingPoints) {
    return null;
  }

  if (member || pointsAlreadyAwarded || registrationSuccess) {
    // Show success message if just registered
    if (registrationSuccess) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">
              {isGiftcardOrder
                ? "Welcome to rewards! Use your gift cards to earn 2x points on future orders."
                : `Welcome to rewards! You earned ${earnedPoints} points from this order.`}
            </span>
          </div>
        </div>
      );
    }
    return null;
  }

  const formatPhoneForApi = (formattedPhone: string): string => {
    const digits = formattedPhone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return `+${digits}`;
  };

  const validateForm = (): boolean => {
    const result = loyaltyRegistrationSchema.safeParse({
      firstName,
      lastName,
      email,
    });

    if (!result.success) {
      const errors: Partial<Record<keyof LoyaltyRegistrationData, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof LoyaltyRegistrationData;
        errors[field] = issue.message;
      });
      setFormErrors(errors);
      return false;
    }

    setFormErrors({});
    return true;
  };

  const handleSendOtp = async () => {
    if (!companySlug || !phone) return;

    // Validate form first
    if (!validateForm()) return;

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

      setShowOtpModal(true);
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    if (!companySlug) return;

    setIsVerifying(true);
    setVerifyError("");

    try {
      // Verify OTP and register
      const response = await fetch("/api/storefront/loyalty/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formatPhoneForApi(phone),
          code,
          companySlug,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setVerifyError(data.error || "Verification failed");
        return;
      }

      const memberId = data.data.member.id;

      // Award points for this order (skip for gift card orders - they don't earn points)
      if (!isGiftcardOrder) {
        const awardResponse = await fetch(
          "/api/storefront/loyalty/award-order-points",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              memberId,
              companySlug,
            }),
          }
        );

        const awardData = await awardResponse.json();
        setEarnedPoints(awardData.data?.pointsEarned || estimatedPoints);
      }

      // Update context
      login(data.data.member, pointsPerDollar);

      // Show success
      setShowOtpModal(false);
      setRegistrationSuccess(true);
    } catch {
      setVerifyError("Network error. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
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
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-amber-600"
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
            <span className="text-gray-700">
              {isGiftcardOrder ? (
                <>
                  Join rewards and earn{" "}
                  <span className="font-medium text-amber-700">2x points</span>{" "}
                  when using gift cards!
                </>
              ) : (
                <>
                  Join rewards and earn{" "}
                  <span className="font-medium text-amber-700">
                    {estimatedPoints} points
                  </span>{" "}
                  for this order!
                </>
              )}
            </span>
          </div>
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-700">
              Join Rewards Program
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            {isGiftcardOrder
              ? "Complete your profile to create an account."
              : `Complete your profile to create an account and earn ${estimatedPoints} points from this order.`}
          </p>

          {/* Phone */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value));
                setSendError("");
              }}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isSendingOtp}
            />
          </div>

          {/* First Name */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setFormErrors((prev) => ({ ...prev, firstName: undefined }));
              }}
              placeholder="John"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                formErrors.firstName ? "border-red-500" : "border-gray-300"
              }`}
              disabled={isSendingOtp}
            />
            {formErrors.firstName && (
              <p className="text-sm text-red-500 mt-1">{formErrors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setFormErrors((prev) => ({ ...prev, lastName: undefined }));
              }}
              placeholder="Doe"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                formErrors.lastName ? "border-red-500" : "border-gray-300"
              }`}
              disabled={isSendingOtp}
            />
            {formErrors.lastName && (
              <p className="text-sm text-red-500 mt-1">{formErrors.lastName}</p>
            )}
          </div>

          {/* Email */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFormErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="john@example.com"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                formErrors.email ? "border-red-500" : "border-gray-300"
              }`}
              disabled={isSendingOtp}
            />
            {formErrors.email && (
              <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={phone.replace(/\D/g, "").length < 10 || isSendingOtp}
            className="w-full py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {isSendingOtp ? "Sending..." : "Send Verification Code"}
          </button>

          {sendError && <p className="text-sm text-red-500 mt-2">{sendError}</p>}
        </div>
      )}

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
