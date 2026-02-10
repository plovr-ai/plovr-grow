import {
  otpVerificationRepository,
  type OtpVerificationRepository,
} from "@/repositories/otp-verification.repository";
import { smsService, type SmsService } from "@/services/sms";
import { ErrorCodes } from "@/lib/errors";
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
    // Use fixed code in development for easier testing
    if (process.env.NODE_ENV === "development") {
      return "123456";
    }
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
        errorCode: ErrorCodes.OTP_INVALID_PHONE,
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
        errorCode: ErrorCodes.OTP_SMS_FAILED,
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
        errorCode: this.getErrorCode(validation.reason),
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
   * Get error code from validation reason
   */
  private getErrorCode(
    reason?: "not_found" | "expired" | "invalid_code" | "max_attempts" | "already_verified"
  ): string {
    switch (reason) {
      case "not_found":
        return ErrorCodes.OTP_NOT_FOUND;
      case "expired":
        return ErrorCodes.OTP_EXPIRED;
      case "invalid_code":
        return ErrorCodes.OTP_INVALID;
      case "max_attempts":
        return ErrorCodes.OTP_MAX_ATTEMPTS;
      case "already_verified":
        return ErrorCodes.OTP_ALREADY_VERIFIED;
      default:
        return ErrorCodes.VALIDATION_FAILED;
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
