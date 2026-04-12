import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquareService } from "../square.service";
import { AppError } from "@/lib/errors";
import { createEmptyCatalogSyncStats } from "@/repositories/integration.types";

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

const emptyCatalogStats = {
  itemsMapped: 0,
  itemsCreated: 0,
  itemsUpdated: 0,
  itemsSkipped: 0,
  variationsAsOptions: 0,
  modifierListsFlattened: 0,
  categoriesFlattened: 0,
  locationOverridesDropped: 0,
  imagesDropped: 0,
  taxesInclusive: 0,
  taxesAdditive: 0,
  discountsSkipped: 0,
  pricingRulesSkipped: 0,
  warnings: [],
};

vi.mock("../square-catalog.service", () => ({
  squareCatalogService: {
    fetchFullCatalog: vi.fn(() => ({
      categories: [],
      items: [],
      modifierLists: [],
      taxes: [],
      images: [],
    })),
    fetchIncrementalCatalog: vi.fn(() => ({
      categories: [],
      items: [],
      modifierLists: [],
      taxes: [],
      images: [],
      deletedIds: [],
    })),
    mapToMenuModels: vi.fn(() => ({
      categories: [],
      items: [],
      taxes: [],
      stats: { ...emptyCatalogStats },
    })),
  },
}));

vi.mock("../square-order.service", () => ({
  squareOrderService: {
    createOrder: vi.fn(() => ({
      success: true,
      squareOrderId: "sq-order-1",
    })),
    updateOrderStatus: vi.fn(),
    cancelOrder: vi.fn(),
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
    getLastSuccessfulSyncCursor: vi.fn(() => null),
  },
}));

vi.mock("@/lib/db", () => {
  // Universal tx mock that supports both guard and data transactions.
  // syncCatalog calls $transaction twice: 1st for concurrency guard, 2nd for data write.
  const mockTx = {
    // Guard transaction fields
    integrationSyncRecord: {
      findFirst: vi.fn(() => null), // no running sync by default
      create: vi.fn(() => ({ id: "sync-1" })),
    },
    // Data transaction fields
    menu: { findFirst: vi.fn(() => ({ id: "menu-1" })), create: vi.fn() },
    menuCategory: { upsert: vi.fn(), updateMany: vi.fn() },
    menuItem: { upsert: vi.fn(), updateMany: vi.fn() },
    menuCategoryItem: { upsert: vi.fn() },
    taxConfig: { upsert: vi.fn(), updateMany: vi.fn() },
    merchantTaxRate: { upsert: vi.fn(), updateMany: vi.fn() },
    modifierGroup: { upsert: vi.fn(), updateMany: vi.fn() },
    modifierOption: {
      upsert: vi.fn(),
      findUnique: vi.fn(() => null),
      updateMany: vi.fn(),
    },
    menuItemModifierGroup: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    externalIdMapping: {
      updateMany: vi.fn(),
    },
  };
  return {
    default: {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockTx)),
    },
    __mockTx: mockTx,
  };
});

vi.mock("@/services/menu", () => ({
  menuService: {
    syncModifierGroups: vi.fn().mockResolvedValue(undefined),
  },
}));

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
const { squareOrderService } = await import("../square-order.service");
const { squareCatalogService } = await import("../square-catalog.service");
const { __mockTx } = await import("@/lib/db") as unknown as {
  __mockTx: {
    integrationSyncRecord: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    menu: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    menuCategory: { upsert: ReturnType<typeof vi.fn> };
    menuItem: { upsert: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    taxConfig: { upsert: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    merchantTaxRate: { upsert: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    modifierGroup: { upsert: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    modifierOption: { upsert: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    externalIdMapping: { updateMany: ReturnType<typeof vi.fn> };
  };
};

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

    it("should return connected=true with undefined fields when null in DB", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce({
        id: "conn-1",
        tenantId: "t1",
        merchantId: "m1",
        type: "POS_SQUARE",
        category: "POS",
        status: "active",
        externalAccountId: null,
        externalLocationId: null,
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: null,
        scopes: "ITEMS_READ",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const status = await service.getConnectionStatus("t1", "m1");

      expect(status.connected).toBe(true);
      expect(status.externalAccountId).toBeUndefined();
      expect(status.externalLocationId).toBeUndefined();
      expect(status.tokenExpiresAt).toBeUndefined();
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
      // The concurrency guard now runs inside $transaction.
      // Mock the tx's findFirst to return a running sync record.
      __mockTx.integrationSyncRecord.findFirst.mockResolvedValueOnce({
        id: "sync-running",
        status: "running",
        startedAt: new Date(),
      });

      await expect(
        service.syncCatalog("t1", "m1")
      ).rejects.toMatchObject({ code: "SQUARE_SYNC_ALREADY_RUNNING" });
    });

    it("should throw INTEGRATION_NOT_CONNECTED if no connection", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        null
      );

      await expect(
        service.syncCatalog("t1", "m1")
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

      const result = await service.syncCatalog("t1", "m1");

      expect(result.objectsSynced).toBe(0);
      expect(result.objectsMapped).toBe(0);
      expect(integrationRepository.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({ status: "success" }),
        expect.anything()
      );
    });

    it("should mark sync as failed when catalog fetch throws", async () => {
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
        scopes: "ITEMS_READ",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(squareCatalogService.fetchFullCatalog).mockRejectedValueOnce(
        new Error("Square API down")
      );

      await expect(service.syncCatalog("t1", "m1")).rejects.toMatchObject({
        code: "SQUARE_CATALOG_SYNC_FAILED",
      });

      expect(integrationRepository.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({
          status: "failed",
          errorMessage: "Square API down",
        })
      );
    });
  });

  // Helper to create a valid connection mock
  const makeConnection = (overrides: Record<string, unknown> = {}) => ({
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
    scopes: "ITEMS_READ MERCHANT_PROFILE_READ ORDERS_WRITE",
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("pushOrder()", () => {
    it("should push order when connection exists", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());

      const result = await service.pushOrder("t1", "m1", {
        orderId: "order-1",
        orderNumber: "ORD-001",
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "555-1234",
        orderMode: "pickup",
        items: [],
        totalAmount: 10,
        taxAmount: 0,
        tipAmount: 0,
        deliveryFee: 0,
        discount: 0,
      });

      expect(squareOrderService.createOrder).toHaveBeenCalledWith(
        "t1",
        "m1",
        expect.objectContaining({ orderId: "order-1" })
      );
      expect(result.squareOrderId).toBeDefined();
    });

    it("should throw INTEGRATION_NOT_CONNECTED when no connection", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(null);

      await expect(
        service.pushOrder("t1", "m1", { orderId: "o-1", orderNumber: "ORD-001", customerFirstName: "J", customerLastName: "D", customerPhone: "555", orderMode: "pickup", items: [], totalAmount: 0, taxAmount: 0, tipAmount: 0, deliveryFee: 0, discount: 0 })
      ).rejects.toMatchObject({ code: "INTEGRATION_NOT_CONNECTED" });
    });

    it("should throw INTEGRATION_TOKEN_EXPIRED when no access token", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        makeConnection({ accessToken: null })
      );

      await expect(
        service.pushOrder("t1", "m1", { orderId: "o-1", orderNumber: "ORD-001", customerFirstName: "J", customerLastName: "D", customerPhone: "555", orderMode: "pickup", items: [], totalAmount: 0, taxAmount: 0, tipAmount: 0, deliveryFee: 0, discount: 0 })
      ).rejects.toMatchObject({ code: "INTEGRATION_TOKEN_EXPIRED" });
    });

    it("should refresh token when about to expire and use new token", async () => {
      const almostExpired = new Date(Date.now() + 2 * 60 * 1000); // 2 min from now
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        makeConnection({ tokenExpiresAt: almostExpired })
      );
      vi.mocked(squareOAuthService.refreshToken).mockResolvedValueOnce({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresAt: new Date("2026-12-31"),
        merchantId: "sq-merchant-1",
      });

      await service.pushOrder("t1", "m1", {
        orderId: "o-1",
        orderNumber: "ORD-001",
        customerFirstName: "J",
        customerLastName: "D",
        customerPhone: "555",
        orderMode: "pickup",
        items: [],
        totalAmount: 0,
        taxAmount: 0,
        tipAmount: 0,
        deliveryFee: 0,
        discount: 0,
      });

      expect(squareOAuthService.refreshToken).toHaveBeenCalledWith("refresh-456");
      expect(integrationRepository.updateTokens).toHaveBeenCalledWith("conn-1", {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        tokenExpiresAt: expect.any(Date),
      });
    });

    it("should throw INTEGRATION_TOKEN_EXPIRED when token expiring and no refresh token", async () => {
      const almostExpired = new Date(Date.now() + 2 * 60 * 1000);
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        makeConnection({ tokenExpiresAt: almostExpired, refreshToken: null })
      );

      await expect(
        service.pushOrder("t1", "m1", { orderId: "o-1", orderNumber: "ORD-001", customerFirstName: "J", customerLastName: "D", customerPhone: "555", orderMode: "pickup", items: [], totalAmount: 0, taxAmount: 0, tipAmount: 0, deliveryFee: 0, discount: 0 })
      ).rejects.toMatchObject({ code: "INTEGRATION_TOKEN_EXPIRED" });
    });
  });

  describe("updateOrderStatus()", () => {
    it("should delegate to squareOrderService when connected", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());

      await service.updateOrderStatus("t1", "m1", "order-1", "COMPLETED");

      expect(squareOrderService.updateOrderStatus).toHaveBeenCalledWith(
        "t1",
        "m1",
        "order-1",
        "COMPLETED"
      );
    });

    it("should throw INTEGRATION_NOT_CONNECTED when not connected", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(null);

      await expect(
        service.updateOrderStatus("t1", "m1", "order-1", "COMPLETED")
      ).rejects.toMatchObject({ code: "INTEGRATION_NOT_CONNECTED" });
    });
  });

  describe("handleOAuthCallback() - edge cases", () => {
    it("should handle empty locations array (no externalLocationId)", async () => {
      vi.mocked(squareOAuthService.listLocations).mockResolvedValueOnce([]);

      const result = await service.handleOAuthCallback("auth-code", "state-abc");

      expect(integrationRepository.upsertConnection).toHaveBeenCalledWith(
        "t1",
        "m1",
        expect.objectContaining({
          externalLocationId: undefined,
        })
      );
      expect(result.locations).toHaveLength(0);
    });
  });

  describe("syncCatalog() - full data", () => {
    it("should sync categories, items with modifiers, and taxes", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(squareCatalogService.mapToMenuModels).mockReturnValueOnce({
        categories: [
          { externalId: "sq-cat-1", name: "Appetizers", sortOrder: 0 },
          { externalId: "sq-cat-2", name: "Mains", sortOrder: 1 },
        ],
        items: [
          {
            externalId: "sq-item-1",
            name: "Spring Rolls",
            description: "Crispy rolls",
            price: 8.99,
            imageUrl: null,
            taxExternalIds: [],
            modifierGroups: [{ externalId: "sq-modlist-1", name: "Extra sauce", required: false, minSelect: 0, maxSelect: 1, options: [{ name: "Extra sauce", price: 0.5, externalId: "sq-mod-1", isDefault: false, ordinal: 0 }] }],
            categoryExternalIds: ["sq-cat-1"],
            variationMappings: [{ externalId: "sq-var-1", name: "Regular" }],
          },
          {
            externalId: "sq-item-2",
            name: "Steak",
            description: null,
            price: 24.99,
            imageUrl: null,
            taxExternalIds: [],
            modifierGroups: [],
            categoryExternalIds: ["sq-cat-2", "sq-cat-nonexistent"],
            variationMappings: [],
          },
        ],
        taxes: [
          { externalId: "sq-tax-1", name: "Sales Tax", percentage: 8.875, inclusionType: "additive" as const },
        ],
        stats: createEmptyCatalogSyncStats(),
      });

      const result = await service.syncCatalog("t1", "m1");

      expect(result.objectsSynced).toBe(5); // 2 categories + 2 items + 1 tax
      expect(result.objectsMapped).toBe(5);
      expect(integrationRepository.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({ status: "success", objectsSynced: 5, objectsMapped: 5 }),
        expect.anything()
      );
    });

    it("should create a default menu when none exists", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());

      // Override menu.findFirst to return null so a new menu is created
      __mockTx.menu.findFirst.mockResolvedValueOnce(null);
      __mockTx.menu.create.mockResolvedValueOnce({ id: "new-menu-1" });

      vi.mocked(squareCatalogService.mapToMenuModels).mockReturnValueOnce({
        categories: [{ externalId: "sq-cat-1", name: "Drinks", sortOrder: 0 }],
        items: [],
        taxes: [],
        stats: createEmptyCatalogSyncStats(),
      });

      const result = await service.syncCatalog("t1", "m1");

      expect(__mockTx.menu.create).toHaveBeenCalled();
      expect(result.objectsSynced).toBe(1);
    });

    it("should use existing mapping IDs when they exist", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValue({
        id: "mapping-1",
        tenantId: "t1",
        internalType: "MenuCategory",
        internalId: "existing-internal-id",
        externalSource: "SQUARE",
        externalType: "CATEGORY",
        externalId: "sq-cat-1",
        externalVersion: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(squareCatalogService.mapToMenuModels).mockReturnValueOnce({
        categories: [{ externalId: "sq-cat-1", name: "Existing Cat", sortOrder: 0 }],
        items: [],
        taxes: [],
        stats: createEmptyCatalogSyncStats(),
      });

      const result = await service.syncCatalog("t1", "m1");

      expect(result.objectsSynced).toBe(1);
      // Reset the mock back to default
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValue(null);
    });

    it("should refresh token during syncCatalog when token is expiring", async () => {
      const almostExpired = new Date(Date.now() + 2 * 60 * 1000);
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        makeConnection({ tokenExpiresAt: almostExpired })
      );
      vi.mocked(squareOAuthService.refreshToken).mockResolvedValueOnce({
        accessToken: "refreshed-token",
        refreshToken: "new-refresh",
        expiresAt: new Date("2026-12-31"),
        merchantId: "sq-merchant-1",
      });

      const result = await service.syncCatalog("t1", "m1");

      expect(squareOAuthService.refreshToken).toHaveBeenCalled();
      expect(squareCatalogService.fetchFullCatalog).toHaveBeenCalledWith("refreshed-token");
      expect(result.objectsSynced).toBe(0);
    });
  });

  describe("syncCatalog() - modifier table persistence", () => {
    it("should create ModifierOption external ID mappings for multi-variation items", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(squareCatalogService.mapToMenuModels).mockReturnValueOnce({
        categories: [{ externalId: "sq-cat-1", name: "Burgers", sortOrder: 0 }],
        items: [
          {
            externalId: "sq-item-1",
            name: "Classic Burger",
            description: null,
            price: 10.0,
            imageUrl: null,
            taxExternalIds: [],
            modifierGroups: [
              {
                externalId: null,
                name: "Size",
                required: true,
                minSelect: 1,
                maxSelect: 1,
                options: [
                  { name: "Regular", price: 0, externalId: "sq-var-r", isDefault: true, ordinal: 0 },
                  { name: "Large", price: 3, externalId: "sq-var-l", isDefault: false, ordinal: 1 },
                ],
              },
            ],
            categoryExternalIds: ["sq-cat-1"],
            variationMappings: [
              { externalId: "sq-var-r", name: "Regular", groupId: "grp-1", optionId: "opt-r" },
              { externalId: "sq-var-l", name: "Large", groupId: "grp-1", optionId: "opt-l" },
            ],
          },
        ],
        taxes: [],
        stats: createEmptyCatalogSyncStats(),
      });

      const result = await service.syncCatalog("t1", "m1");

      expect(result.objectsSynced).toBe(2); // 1 category + 1 item
      // Verify ModifierOption mappings were created for variations with groupId/optionId
      expect(integrationRepository.upsertIdMapping).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({
          internalType: "ModifierOption",
          internalId: "opt-r",
          externalType: "ITEM_VARIATION",
          externalId: "sq-var-r",
        }),
        expect.anything()
      );
    });

    it("should reuse existing ModifierOption group when mapping found", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      // Return an existing ModifierOption mapping for the first option's external ID
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockImplementation(
        async (_tenantId, _source, externalId) => {
          if (externalId === "sq-mod-existing") {
            return {
              id: "map-1",
              tenantId: "t1",
              internalType: "ModifierOption",
              internalId: "existing-opt-id",
              externalSource: "SQUARE",
              externalType: "MODIFIER",
              externalId: "sq-mod-existing",
              externalVersion: null,
              deleted: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          return null;
        }
      );

      // modifierOption.findUnique should return existing group
      __mockTx.menu.findFirst.mockResolvedValue({ id: "menu-1" });

      vi.mocked(squareCatalogService.mapToMenuModels).mockReturnValueOnce({
        categories: [],
        items: [
          {
            externalId: "sq-item-1",
            name: "Soup",
            description: null,
            price: 5.0,
            imageUrl: null,
            taxExternalIds: [],
            modifierGroups: [
              {
                externalId: "sq-modlist-addons",
                name: "Add-ons",
                required: false,
                minSelect: 0,
                maxSelect: 2,
                options: [
                  { name: "Bread", price: 1.5, externalId: "sq-mod-existing", isDefault: false, ordinal: 0 },
                ],
              },
            ],
            categoryExternalIds: [],
            variationMappings: [{ externalId: "sq-var-1", name: "Regular" }],
          },
        ],
        taxes: [],
        stats: createEmptyCatalogSyncStats(),
      });

      const result = await service.syncCatalog("t1", "m1");

      expect(result.objectsSynced).toBe(1); // 1 item
      // Reset mock
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValue(null);
    });
  });

  describe("syncCatalog() - error edge cases", () => {
    it("should handle non-Error thrown during sync", async () => {
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
        scopes: "ITEMS_READ",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(squareCatalogService.fetchFullCatalog).mockRejectedValueOnce(
        "string error"
      );

      await expect(service.syncCatalog("t1", "m1")).rejects.toMatchObject({
        code: "SQUARE_CATALOG_SYNC_FAILED",
      });

      expect(integrationRepository.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({
          status: "failed",
          errorMessage: "Unknown error",
        })
      );
    });

    it("should throw INTEGRATION_TOKEN_EXPIRED when no access token during sync", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce({
        id: "conn-1",
        tenantId: "t1",
        merchantId: "m1",
        type: "POS_SQUARE",
        category: "POS",
        status: "active",
        externalAccountId: "sq-merchant-1",
        externalLocationId: "loc-1",
        accessToken: null,
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date("2026-12-31"),
        scopes: "ITEMS_READ",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.syncCatalog("t1", "m1")).rejects.toMatchObject({
        code: "INTEGRATION_TOKEN_EXPIRED",
      });
    });
  });

  describe("cancelOrder()", () => {
    it("should delegate to squareOrderService when connected", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());

      await service.cancelOrder("t1", "m1", "order-1", "Customer request");

      expect(squareOrderService.cancelOrder).toHaveBeenCalledWith(
        "t1",
        "m1",
        "order-1",
        "Customer request"
      );
    });

    it("should throw INTEGRATION_NOT_CONNECTED when not connected", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(null);

      await expect(
        service.cancelOrder("t1", "m1", "order-1")
      ).rejects.toMatchObject({ code: "INTEGRATION_NOT_CONNECTED" });
    });
  });

  describe("syncCatalog() - incremental mode", () => {
    it("should fall back to full sync when no previous cursor exists", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(integrationRepository.getLastSuccessfulSyncCursor).mockResolvedValueOnce(null);

      const result = await service.syncCatalog("t1", "m1", true);

      expect(result.objectsSynced).toBe(0);
      expect(squareCatalogService.fetchFullCatalog).toHaveBeenCalledWith("access-123");
      expect(squareCatalogService.fetchIncrementalCatalog).not.toHaveBeenCalled();
    });

    it("should use incremental fetch when previous cursor exists", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(integrationRepository.getLastSuccessfulSyncCursor).mockResolvedValueOnce(
        "2026-04-01T00:00:00.000Z"
      );

      const result = await service.syncCatalog("t1", "m1", true);

      expect(result.objectsSynced).toBe(0);
      expect(squareCatalogService.fetchIncrementalCatalog).toHaveBeenCalledWith(
        "access-123",
        "2026-04-01T00:00:00.000Z"
      );
      expect(squareCatalogService.fetchFullCatalog).not.toHaveBeenCalled();
    });

    it("should fall back to full sync when incremental fetch fails", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(integrationRepository.getLastSuccessfulSyncCursor).mockResolvedValueOnce(
        "2026-04-01T00:00:00.000Z"
      );
      vi.mocked(squareCatalogService.fetchIncrementalCatalog).mockRejectedValueOnce(
        new Error("Square search API error")
      );

      const result = await service.syncCatalog("t1", "m1", true);

      expect(result.objectsSynced).toBe(0);
      // Should have fallen back to full
      expect(squareCatalogService.fetchFullCatalog).toHaveBeenCalledWith("access-123");
    });

    it("should store cursor timestamp on successful sync", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());

      await service.syncCatalog("t1", "m1");

      expect(integrationRepository.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({
          status: "success",
          cursor: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
        expect.anything()
      );
    });

    it("should soft-delete mapped objects when deletedIds returned from incremental sync", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(integrationRepository.getLastSuccessfulSyncCursor).mockResolvedValueOnce(
        "2026-04-01T00:00:00.000Z"
      );
      vi.mocked(squareCatalogService.fetchIncrementalCatalog).mockResolvedValueOnce({
        categories: [],
        items: [],
        modifierLists: [],
        taxes: [],
        images: [],
        deletedIds: ["sq-cat-deleted", "sq-item-deleted"],
      });
      // Mock the ID mapping lookups for deleted objects
      vi.mocked(integrationRepository.getIdMappingByExternalId)
        .mockResolvedValueOnce({
          id: "map-1",
          tenantId: "t1",
          internalType: "MenuCategory",
          internalId: "internal-cat-1",
          externalSource: "SQUARE",
          externalType: "CATEGORY",
          externalId: "sq-cat-deleted",
          externalVersion: null,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "map-2",
          tenantId: "t1",
          internalType: "MenuItem",
          internalId: "internal-item-1",
          externalSource: "SQUARE",
          externalType: "ITEM",
          externalId: "sq-item-deleted",
          externalVersion: null,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const result = await service.syncCatalog("t1", "m1", true);

      expect(result.objectsSynced).toBe(0);
      expect(__mockTx.menuCategory.upsert).not.toHaveBeenCalled();
      // Verify soft-delete was called on the externalIdMapping
      expect(__mockTx.externalIdMapping.updateMany).toHaveBeenCalledTimes(2);
    });

    it("should soft-delete merchantTaxRate when TaxConfig is deleted incrementally", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(integrationRepository.getLastSuccessfulSyncCursor).mockResolvedValueOnce(
        "2026-04-01T00:00:00.000Z"
      );
      vi.mocked(squareCatalogService.fetchIncrementalCatalog).mockResolvedValueOnce({
        categories: [],
        items: [],
        modifierLists: [],
        taxes: [],
        images: [],
        deletedIds: ["sq-tax-deleted"],
      });
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValueOnce({
        id: "map-tax",
        tenantId: "t1",
        internalType: "TaxConfig",
        internalId: "internal-tax-1",
        externalSource: "SQUARE",
        externalType: "TAX",
        externalId: "sq-tax-deleted",
        externalVersion: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.syncCatalog("t1", "m1", true);

      expect(__mockTx.taxConfig.updateMany).toHaveBeenCalledWith({
        where: { id: "internal-tax-1", tenantId: "t1" },
        data: { deleted: true },
      });
      expect(__mockTx.merchantTaxRate.updateMany).toHaveBeenCalledWith({
        where: { taxConfigId: "internal-tax-1", deleted: false },
        data: { deleted: true },
      });
    });

    it("should soft-delete ModifierGroup and its options when deleted incrementally", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(integrationRepository.getLastSuccessfulSyncCursor).mockResolvedValueOnce(
        "2026-04-01T00:00:00.000Z"
      );
      vi.mocked(squareCatalogService.fetchIncrementalCatalog).mockResolvedValueOnce({
        categories: [],
        items: [],
        modifierLists: [],
        taxes: [],
        images: [],
        deletedIds: ["sq-modlist-deleted"],
      });
      vi.mocked(integrationRepository.getIdMappingByExternalId).mockResolvedValueOnce({
        id: "map-modgroup",
        tenantId: "t1",
        internalType: "ModifierGroup",
        internalId: "internal-modgroup-1",
        externalSource: "SQUARE",
        externalType: "MODIFIER_LIST",
        externalId: "sq-modlist-deleted",
        externalVersion: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.syncCatalog("t1", "m1", true);

      expect(__mockTx.modifierGroup.updateMany).toHaveBeenCalledWith({
        where: { id: "internal-modgroup-1", tenantId: "t1" },
        data: { deleted: true },
      });
      expect(__mockTx.modifierOption.updateMany).toHaveBeenCalledWith({
        where: { groupId: "internal-modgroup-1" },
        data: { deleted: true },
      });
    });

    it("should use CATALOG_INCREMENTAL sync type for incremental sync", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());
      vi.mocked(integrationRepository.getLastSuccessfulSyncCursor).mockResolvedValueOnce(
        "2026-04-01T00:00:00.000Z"
      );

      await service.syncCatalog("t1", "m1", true);

      expect(__mockTx.integrationSyncRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          syncType: "CATALOG_INCREMENTAL",
        }),
      });
    });
  });
});
