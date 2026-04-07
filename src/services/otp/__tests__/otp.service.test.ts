import { describe, it, expect, vi, beforeEach } from "vitest";
import { OtpService } from "../otp.service";

// Mock repository
vi.mock("@/repositories/otp-verification.repository", () => ({
  otpVerificationRepository: {
    upsert: vi.fn(),
    isValid: vi.fn(),
    incrementAttempts: vi.fn(),
    markVerified: vi.fn(),
    deleteExpired: vi.fn(),
  },
}));

// Mock SMS service
vi.mock("@/services/sms", () => ({
  smsService: {
    sendOtp: vi.fn(),
    verifyPhoneFormat: vi.fn(),
  },
}));

import { otpVerificationRepository } from "@/repositories/otp-verification.repository";
import { smsService } from "@/services/sms";

describe("OtpService", () => {
  let service: OtpService;

  const mockOtpRecord = {
    id: "otp-1",
    tenantId: "tenant-1",
    phone: "+12025551234",
    purpose: "login",
    code: "123456",
    attempts: 0,
    expiresAt: new Date(Date.now() + 300000),
    verifiedAt: null,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OtpService();
  });

  describe("sendOtp", () => {
    it("should send OTP successfully", async () => {
      vi.mocked(smsService.verifyPhoneFormat).mockReturnValue(true);
      vi.mocked(otpVerificationRepository.upsert).mockResolvedValue(mockOtpRecord);
      vi.mocked(smsService.sendOtp).mockResolvedValue({ success: true });

      const result = await service.sendOtp("tenant-1", "+12025551234", "login");

      expect(result.success).toBe(true);
      expect(result.expiresInSeconds).toBe(300); // 5 minutes
      expect(otpVerificationRepository.upsert).toHaveBeenCalled();
      expect(smsService.sendOtp).toHaveBeenCalled();
    });

    it("should return error for invalid phone format", async () => {
      vi.mocked(smsService.verifyPhoneFormat).mockReturnValue(false);

      const result = await service.sendOtp("tenant-1", "invalid-phone", "login");

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("OTP_INVALID_PHONE");
      expect(otpVerificationRepository.upsert).not.toHaveBeenCalled();
      expect(smsService.sendOtp).not.toHaveBeenCalled();
    });

    it("should return error when SMS sending fails", async () => {
      vi.mocked(smsService.verifyPhoneFormat).mockReturnValue(true);
      vi.mocked(otpVerificationRepository.upsert).mockResolvedValue(mockOtpRecord);
      vi.mocked(smsService.sendOtp).mockResolvedValue({
        success: false,
        error: "SMS provider error",
      });

      const result = await service.sendOtp("tenant-1", "+12025551234", "login");

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("OTP_SMS_FAILED");
    });

    it("should store OTP with correct expiration", async () => {
      vi.mocked(smsService.verifyPhoneFormat).mockReturnValue(true);
      vi.mocked(otpVerificationRepository.upsert).mockResolvedValue(mockOtpRecord);
      vi.mocked(smsService.sendOtp).mockResolvedValue({ success: true });

      await service.sendOtp("tenant-1", "+12025551234", "register");

      expect(otpVerificationRepository.upsert).toHaveBeenCalledWith(
        "tenant-1",
        "+12025551234",
        "register",
        expect.stringMatching(/^\d{6}$/), // 6-digit code
        expect.any(Date)
      );
    });
  });

  describe("verifyOtp", () => {
    it("should verify OTP successfully", async () => {
      vi.mocked(otpVerificationRepository.isValid).mockResolvedValue({
        valid: true,
      });
      vi.mocked(otpVerificationRepository.markVerified).mockResolvedValue(mockOtpRecord);

      const result = await service.verifyOtp(
        "tenant-1",
        "+12025551234",
        "123456",
        "login"
      );

      expect(result.verified).toBe(true);
      expect(result.success).toBe(true);
      expect(otpVerificationRepository.markVerified).toHaveBeenCalledWith(
        "tenant-1",
        "+12025551234",
        "login"
      );
    });

    it("should return error for expired OTP", async () => {
      vi.mocked(otpVerificationRepository.isValid).mockResolvedValue({
        valid: false,
        reason: "expired",
      });

      const result = await service.verifyOtp(
        "tenant-1",
        "+12025551234",
        "123456",
        "login"
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("expired");
      expect(result.errorCode).toBe("OTP_EXPIRED");
    });

    it("should increment attempts for invalid code", async () => {
      vi.mocked(otpVerificationRepository.isValid).mockResolvedValue({
        valid: false,
        reason: "invalid_code",
      });
      vi.mocked(otpVerificationRepository.incrementAttempts).mockResolvedValue(mockOtpRecord);

      const result = await service.verifyOtp(
        "tenant-1",
        "+12025551234",
        "000000",
        "login"
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("invalid_code");
      expect(otpVerificationRepository.incrementAttempts).toHaveBeenCalledWith(
        "tenant-1",
        "+12025551234",
        "login"
      );
    });

    it("should not increment attempts for other errors", async () => {
      vi.mocked(otpVerificationRepository.isValid).mockResolvedValue({
        valid: false,
        reason: "max_attempts",
      });

      const result = await service.verifyOtp(
        "tenant-1",
        "+12025551234",
        "123456",
        "login"
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("max_attempts");
      expect(otpVerificationRepository.incrementAttempts).not.toHaveBeenCalled();
    });

    it("should return error for not found OTP", async () => {
      vi.mocked(otpVerificationRepository.isValid).mockResolvedValue({
        valid: false,
        reason: "not_found",
      });

      const result = await service.verifyOtp(
        "tenant-1",
        "+12025551234",
        "123456",
        "login"
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("not_found");
      expect(result.errorCode).toBe("OTP_NOT_FOUND");
    });

    it("should return error for already verified OTP", async () => {
      vi.mocked(otpVerificationRepository.isValid).mockResolvedValue({
        valid: false,
        reason: "already_verified",
      });

      const result = await service.verifyOtp(
        "tenant-1",
        "+12025551234",
        "123456",
        "login"
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("already_verified");
      expect(result.errorCode).toBe("OTP_ALREADY_VERIFIED");
    });
  });

  describe("cleanupExpired", () => {
    it("should clean up expired OTP records", async () => {
      vi.mocked(otpVerificationRepository.deleteExpired).mockResolvedValue({
        count: 5,
      });

      const result = await service.cleanupExpired();

      expect(result).toBe(5);
      expect(otpVerificationRepository.deleteExpired).toHaveBeenCalled();
    });
  });
});
