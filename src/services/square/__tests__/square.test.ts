import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquareService } from "../square.service";
import { AppError } from "@/lib/errors";

vi.mock("../square-oauth.service", () => ({
  squareOAuthService: {
    buildAuthorizationUrl: vi.fn(() => "https://square.com/oauth?state=abc"),
    verifyAndParseState: vi.fn(() => ({
      tenantId: "t1",
      merchantId: "m1",
      returnUrl: "http://example.com",
    })),
    exchangeCode: vi.fn(() => ({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: new Date("2026-05-08"),
      merchantId: "sq-merchant-1",
    })),
    refreshToken: vi.fn(),
    listLocations: vi.fn(() => [
      { id: "loc-1", name: "Main St", status: "ACTIVE" },
    ]),
  },
}));

vi.mock("../square-catalog.service", () => ({
  squareCatalogService: {
    fetchFullCatalog: vi.fn(() => ({
      categories: [],
      items: [],
      modifierLists: [],
      taxes: [],
    })),
    mapToMenuModels: vi.fn(() => ({
      categories: [],
      items: [],
      taxes: [],
    })),
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
    getRunningSync: vi.fn(() => null),
    upsertIdMapping: vi.fn(),
    getIdMappingByExternalId: vi.fn(() => null),
  },
}));

vi.mock("@/lib/db", () => {
  const mockTx = {
    menu: { findFirst: vi.fn(() => ({ id: "menu-1" })), create: vi.fn() },
    menuCategory: { upsert: vi.fn() },
    menuItem: { upsert: vi.fn() },
    menuCategoryItem: { upsert: vi.fn() },
    taxConfig: { upsert: vi.fn() },
    merchantTaxRate: { upsert: vi.fn() },
  };
  return {
    default: {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockTx)),
    },
  };
});

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(
    () => "gen-" + Math.random().toString(36).slice(2, 8)
  ),
}));

vi.mock("../square.config", () => ({
  squareConfig: {
    enabled: true,
    assertConfigured: vi.fn(),
  },
}));

// Import mocks after vi.mock calls
const { squareOAuthService } = await import("../square-oauth.service");
const { integrationRepository } = await import(
  "@/repositories/integration.repository"
);

describe("SquareService", () => {
  let service: SquareService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SquareService();
  });

  describe("getAuthorizationUrl()", () => {
    it("should return OAuth URL from squareOAuthService", () => {
      const url = service.getAuthorizationUrl(
        "t1",
        "m1",
        "http://example.com/return"
      );

      expect(url).toBe("https://square.com/oauth?state=abc");
      expect(squareOAuthService.buildAuthorizationUrl).toHaveBeenCalledWith(
        "t1",
        "m1",
        "http://example.com/return"
      );
    });
  });

  describe("handleOAuthCallback()", () => {
    it("should exchange code, store connection via upsertConnection, and return data", async () => {
      const result = await service.handleOAuthCallback("auth-code", "state-abc");

      expect(squareOAuthService.verifyAndParseState).toHaveBeenCalledWith(
        "state-abc"
      );
      expect(squareOAuthService.exchangeCode).toHaveBeenCalledWith("auth-code");
      expect(squareOAuthService.listLocations).toHaveBeenCalledWith(
        "access-123"
      );
      expect(integrationRepository.upsertConnection).toHaveBeenCalledWith(
        "t1",
        "m1",
        expect.objectContaining({
          type: "POS_SQUARE",
          category: "POS",
          accessToken: "access-123",
          refreshToken: "refresh-456",
          externalAccountId: "sq-merchant-1",
          externalLocationId: "loc-1",
        })
      );
      expect(result.returnUrl).toBe("http://example.com");
      expect(result.locations).toHaveLength(1);
      expect(result.locations[0].id).toBe("loc-1");
    });
  });

  describe("getConnectionStatus()", () => {
    it("should return connected=false when no connection exists", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        null
      );

      const status = await service.getConnectionStatus("t1", "m1");

      expect(status).toEqual({ connected: false });
    });

    it("should return connected=true with details when connection exists", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce({
        id: "conn-1",
        tenantId: "t1",
        merchantId: "m1",
        type: "POS_SQUARE",
        category: "POS",
        status: "active",
        externalAccountId: "sq-merchant-1",
        externalLocationId: "loc-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date("2026-05-08"),
        scopes: "ITEMS_READ MERCHANT_PROFILE_READ",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const status = await service.getConnectionStatus("t1", "m1");

      expect(status.connected).toBe(true);
      expect(status.externalAccountId).toBe("sq-merchant-1");
      expect(status.externalLocationId).toBe("loc-1");
      expect(status.tokenExpiresAt).toEqual(new Date("2026-05-08"));
    });
  });

  describe("disconnect()", () => {
    it("should soft delete connection when connected", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce({
        id: "conn-1",
        tenantId: "t1",
        merchantId: "m1",
        type: "POS_SQUARE",
        category: "POS",
        status: "active",
        externalAccountId: "sq-merchant-1",
        externalLocationId: "loc-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date("2026-05-08"),
        scopes: "ITEMS_READ MERCHANT_PROFILE_READ",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.disconnect("t1", "m1");

      expect(integrationRepository.softDeleteConnection).toHaveBeenCalledWith(
        "conn-1"
      );
    });

    it("should throw INTEGRATION_NOT_CONNECTED when not connected", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        null
      );

      await expect(service.disconnect("t1", "m1")).rejects.toThrow(AppError);
      await expect(service.disconnect("t1", "m1")).rejects.toMatchObject({
        code: "INTEGRATION_NOT_CONNECTED",
      });
    });
  });

  describe("syncCatalog()", () => {
    it("should reject with SQUARE_SYNC_ALREADY_RUNNING if sync is already running", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce({
        id: "conn-1",
        tenantId: "t1",
        merchantId: "m1",
        type: "POS_SQUARE",
        category: "POS",
        status: "active",
        externalAccountId: "sq-merchant-1",
        externalLocationId: "loc-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date("2026-12-31"),
        scopes: "ITEMS_READ MERCHANT_PROFILE_READ",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(integrationRepository.getRunningSync).mockResolvedValueOnce({
        id: "sync-running",
        tenantId: "t1",
        connectionId: "conn-1",
        syncType: "CATALOG_FULL",
        status: "running",
        startedAt: new Date(),
        finishedAt: null,
        objectsSynced: 0,
        objectsMapped: 0,
        errorMessage: null,
        cursor: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.syncCatalog("t1", "m1", "c1")
      ).rejects.toMatchObject({ code: "SQUARE_SYNC_ALREADY_RUNNING" });
    });

    it("should throw INTEGRATION_NOT_CONNECTED if no connection", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        null
      );

      await expect(
        service.syncCatalog("t1", "m1", "c1")
      ).rejects.toMatchObject({ code: "INTEGRATION_NOT_CONNECTED" });
    });

    it("should complete sync and return objectsSynced=0 for empty catalog", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce({
        id: "conn-1",
        tenantId: "t1",
        merchantId: "m1",
        type: "POS_SQUARE",
        category: "POS",
        status: "active",
        externalAccountId: "sq-merchant-1",
        externalLocationId: "loc-1",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date("2026-12-31"),
        scopes: "ITEMS_READ MERCHANT_PROFILE_READ",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.syncCatalog("t1", "m1", "c1");

      expect(result.objectsSynced).toBe(0);
      expect(result.objectsMapped).toBe(0);
      expect(integrationRepository.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({ status: "success" })
      );
    });
  });
});
