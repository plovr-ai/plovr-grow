import { AppError, ErrorCodes } from "@/lib/errors";

export const squareConfig = {
  get enabled() {
    return process.env.SQUARE_ENABLED === "true";
  },
  get appId() {
    return process.env.SQUARE_APP_ID ?? "";
  },
  get appSecret() {
    return process.env.SQUARE_APP_SECRET ?? "";
  },
  get environment() {
    return (process.env.SQUARE_ENVIRONMENT ?? "sandbox") as
      | "sandbox"
      | "production";
  },
  get oauthStateSecret() {
    return process.env.SQUARE_OAUTH_STATE_SECRET ?? "";
  },
  get oauthRedirectUrl() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${baseUrl}/api/integration/square/oauth/callback`;
  },
  get oauthBaseUrl() {
    const env = process.env.SQUARE_ENVIRONMENT ?? "sandbox";
    return env === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  },

  assertConfigured() {
    if (!this.enabled || !this.appId || !this.appSecret) {
      throw new AppError(ErrorCodes.SQUARE_NOT_CONFIGURED, undefined, 500);
    }
  },
} as const;
