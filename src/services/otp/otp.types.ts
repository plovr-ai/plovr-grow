export interface SendOtpResult {
  success: boolean;
  expiresInSeconds: number;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  verified: boolean;
  error?: string;
  reason?: "not_found" | "expired" | "invalid_code" | "max_attempts" | "already_verified";
}

export type OtpPurpose = "login" | "register";
