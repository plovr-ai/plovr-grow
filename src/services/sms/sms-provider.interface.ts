export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  /**
   * Send an OTP code via SMS
   */
  sendOtp(phone: string, code: string): Promise<SmsResult>;

  /**
   * Verify phone number format (E.164)
   */
  verifyPhoneFormat(phone: string): boolean;

  /**
   * Get provider name (for logging)
   */
  getProviderName(): string;
}
