import { describe, it, expect, vi, beforeEach } from "vitest";
import { gbpService } from "../gbp.service";
import { AppError } from "@/lib/errors";

vi.mock("../gbp-oauth.service", () => ({
  gbpOAuthService: {
    buildAuthorizationUrl: vi.fn(
      () => "https://accounts.google.com/o/oauth2/v2/auth?state=abc"
    ),
    verifyAndParseState: vi.fn(() => ({
      tenantId: "t1",
      merchantId: "m1",
      returnUrl: "http://example.com",
    })),
    exchangeCode: vi.fn(() => ({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: new Date("2026-05-08"),
    })),
    refreshToken: vi.fn(() => ({
      accessToken: "new-access-789",
      refreshToken: "new-refresh-012",
      expiresAt: new Date("2026-06-08"),
    })),
  },
}));

vi.mock("../gbp-location.service", () => ({
  gbpLocationService: {
    listAccounts: vi.fn(() => [
      { name: "accounts/123", accountName: "My Restaurant", type: "PERSONAL" },
    ]),
    listLocations: vi.fn(() => [
      { name: "locations/456", title: "Downtown Branch" },
    ]),
    getLocation: vi.fn(() => ({
      name: "locations/456",
      title: "Downtown Branch",
      phoneNumbers: { primaryPhone: "+1234567890" },
    })),
    mapLocationToMerchantData: vi.fn(() => ({
      phone: "+1234567890",
    })),
  },
}));

vi.mock("../gbp.config", () => ({
  gbpConfig: {
    enabled: true,
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    oauthStateSecret: "test-secret",
    oauthRedirectUrl:
      "http://localhost:3000/api/integration/gbp/oauth/callback",
    assertConfigured: vi.fn(),
  },
}));

vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    getConnection: vi.fn(),
    upsertConnection: vi.fn(() => ({ id: "conn-1" })),
    updateTokens: vi.fn(),
    softDeleteConnection: vi.fn(),
    createSyncRecord: vi.fn(() => ({ id: "sync-1" })),
    updateSyncRecord: vi.fn(),
  },
}));

describe("GbpService", () => {
  const service = gbpService;
  let mockGbpOAuth: Record<string, ReturnType<typeof vi.fn>>;
  let mockGbpLocation: Record<string, ReturnType<typeof vi.fn>>;
  let mockIntegrationRepo: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const oauthModule = await import("../gbp-oauth.service");
    mockGbpOAuth =
      oauthModule.gbpOAuthService as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;

    const locationModule = await import("../gbp-location.service");
    mockGbpLocation =
      locationModule.gbpLocationService as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;

    const repoModule = await import("@/repositories/integration.repository");
    mockIntegrationRepo =
      repoModule.integrationRepository as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
  });

  describe("getAuthorizationUrl()", () => {
    it("should delegate to gbpOAuthService.buildAuthorizationUrl", () => {
      const url = service.getAuthorizationUrl("t1", "m1", "/dashboard");

      expect(mockGbpOAuth.buildAuthorizationUrl).toHaveBeenCalledWith(
        "t1",
        "m1",
        "/dashboard"
      );
      expect(url).toContain("https://accounts.google.com");
    });
  });

  describe("handleOAuthCallback()", () => {
    it("should verify state, exchange code, list accounts, and store connection", async () => {
      const result = await service.handleOAuthCallback(
        "code-abc",
        "state-xyz"
      );

      expect(mockGbpOAuth.verifyAndParseState).toHaveBeenCalledWith(
        "state-xyz"
      );
      expect(mockGbpOAuth.exchangeCode).toHaveBeenCalledWith("code-abc");
      expect(mockGbpLocation.listAccounts).toHaveBeenCalledWith("access-123");
      expect(mockIntegrationRepo.upsertConnection).toHaveBeenCalledWith(
        "t1",
        "m1",
        expect.objectContaining({
          type: "LISTING_GBP",
          category: "LISTING",
          externalAccountId: "accounts/123",
          accessToken: "access-123",
          refreshToken: "refresh-456",
        })
      );
      expect(result.returnUrl).toBe("http://example.com");
      expect(result.accounts).toHaveLength(1);
    });

    it("should store connection without account info when listAccounts fails", async () => {
      mockGbpLocation.listAccounts.mockRejectedValue(
        new Error("GBP API quota exceeded")
      );

      const result = await service.handleOAuthCallback(
        "code-abc",
        "state-xyz"
      );

      expect(mockIntegrationRepo.upsertConnection).toHaveBeenCalledWith(
        "t1",
        "m1",
        expect.objectContaining({
          type: "LISTING_GBP",
          externalAccountId: undefined,
          accessToken: "access-123",
          refreshToken: "refresh-456",
        })
      );
      expect(result.returnUrl).toBe("http://example.com");
      expect(result.accounts).toHaveLength(0);
    });
  });

  describe("getConnectionStatus()", () => {
    it("should return connected: false when no connection exists", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue(null);

      const status = await service.getConnectionStatus("t1", "m1");

      expect(status).toEqual({ connected: false });
    });

    it("should return connection details when connected", async () => {
      const expiresAt = new Date("2026-05-08");
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        externalAccountId: "accounts/123",
        externalLocationId: "locations/456",
        tokenExpiresAt: expiresAt,
      });

      const status = await service.getConnectionStatus("t1", "m1");

      expect(status).toEqual({
        connected: true,
        externalAccountId: "accounts/123",
        externalLocationId: "locations/456",
        tokenExpiresAt: expiresAt,
      });
    });

    it("should map null fields to undefined in connection status", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        externalAccountId: null,
        externalLocationId: null,
        tokenExpiresAt: null,
      });

      const status = await service.getConnectionStatus("t1", "m1");

      expect(status).toEqual({
        connected: true,
        externalAccountId: undefined,
        externalLocationId: undefined,
        tokenExpiresAt: undefined,
      });
    });
  });

  describe("disconnect()", () => {
    it("should soft delete the connection", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
      });

      await service.disconnect("t1", "m1");

      expect(mockIntegrationRepo.softDeleteConnection).toHaveBeenCalledWith(
        "conn-1"
      );
    });

    it("should throw AppError when not connected", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue(null);

      await expect(service.disconnect("t1", "m1")).rejects.toThrow(AppError);
    });
  });

  describe("listLocations()", () => {
    it("should list locations for a connected merchant", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        externalAccountId: "accounts/123",
      });

      const locations = await service.listLocations("t1", "m1");

      expect(mockGbpLocation.listLocations).toHaveBeenCalledWith(
        "access-123",
        "accounts/123"
      );
      expect(locations).toHaveLength(1);
    });

    it("should throw AppError when not connected", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue(null);

      await expect(service.listLocations("t1", "m1")).rejects.toThrow(
        AppError
      );
    });

    it("should throw AppError when no external account ID", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        externalAccountId: null,
      });

      await expect(service.listLocations("t1", "m1")).rejects.toThrow(
        AppError
      );
    });
  });

  describe("syncLocation()", () => {
    it("should fetch location, map data, and create sync record", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        externalAccountId: "accounts/123",
        externalLocationId: null,
        scopes: "https://www.googleapis.com/auth/business.manage",
      });

      const result = await service.syncLocation("t1", "m1", "locations/456");

      expect(mockGbpLocation.getLocation).toHaveBeenCalledWith(
        "access-123",
        "locations/456"
      );
      expect(mockGbpLocation.mapLocationToMerchantData).toHaveBeenCalled();
      expect(mockIntegrationRepo.createSyncRecord).toHaveBeenCalledWith(
        "t1",
        "conn-1",
        "LOCATION_SYNC"
      );
      expect(mockIntegrationRepo.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({ status: "success" })
      );
      expect(result.merchantData).toEqual({ phone: "+1234567890" });
    });

    it("should handle null connection fields when syncing location", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "access-123",
        refreshToken: null,
        tokenExpiresAt: null,
        externalAccountId: null,
        externalLocationId: null,
        scopes: null,
      });

      const result = await service.syncLocation("t1", "m1", "locations/456");

      expect(mockIntegrationRepo.upsertConnection).toHaveBeenCalledWith(
        "t1",
        "m1",
        expect.objectContaining({
          externalAccountId: undefined,
          accessToken: "access-123",
          refreshToken: undefined,
          tokenExpiresAt: undefined,
          scopes: undefined,
        })
      );
      expect(result.merchantData).toEqual({ phone: "+1234567890" });
    });

    it("should throw AppError when not connected", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue(null);

      await expect(
        service.syncLocation("t1", "m1", "locations/456")
      ).rejects.toThrow(AppError);
    });

    it("should mark sync as failed and re-throw AppError when getLocation throws AppError", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        externalAccountId: "accounts/123",
        externalLocationId: null,
        scopes: "https://www.googleapis.com/auth/business.manage",
      });

      const appError = new AppError("GBP_ACCOUNT_FETCH_FAILED" as never, undefined, 500);
      mockGbpLocation.getLocation.mockRejectedValue(appError);

      await expect(
        service.syncLocation("t1", "m1", "locations/456")
      ).rejects.toThrow(AppError);

      expect(mockIntegrationRepo.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({
          status: "failed",
        })
      );
    });

    it("should mark sync as failed and throw GBP_SYNC_FAILED for non-AppError", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        externalAccountId: "accounts/123",
        externalLocationId: null,
        scopes: "https://www.googleapis.com/auth/business.manage",
      });

      mockGbpLocation.getLocation.mockRejectedValue(new Error("Network error"));

      await expect(
        service.syncLocation("t1", "m1", "locations/456")
      ).rejects.toMatchObject({ code: "GBP_SYNC_FAILED" });

      expect(mockIntegrationRepo.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({
          status: "failed",
          errorMessage: "Network error",
        })
      );
    });

    it("should handle non-Error thrown during sync", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        externalAccountId: "accounts/123",
        externalLocationId: null,
        scopes: "https://www.googleapis.com/auth/business.manage",
      });

      mockGbpLocation.getLocation.mockRejectedValue("string error");

      await expect(
        service.syncLocation("t1", "m1", "locations/456")
      ).rejects.toMatchObject({ code: "GBP_SYNC_FAILED" });

      expect(mockIntegrationRepo.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({
          status: "failed",
          errorMessage: "Unknown error",
        })
      );
    });
  });

  describe("token refresh (ensureValidToken)", () => {
    it("should refresh token when it expires within 5 minutes", async () => {
      const almostExpired = new Date(Date.now() + 2 * 60 * 1000);
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "old-access",
        refreshToken: "old-refresh",
        tokenExpiresAt: almostExpired,
        externalAccountId: "accounts/123",
      });

      await service.listLocations("t1", "m1");

      expect(mockGbpOAuth.refreshToken).toHaveBeenCalledWith("old-refresh");
      expect(mockIntegrationRepo.updateTokens).toHaveBeenCalledWith(
        "conn-1",
        expect.objectContaining({
          accessToken: "new-access-789",
          refreshToken: "new-refresh-012",
        })
      );
    });

    it("should not refresh token when it is still valid", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "valid-access",
        refreshToken: "valid-refresh",
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        externalAccountId: "accounts/123",
      });

      await service.listLocations("t1", "m1");

      expect(mockGbpOAuth.refreshToken).not.toHaveBeenCalled();
    });

    it("should skip refresh when tokenExpiresAt is null", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "valid-access",
        refreshToken: null,
        tokenExpiresAt: null,
        externalAccountId: "accounts/123",
      });

      await service.listLocations("t1", "m1");

      expect(mockGbpOAuth.refreshToken).not.toHaveBeenCalled();
      expect(mockGbpLocation.listLocations).toHaveBeenCalledWith(
        "valid-access",
        "accounts/123"
      );
    });

    it("should throw when no access token exists", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        externalAccountId: "accounts/123",
      });

      await expect(service.listLocations("t1", "m1")).rejects.toThrow(
        AppError
      );
    });

    it("should throw when token expired and no refresh token available", async () => {
      mockIntegrationRepo.getConnection.mockResolvedValue({
        id: "conn-1",
        accessToken: "old-access",
        refreshToken: null,
        tokenExpiresAt: new Date(Date.now() - 1000),
        externalAccountId: "accounts/123",
      });

      await expect(service.listLocations("t1", "m1")).rejects.toThrow(
        AppError
      );
    });
  });
});
