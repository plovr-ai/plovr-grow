import { AppError, ErrorCodes } from "@/lib/errors";

export const gbpConfig = {
  get clientId() {
    return process.env.GBP_CLIENT_ID ?? "";
  },
  get clientSecret() {
    return process.env.GBP_CLIENT_SECRET ?? "";
  },
  get oauthStateSecret() {
    return process.env.GBP_OAUTH_STATE_SECRET ?? "";
  },
  get oauthRedirectUrl() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${baseUrl}/api/integration/gbp/oauth/callback`;
  },

  assertConfigured() {
    if (!this.clientId || !this.clientSecret) {
      throw new AppError(ErrorCodes.GBP_NOT_CONFIGURED, undefined, 500);
    }
  },
} as const;
