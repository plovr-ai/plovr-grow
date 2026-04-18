import { describe, it, expect, vi, beforeEach } from "vitest";
import { gbpOAuthService } from "../gbp-oauth.service";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/proxy", () => ({
  getProxyDispatcher: vi.fn(() => undefined),
}));

vi.mock("../gbp.config", () => ({
  gbpConfig: {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    oauthStateSecret: "test-secret-key-32-chars-long!!!",
    oauthRedirectUrl:
      "http://localhost:3000/api/integration/gbp/oauth/callback",
    assertConfigured: vi.fn(),
  },
}));

describe("GbpOAuthService", () => {
  const service = gbpOAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildAuthorizationUrl()", () => {
    it("should produce a valid Google OAuth URL with signed state", () => {
      const url = service.buildAuthorizationUrl(
        "tenant-1",
        "merchant-1",
        "https://example.com/return"
      );

      expect(url).toContain(
        "https://accounts.google.com/o/oauth2/v2/auth"
      );
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("response_type=code");
      expect(url).toContain("access_type=offline");
      expect(url).toContain("prompt=consent");
      expect(url).toContain(
        "scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fbusiness.manage"
      );
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
      const { gbpConfig } = await import("../gbp.config");
      service.buildAuthorizationUrl("tenant-1", "merchant-1", "/return");
      expect(gbpConfig.assertConfigured).toHaveBeenCalled();
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
      expect(() => service.verifyAndParseState("nodothere")).toThrow(
        AppError
      );
    });

    it("should throw AppError on tampered state payload", () => {
      const url = service.buildAuthorizationUrl(
        "tenant-1",
        "merchant-1",
        "/return"
      );
      const parsedUrl = new URL(url);
      const state = parsedUrl.searchParams.get("state")!;

      const dotIndex = state.lastIndexOf(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          tenantId: "evil-tenant",
          merchantId: "merchant-1",
          returnUrl: "/return",
        })
      ).toString("base64url");
      const tamperedState = `${tamperedPayload}.${state.slice(dotIndex + 1)}`;

      expect(() => service.verifyAndParseState(tamperedState)).toThrow(
        AppError
      );
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

      expect(() => service.verifyAndParseState(tamperedState)).toThrow(
        AppError
      );
    });
  });

  describe("exchangeCode()", () => {
    it("should pass dispatcher to fetch when proxy is configured", async () => {
      const { getProxyDispatcher } = await import("@/lib/proxy");
      const fakeDispatcher = { fake: true };
      vi.mocked(getProxyDispatcher).mockReturnValue(fakeDispatcher as never);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-123",
            refresh_token: "refresh-456",
            expires_in: 3600,
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await service.exchangeCode("auth-code-abc");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({ dispatcher: fakeDispatcher })
      );

      vi.mocked(getProxyDispatcher).mockReturnValue(undefined);
      vi.unstubAllGlobals();
    });

    it("should call Google token endpoint and return token response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-123",
            refresh_token: "refresh-456",
            expires_in: 3600,
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.exchangeCode("auth-code-abc");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );

      expect(result.accessToken).toBe("access-123");
      expect(result.refreshToken).toBe("refresh-456");
      expect(result.expiresAt).toBeInstanceOf(Date);

      vi.unstubAllGlobals();
    });

    it("should throw AppError when token exchange fails", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Bad Request"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(service.exchangeCode("bad-code")).rejects.toThrow(
        AppError
      );

      vi.unstubAllGlobals();
    });
  });

  describe("refreshToken()", () => {
    it("should pass dispatcher to fetch when proxy is configured", async () => {
      const { getProxyDispatcher } = await import("@/lib/proxy");
      const fakeDispatcher = { fake: true };
      vi.mocked(getProxyDispatcher).mockReturnValue(fakeDispatcher as never);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-789",
            refresh_token: "new-refresh-012",
            expires_in: 3600,
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await service.refreshToken("old-refresh-token");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({ dispatcher: fakeDispatcher })
      );

      vi.mocked(getProxyDispatcher).mockReturnValue(undefined);
      vi.unstubAllGlobals();
    });

    it("should call Google token endpoint with refresh_token grant", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-789",
            refresh_token: "new-refresh-012",
            expires_in: 3600,
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.refreshToken("old-refresh-token");

      expect(result.accessToken).toBe("new-access-789");
      expect(result.refreshToken).toBe("new-refresh-012");
      expect(result.expiresAt).toBeInstanceOf(Date);

      vi.unstubAllGlobals();
    });

    it("should keep original refresh token when Google does not return a new one", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-789",
            expires_in: 3600,
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.refreshToken("original-refresh-token");

      expect(result.refreshToken).toBe("original-refresh-token");

      vi.unstubAllGlobals();
    });

    it("should throw AppError when refresh fails", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Invalid grant"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        service.refreshToken("expired-refresh-token")
      ).rejects.toThrow(AppError);

      vi.unstubAllGlobals();
    });
  });
});
