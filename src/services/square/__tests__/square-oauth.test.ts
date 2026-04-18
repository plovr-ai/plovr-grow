import { describe, it, expect, vi, beforeEach } from "vitest";
import { squareOAuthService } from "../square-oauth.service";
import { AppError } from "@/lib/errors";
import * as squareModule from "square";

const mockOAuthApi = { obtainToken: vi.fn() };
const mockLocationsApi = { list: vi.fn() };

vi.mock("square", () => {
  return {
    SquareClient: vi.fn().mockImplementation(function () {
      return {
        oAuth: mockOAuthApi,
        locations: mockLocationsApi,
      };
    }),
    SquareEnvironment: { Sandbox: "sandbox", Production: "production" },
  };
});

vi.mock("../square.config", () => ({
  squareConfig: {
    appId: "test-app-id",
    appSecret: "test-app-secret",
    environment: "sandbox",
    oauthStateSecret: "test-secret-key-32-chars-long!!!",
    oauthRedirectUrl:
      "http://localhost:3000/api/integration/square/oauth/callback",
    oauthBaseUrl: "https://connect.squareupsandbox.com",
    enabled: true,
    assertConfigured: vi.fn(),
  },
}));

describe("SquareOAuthService", () => {
  const service = squareOAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildAuthorizationUrl()", () => {
    it("should produce a valid Square OAuth URL with signed state", () => {
      const url = service.buildAuthorizationUrl(
        "tenant-1",
        "merchant-1",
        "https://example.com/return"
      );

      expect(url).toContain("https://connect.squareupsandbox.com/oauth2/authorize");
      expect(url).toContain("client_id=test-app-id");
      expect(url).toContain("scope=ITEMS_READ+MERCHANT_PROFILE_READ");
      expect(url).toContain("session=false");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("state=");
    });

    it("should include a state parameter with payload and signature separated by dot", () => {
      const url = service.buildAuthorizationUrl(
        "tenant-1",
        "merchant-1",
        "https://example.com/return"
      );

      const parsedUrl = new URL(url);
      const state = parsedUrl.searchParams.get("state");
      expect(state).toBeTruthy();
      expect(state).toContain(".");

      const parts = state!.split(".");
      expect(parts.length).toBe(2);
    });

    it("should call assertConfigured", async () => {
      const { squareConfig } = await import("../square.config");
      service.buildAuthorizationUrl("tenant-1", "merchant-1", "/return");
      expect(squareConfig.assertConfigured).toHaveBeenCalled();
    });
  });

  describe("verifyAndParseState()", () => {
    it("should verify valid state and return parsed data", () => {
      const url = service.buildAuthorizationUrl(
        "tenant-abc",
        "merchant-xyz",
        "https://example.com/return"
      );
      const parsedUrl = new URL(url);
      const state = parsedUrl.searchParams.get("state")!;

      const result = service.verifyAndParseState(state);

      expect(result.tenantId).toBe("tenant-abc");
      expect(result.merchantId).toBe("merchant-xyz");
      expect(result.returnUrl).toBe("https://example.com/return");
    });

    it("should throw AppError on state without dot separator", () => {
      expect(() => service.verifyAndParseState("nodothere")).toThrow(AppError);
    });

    it("should throw AppError on tampered state payload", () => {
      const url = service.buildAuthorizationUrl(
        "tenant-1",
        "merchant-1",
        "/return"
      );
      const parsedUrl = new URL(url);
      const state = parsedUrl.searchParams.get("state")!;

      // Tamper the payload portion
      const dotIndex = state.lastIndexOf(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({ tenantId: "evil-tenant", merchantId: "merchant-1", returnUrl: "/return" })
      ).toString("base64url");
      const tamperedState = `${tamperedPayload}.${state.slice(dotIndex + 1)}`;

      expect(() => service.verifyAndParseState(tamperedState)).toThrow(AppError);
    });

    it("should throw AppError on tampered signature", () => {
      const url = service.buildAuthorizationUrl(
        "tenant-1",
        "merchant-1",
        "/return"
      );
      const parsedUrl = new URL(url);
      const state = parsedUrl.searchParams.get("state")!;
      const dotIndex = state.lastIndexOf(".");
      const tamperedState = `${state.slice(0, dotIndex)}.invalidsignature`;

      expect(() => service.verifyAndParseState(tamperedState)).toThrow(AppError);
    });
  });

  describe("exchangeCode()", () => {
    it("should call obtainToken with authorization_code grant and return token response", async () => {
      mockOAuthApi.obtainToken.mockResolvedValue({
        accessToken: "access-123",
        refreshToken: "refresh-456",
        expiresAt: "2026-05-08T00:00:00Z",
        merchantId: "sq-merchant-1",
      });

      const result = await service.exchangeCode("auth-code-abc");

      expect(mockOAuthApi.obtainToken).toHaveBeenCalledWith({
        clientId: "test-app-id",
        clientSecret: "test-app-secret",
        code: "auth-code-abc",
        grantType: "authorization_code",
      });

      expect(result).toEqual({
        accessToken: "access-123",
        refreshToken: "refresh-456",
        expiresAt: new Date("2026-05-08T00:00:00Z"),
        merchantId: "sq-merchant-1",
      });
    });

    it("should return expiresAt as a Date object", async () => {
      mockOAuthApi.obtainToken.mockResolvedValue({
        accessToken: "access-123",
        refreshToken: "refresh-456",
        expiresAt: "2026-05-08T00:00:00Z",
        merchantId: "sq-merchant-1",
      });

      const result = await service.exchangeCode("auth-code-abc");

      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("refreshToken()", () => {
    it("should call obtainToken with refresh_token grant and return token response", async () => {
      mockOAuthApi.obtainToken.mockResolvedValue({
        accessToken: "new-access-789",
        refreshToken: "new-refresh-012",
        expiresAt: "2026-06-08T00:00:00Z",
        merchantId: "sq-merchant-1",
      });

      const result = await service.refreshToken("old-refresh-token");

      expect(mockOAuthApi.obtainToken).toHaveBeenCalledWith({
        clientId: "test-app-id",
        clientSecret: "test-app-secret",
        refreshToken: "old-refresh-token",
        grantType: "refresh_token",
      });

      expect(result).toEqual({
        accessToken: "new-access-789",
        refreshToken: "new-refresh-012",
        expiresAt: new Date("2026-06-08T00:00:00Z"),
        merchantId: "sq-merchant-1",
      });
    });

    it("should return expiresAt as a Date object", async () => {
      mockOAuthApi.obtainToken.mockResolvedValue({
        accessToken: "new-access-789",
        refreshToken: "new-refresh-012",
        expiresAt: "2026-06-08T00:00:00Z",
        merchantId: "sq-merchant-1",
      });

      const result = await service.refreshToken("old-refresh-token");

      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("listLocations()", () => {
    it("should return mapped locations from Square API", async () => {
      mockLocationsApi.list.mockResolvedValue({
        locations: [
          {
            id: "loc-1",
            name: "Main Street Location",
            address: {
              addressLine1: "123 Main St",
              locality: "San Francisco",
              administrativeDistrictLevel1: "CA",
              postalCode: "94102",
              country: "US",
            },
            status: "ACTIVE",
          },
          {
            id: "loc-2",
            name: "Downtown Location",
            address: null,
            status: "INACTIVE",
          },
        ],
      });

      const result = await service.listLocations("access-token-abc");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "loc-1",
        name: "Main Street Location",
        address: {
          addressLine1: "123 Main St",
          locality: "San Francisco",
          administrativeDistrictLevel1: "CA",
          postalCode: "94102",
          country: "US",
        },
        status: "ACTIVE",
      });
      expect(result[1]).toEqual({
        id: "loc-2",
        name: "Downtown Location",
        address: undefined,
        status: "INACTIVE",
      });
    });

    it("should handle locations with partial address fields (null coalescing)", async () => {
      mockLocationsApi.list.mockResolvedValue({
        locations: [
          {
            id: "loc-3",
            name: null,
            address: {
              addressLine1: null,
              locality: null,
              administrativeDistrictLevel1: null,
              postalCode: null,
              country: null,
            },
            status: null,
          },
        ],
      });

      const result = await service.listLocations("access-token-abc");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "loc-3",
        name: "",
        address: {
          addressLine1: undefined,
          locality: undefined,
          administrativeDistrictLevel1: undefined,
          postalCode: undefined,
          country: undefined,
        },
        status: "UNKNOWN",
      });
    });

    it("should return empty array when no locations exist", async () => {
      mockLocationsApi.list.mockResolvedValue({
        locations: undefined,
      });

      const result = await service.listLocations("access-token-abc");

      expect(result).toEqual([]);
    });

    it("should use Production environment when configured", async () => {
      const { squareConfig: configMock } = await import("../square.config");
      const origEnv = configMock.environment;
      (configMock as Record<string, unknown>).environment = "production";

      mockLocationsApi.list.mockResolvedValue({ locations: [] });

      await service.listLocations("prod-token");

      const ClientMock = squareModule.SquareClient as unknown as ReturnType<typeof vi.fn>;
      const lastCallArgs = ClientMock.mock.calls[ClientMock.mock.calls.length - 1][0];
      expect(lastCallArgs.environment).toBe("production");

      (configMock as Record<string, unknown>).environment = origEnv;
    });

    it("should pass access token to the Square client", async () => {
      mockLocationsApi.list.mockResolvedValue({
        locations: [],
      });

      await service.listLocations("my-access-token");

      const ClientMock = squareModule.SquareClient as unknown as ReturnType<typeof vi.fn>;
      const lastCallArgs = ClientMock.mock.calls[ClientMock.mock.calls.length - 1][0];
      expect(lastCallArgs.token).toBe("my-access-token");
    });
  });
});
