import type { SmsProvider, SmsResult } from "../sms-provider.interface";

/**
 * Twilio SMS Provider
 *
 * To use this provider:
 * 1. Install twilio: npm install twilio
 * 2. Set environment variables:
 *    - TWILIO_ACCOUNT_SID
 *    - TWILIO_AUTH_TOKEN
 *    - TWILIO_PHONE_NUMBER
 * 3. Set SMS_PROVIDER=twilio in .env
 */
export class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER ?? "";

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.warn(
        "[TwilioSmsProvider] Missing Twilio credentials. " +
        "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment."
      );
    }
  }

  async sendOtp(phone: string, code: string): Promise<SmsResult> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      return {
        success: false,
        error: "Twilio credentials not configured",
      };
    }

    try {
      // Dynamic import to avoid requiring twilio as a dependency
      // @ts-expect-error - twilio is an optional peer dependency
      const twilio = await import("twilio");
      const client = twilio.default(this.accountSid, this.authToken);

      const message = await client.messages.create({
        body: `Your verification code is: ${code}. Valid for 5 minutes.`,
        from: this.fromNumber,
        to: phone,
      });

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      console.error("[TwilioSmsProvider] Error sending SMS:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendMessage(phone: string, message: string): Promise<SmsResult> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      return {
        success: false,
        error: "Twilio credentials not configured",
      };
    }

    try {
      // @ts-expect-error - twilio is an optional peer dependency
      const twilio = await import("twilio");
      const client = twilio.default(this.accountSid, this.authToken);

      const result = await client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phone,
      });

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      console.error("[TwilioSmsProvider] Error sending SMS:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  verifyPhoneFormat(phone: string): boolean {
    // E.164 format: +[country code][number]
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }

  getProviderName(): string {
    return "twilio";
  }
}
