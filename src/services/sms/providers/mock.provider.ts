import type { SmsProvider, SmsResult } from "../sms-provider.interface";

/**
 * Mock SMS Provider for development/testing
 * Logs OTP codes to console instead of sending real SMS
 */
export class MockSmsProvider implements SmsProvider {
  private otpStore = new Map<string, string>();

  async sendOtp(phone: string, code: string): Promise<SmsResult> {
    // Store the OTP (for testing verification)
    this.otpStore.set(phone, code);

    // Log to console for development
    console.log("\n==========================================");
    console.log("[Mock SMS] OTP Verification Code");
    console.log("==========================================");
    console.log(`Phone: ${phone}`);
    console.log(`Code:  ${code}`);
    console.log("==========================================\n");

    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }

  verifyPhoneFormat(phone: string): boolean {
    // E.164 format: +[country code][number]
    // Examples: +14155551234, +8613800138000
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }

  getProviderName(): string {
    return "mock";
  }

  // ==================== Testing Helpers ====================

  /**
   * Get stored OTP for a phone number (for testing)
   */
  getStoredOtp(phone: string): string | undefined {
    return this.otpStore.get(phone);
  }

  /**
   * Clear stored OTPs (for testing)
   */
  clearStoredOtps(): void {
    this.otpStore.clear();
  }
}
