"use client";

import { useState, useCallback } from "react";
import { usePhoneInput } from "@/hooks";
import { useCompanySlug, useLoyalty, type LoyaltyMember } from "@/contexts";
import { OtpModal } from "../checkout/OtpModal";
import {
  loyaltyRegistrationSchema,
  type LoyaltyRegistrationData,
} from "@storefront/lib/validations/loyalty";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalStep = "phone" | "registration" | "otp";

export function SignInModal({ isOpen, onClose, onSuccess }: SignInModalProps) {
  const companySlug = useCompanySlug();
  const { login } = useLoyalty();
  const { format: formatPhone } = usePhoneInput();

  // UI state
  const [step, setStep] = useState<ModalStep>("phone");
  const [phone, setPhone] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);

  // Registration form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof LoyaltyRegistrationData, string>>
  >({});

  // Loading state
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Error state
  const [phoneError, setPhoneError] = useState("");
  const [verifyError, setVerifyError] = useState("");

  // Points per dollar for login context
  const [localPointsPerDollar, setLocalPointsPerDollar] = useState(1);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setPhoneError("");
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

  // Step 1: Check if user is new or existing
  const handleCheckPhone = useCallback(async () => {
    if (!companySlug || !phone) return;

    setIsCheckingPhone(true);
    setPhoneError("");

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
        setPhoneError(data.error || "Failed to verify phone number");
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

      // Check if new member - show registration form, otherwise show OTP modal
      if (data.data?.isNewMember) {
        setStep("registration");
      } else {
        setShowOtpModal(true);
      }
    } catch {
      setPhoneError("Network error. Please try again.");
    } finally {
      setIsCheckingPhone(false);
    }
  }, [companySlug, phone]);

  // Step 2: Validate registration form and send OTP (for new users)
  const handleSubmitRegistration = useCallback(async () => {
    // Validate form
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
      return;
    }

    setFormErrors({});
    setShowOtpModal(true);
  }, [firstName, lastName, email]);

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
            // Include registration data for new users
            ...(step === "registration" && {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
            }),
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
          email: data.data.member.email ?? null,
          firstName: data.data.member.firstName ?? null,
          lastName: data.data.member.lastName ?? null,
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
    [
      companySlug,
      phone,
      step,
      firstName,
      lastName,
      email,
      localPointsPerDollar,
      login,
      onSuccess,
    ]
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
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneError("");
    setVerifyError("");
    setFormErrors({});
    setShowOtpModal(false);
    setStep("phone");
    onClose();
  };

  const handleBackToPhone = () => {
    setStep("phone");
    setFirstName("");
    setLastName("");
    setEmail("");
    setFormErrors({});
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
              {step === "registration"
                ? "Create Your Account"
                : "Sign In to Earn Rewards"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === "registration"
                ? "Complete your profile to earn rewards"
                : "Enter your phone number to sign in or create an account"}
            </p>
          </div>

          {step === "phone" ? (
            // Phone Input Step
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
                  disabled={isCheckingPhone}
                />
                {phoneError && (
                  <p className="text-sm text-red-500 mt-1">{phoneError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleCheckPhone}
                disabled={phone.replace(/\D/g, "").length < 10 || isCheckingPhone}
                className="w-full py-3 bg-theme-primary text-theme-primary-foreground font-medium rounded-lg hover:bg-theme-primary-hover transition-colors disabled:bg-gray-200 disabled:text-gray-400"
              >
                {isCheckingPhone ? "Checking..." : "Continue"}
              </button>
            </div>
          ) : (
            // Registration Form Step
            <div className="space-y-4">
              {/* Phone display (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                    {phone}
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToPhone}
                    className="text-sm text-theme-primary hover:text-theme-primary-hover"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* First Name */}
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setFormErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                  placeholder="John"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent ${
                    formErrors.firstName ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {formErrors.firstName && (
                  <p className="text-sm text-red-500 mt-1">
                    {formErrors.firstName}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setFormErrors((prev) => ({ ...prev, lastName: undefined }));
                  }}
                  placeholder="Doe"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent ${
                    formErrors.lastName ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {formErrors.lastName && (
                  <p className="text-sm text-red-500 mt-1">
                    {formErrors.lastName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFormErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent ${
                    formErrors.email ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {formErrors.email && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmitRegistration}
                disabled={isSendingOtp}
                className="w-full py-3 bg-theme-primary text-theme-primary-foreground font-medium rounded-lg hover:bg-theme-primary-hover transition-colors disabled:bg-gray-200 disabled:text-gray-400"
              >
                {isSendingOtp ? "Sending..." : "Send Verification Code"}
              </button>
            </div>
          )}
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
