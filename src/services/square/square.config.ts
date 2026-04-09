import { AppError, ErrorCodes } from "@/lib/errors";

export const squareConfig = {
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

  get webhookSignatureKey() {
    return process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
  },
  get webhookNotificationUrl() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${baseUrl}/api/integration/square/webhook`;
  },

  assertConfigured() {
    if (!this.appId || !this.appSecret) {
      throw new AppError(ErrorCodes.SQUARE_NOT_CONFIGURED, undefined, 500);
    }
  },

  assertWebhookConfigured() {
    if (!this.webhookSignatureKey) {
      throw new AppError(ErrorCodes.SQUARE_WEBHOOK_NOT_CONFIGURED, undefined, 500);
    }
  },
} as const;
