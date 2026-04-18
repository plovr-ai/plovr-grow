import crypto from "crypto";
import { gbpConfig } from "./gbp.config";
import { AppError, ErrorCodes } from "@/lib/errors";
import { getProxyDispatcher } from "@/lib/proxy";
import type { GbpTokenResponse, OAuthState } from "./gbp.types";

const SCOPE = "https://www.googleapis.com/auth/business.manage";
const AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function buildAuthorizationUrl(
  tenantId: string,
  merchantId: string,
  returnUrl: string
): string {
  gbpConfig.assertConfigured();

  const state = signState({ tenantId, merchantId, returnUrl });
  const params = new URLSearchParams({
    client_id: gbpConfig.clientId,
    redirect_uri: gbpConfig.oauthRedirectUrl,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${AUTHORIZATION_URL}?${params.toString()}`;
}

function verifyAndParseState(state: string): OAuthState {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) {
    throw new AppError(ErrorCodes.INTEGRATION_OAUTH_STATE_INVALID);
  }

  const payload = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);

  const expectedSignature = crypto
    .createHmac("sha256", gbpConfig.oauthStateSecret)
    .update(payload)
    .digest("base64url");

  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // timingSafeEqual throws if buffers have different lengths
    isValid = false;
  }

  if (!isValid) {
    throw new AppError(ErrorCodes.INTEGRATION_OAUTH_STATE_INVALID);
  }

  const decoded = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf-8")
  ) as OAuthState;
  return decoded;
}

async function exchangeCode(code: string): Promise<GbpTokenResponse> {
  const dispatcher = getProxyDispatcher();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: gbpConfig.clientId,
      client_secret: gbpConfig.clientSecret,
      redirect_uri: gbpConfig.oauthRedirectUrl,
      grant_type: "authorization_code",
    }),
    ...(dispatcher ? { dispatcher } : {}),
  } as RequestInit);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[GBP OAuth] Token exchange failed:", errorBody);
    throw new AppError(ErrorCodes.INTEGRATION_OAUTH_STATE_INVALID);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshToken(refreshTokenValue: string): Promise<GbpTokenResponse> {
  const dispatcher = getProxyDispatcher();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshTokenValue,
      client_id: gbpConfig.clientId,
      client_secret: gbpConfig.clientSecret,
      grant_type: "refresh_token",
    }),
    ...(dispatcher ? { dispatcher } : {}),
  } as RequestInit);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[GBP OAuth] Token refresh failed:", errorBody);
    throw new AppError(ErrorCodes.INTEGRATION_TOKEN_EXPIRED, undefined, 401);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    // Google may not return a new refresh token on refresh
    refreshToken: data.refresh_token ?? refreshTokenValue,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

function signState(data: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", gbpConfig.oauthStateSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export const gbpOAuthService = {
  buildAuthorizationUrl,
  verifyAndParseState,
  exchangeCode,
  refreshToken,
  signState,
};
