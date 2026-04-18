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
 * Factory that creates an SMS service bound to the given provider.
 * Closure captures the provider, replacing the former class's `private` field.
 */
export function createSmsService(provider?: SmsProvider) {
  const bound: SmsProvider = provider ?? getSmsProvider();

  function verifyPhoneFormat(phone: string): boolean {
    return bound.verifyPhoneFormat(phone);
  }

  async function sendOtp(phone: string, code: string): Promise<SmsResult> {
    if (!verifyPhoneFormat(phone)) {
      return {
        success: false,
        error: "Invalid phone number format. Use E.164 format (e.g., +14155551234)",
      };
    }

    return bound.sendOtp(phone, code);
  }

  async function sendMessage(phone: string, message: string): Promise<SmsResult> {
    if (!verifyPhoneFormat(phone)) {
      return {
        success: false,
        error: "Invalid phone number format. Use E.164 format (e.g., +14155551234)",
      };
    }

    return bound.sendMessage(phone, message);
  }

  function getProviderName(): string {
    return bound.getProviderName();
  }

  return {
    sendOtp,
    sendMessage,
    verifyPhoneFormat,
    getProviderName,
  };
}

export type SmsService = ReturnType<typeof createSmsService>;

export const smsService: SmsService = createSmsService();
