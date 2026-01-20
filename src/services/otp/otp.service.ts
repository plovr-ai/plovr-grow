import {
  otpVerificationRepository,
  type OtpVerificationRepository,
} from "@/repositories/otp-verification.repository";
import { smsService, type SmsService } from "@/services/sms";
import type { SendOtpResult, VerifyOtpResult, OtpPurpose } from "./otp.types";

// Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;

export class OtpService {
  private _repository: OtpVerificationRepository | null = null;
  private _smsService: SmsService | null = null;

  private get repository(): OtpVerificationRepository {
    if (!this._repository) {
      this._repository = otpVerificationRepository;
    }
    return this._repository;
  }

  private get sms(): SmsService {
    if (!this._smsService) {
      this._smsService = smsService;
    }
    return this._smsService;
  }

  /**
   * Generate a random OTP code
   */
  private generateOtpCode(): string {
    // Generate a random 6-digit code
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Calculate expiration date
   */
  private getExpirationDate(): Date {
    const date = new Date();
    date.setMinutes(date.getMinutes() + OTP_EXPIRY_MINUTES);
    return date;
  }

  /**
   * Send OTP to a phone number
   */
  async sendOtp(
    tenantId: string,
    phone: string,
    purpose: OtpPurpose
  ): Promise<SendOtpResult> {
    // Validate phone format
    if (!this.sms.verifyPhoneFormat(phone)) {
      return {
        success: false,
        expiresInSeconds: 0,
        error: "Invalid phone number format. Use E.164 format (e.g., +14155551234)",
      };
    }

    // Generate OTP
    const code = this.generateOtpCode();
    const expiresAt = this.getExpirationDate();

    // Store OTP in database
    await this.repository.upsert(tenantId, phone, purpose, code, expiresAt);

    // Send SMS
    const smsResult = await this.sms.sendOtp(phone, code);

    if (!smsResult.success) {
      return {
        success: false,
        expiresInSeconds: 0,
        error: smsResult.error ?? "Failed to send SMS",
      };
    }

    return {
      success: true,
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    };
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(
    tenantId: string,
    phone: string,
    code: string,
    purpose: OtpPurpose
  ): Promise<VerifyOtpResult> {
    // Check if OTP is valid
    const validation = await this.repository.isValid(
      tenantId,
      phone,
      purpose,
      code,
      MAX_ATTEMPTS
    );

    if (!validation.valid) {
      // Increment attempt count if code was invalid
      if (validation.reason === "invalid_code") {
        await this.repository.incrementAttempts(tenantId, phone, purpose);
      }

      return {
        success: false,
        verified: false,
        reason: validation.reason,
        error: this.getErrorMessage(validation.reason),
      };
    }

    // Mark as verified
    await this.repository.markVerified(tenantId, phone, purpose);

    return {
      success: true,
      verified: true,
    };
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(
    reason?: "not_found" | "expired" | "invalid_code" | "max_attempts" | "already_verified"
  ): string {
    switch (reason) {
      case "not_found":
        return "Verification code not found. Please request a new code.";
      case "expired":
        return "Verification code has expired. Please request a new code.";
      case "invalid_code":
        return "Invalid verification code. Please try again.";
      case "max_attempts":
        return "Too many failed attempts. Please request a new code.";
      case "already_verified":
        return "This code has already been verified.";
      default:
        return "Verification failed.";
    }
  }

  /**
   * Clean up expired OTP records
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.repository.deleteExpired();
    return result.count;
  }
}

export const otpService = new OtpService();
