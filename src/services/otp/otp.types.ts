export interface SendOtpResult {
  success: boolean;
  expiresInSeconds: number;
  errorCode?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  verified: boolean;
  errorCode?: string;
  reason?: "not_found" | "expired" | "invalid_code" | "max_attempts" | "already_verified";
}

export type OtpPurpose = "login" | "register";
