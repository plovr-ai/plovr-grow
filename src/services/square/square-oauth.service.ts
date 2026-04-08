import crypto from "crypto";
import { Client, Environment } from "square";
import { squareConfig } from "./square.config";
import { AppError, ErrorCodes } from "@/lib/errors";
import type {
  SquareTokenResponse,
  SquareLocation,
  OAuthState,
} from "./square.types";

const SCOPES = ["ITEMS_READ", "MERCHANT_PROFILE_READ"];

export class SquareOAuthService {
  private getClient(accessToken?: string): Client {
    return new Client({
      accessToken,
      environment:
        squareConfig.environment === "production"
          ? Environment.Production
          : Environment.Sandbox,
    });
  }

  buildAuthorizationUrl(
    tenantId: string,
    merchantId: string,
    returnUrl: string
  ): string {
    squareConfig.assertConfigured();

    const state = this.signState({ tenantId, merchantId, returnUrl });
    const params = new URLSearchParams({
      client_id: squareConfig.appId,
      scope: SCOPES.join(" "),
      session: "false",
      state,
      redirect_uri: squareConfig.oauthRedirectUrl,
    });

    return `${squareConfig.oauthBaseUrl}/oauth2/authorize?${params.toString()}`;
  }

  verifyAndParseState(state: string): OAuthState {
    const dotIndex = state.lastIndexOf(".");
    if (dotIndex === -1) {
      throw new AppError(ErrorCodes.INTEGRATION_OAUTH_STATE_INVALID);
    }

    const payload = state.slice(0, dotIndex);
    const signature = state.slice(dotIndex + 1);

    const expectedSignature = crypto
      .createHmac("sha256", squareConfig.oauthStateSecret)
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

  async exchangeCode(code: string): Promise<SquareTokenResponse> {
    const client = this.getClient();
    const { result } = await client.oAuthApi.obtainToken({
      clientId: squareConfig.appId,
      clientSecret: squareConfig.appSecret,
      code,
      grantType: "authorization_code",
    });

    return {
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      expiresAt: new Date(result.expiresAt!),
      merchantId: result.merchantId!,
    };
  }

  async refreshToken(refreshTokenValue: string): Promise<SquareTokenResponse> {
    const client = this.getClient();
    const { result } = await client.oAuthApi.obtainToken({
      clientId: squareConfig.appId,
      clientSecret: squareConfig.appSecret,
      refreshToken: refreshTokenValue,
      grantType: "refresh_token",
    });

    return {
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      expiresAt: new Date(result.expiresAt!),
      merchantId: result.merchantId!,
    };
  }

  async listLocations(accessToken: string): Promise<SquareLocation[]> {
    const client = this.getClient(accessToken);
    const { result } = await client.locationsApi.listLocations();

    return (result.locations ?? []).map((loc) => ({
      id: loc.id!,
      name: loc.name ?? "",
      address: loc.address
        ? {
            addressLine1: loc.address.addressLine1 ?? undefined,
            locality: loc.address.locality ?? undefined,
            administrativeDistrictLevel1:
              loc.address.administrativeDistrictLevel1 ?? undefined,
            postalCode: loc.address.postalCode ?? undefined,
            country: loc.address.country ?? undefined,
          }
        : undefined,
      status: loc.status ?? "UNKNOWN",
    }));
  }

  private signState(data: OAuthState): string {
    const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", squareConfig.oauthStateSecret)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }
}

export const squareOAuthService = new SquareOAuthService();
