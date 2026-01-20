import type { SmsProvider, SmsResult } from "./sms-provider.interface";
import { MockSmsProvider } from "./providers/mock.provider";
import { TwilioSmsProvider } from "./providers/twilio.provider";

/**
 * Create SMS provider based on environment configuration
 */
function createSmsProvider(): SmsProvider {
  const provider = process.env.SMS_PROVIDER ?? "mock";

  switch (provider.toLowerCase()) {
    case "twilio":
      return new TwilioSmsProvider();
    case "mock":
    default:
      return new MockSmsProvider();
  }
}

// Singleton instance
let smsProviderInstance: SmsProvider | null = null;

/**
 * Get the SMS provider instance
 */
export function getSmsProvider(): SmsProvider {
  if (!smsProviderInstance) {
    smsProviderInstance = createSmsProvider();
    console.log(`[SMS] Using provider: ${smsProviderInstance.getProviderName()}`);
  }
  return smsProviderInstance;
}

/**
 * SMS Service - wrapper around the provider
 */
export class SmsService {
  private provider: SmsProvider;

  constructor(provider?: SmsProvider) {
    this.provider = provider ?? getSmsProvider();
  }

  /**
   * Send OTP via SMS
   */
  async sendOtp(phone: string, code: string): Promise<SmsResult> {
    if (!this.verifyPhoneFormat(phone)) {
      return {
        success: false,
        error: "Invalid phone number format. Use E.164 format (e.g., +14155551234)",
      };
    }

    return this.provider.sendOtp(phone, code);
  }

  /**
   * Verify phone number format
   */
  verifyPhoneFormat(phone: string): boolean {
    return this.provider.verifyPhoneFormat(phone);
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }
}

export const smsService = new SmsService();
