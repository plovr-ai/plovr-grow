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
      itemOptions: [],
      measurementUnits: [],
      images: [],
    })),
    mapToMenuModels: vi.fn(() => ({
      categories: [],
      items: [],
      taxes: [],
      measurementUnits: [],
    })),
  },
}));

// Test factories to satisfy expanded Mapped* types without repeating every field.
function makeCategory(
  overrides: Partial<{ externalId: string; name: string; sortOrder: number }>,
) {
  return {
    externalId: "sq-cat",
    name: "Cat",
    sortOrder: 0,
    imageUrl: null,
    sourceMetadata: {},
    ...overrides,
  };
}
function makeOption(
  overrides: Partial<{ name: string; price: number; externalId: string }>,
) {
  return {
    name: "Option",
    price: 0,
    externalId: "opt",
    isDefault: false,
    ordinal: null,
    kitchenName: null,
    imageUrl: null,
    hiddenOnline: false,
    ...overrides,
  };
}
function makeGroup(
  overrides: Partial<{
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: ReturnType<typeof makeOption>[];
  }>,
) {
  return {
    name: "Group",
    type: "single" as const,
    required: false,
    minSelect: 0,
    maxSelect: 1,
    ordinal: null,
    allowQuantity: false,
    hiddenFromCustomer: false,
    internalName: null,
    sourceKind: "MODIFIER_LIST" as const,
    sourceExternalId: null,
    options: [],
    ...overrides,
  };
}
function makeVariation(
  overrides: Partial<{ externalId: string; name: string }>,
) {
  return {
    externalId: "var",
    name: "Regular",
    sku: null,
    upc: null,
    pricingType: "FIXED" as const,
    priceAmount: 0,
    measurementUnitId: null,
    ordinal: 0,
    sellable: true,
    stockable: true,
    itemOptionValues: [],
    ...overrides,
  };
}
function makeItem(
  overrides: Partial<{
    externalId: string;
    name: string;
    description: string | null;
    price: number;
    modifiers: { groups: ReturnType<typeof makeGroup>[] } | null;
    categoryExternalIds: string[];
    variationMappings: ReturnType<typeof makeVariation>[];
  }>,
) {
  return {
    externalId: "item",
    name: "Item",
    description: null,
    price: 0,
    pricingType: "FIXED" as const,
    kitchenName: null,
    imageUrl: null,
    categoryExternalIds: [],
    tags: [],
    taxExternalIds: [],
    modifiers: null,
    variationMappings: [],
    sourceMetadata: {},
    ...overrides,
  };
}
function makeTax(
  overrides: Partial<{ externalId: string; name: string; percentage: number }>,
) {
  return {
    externalId: "tax",
    name: "Tax",
    percentage: 0,
    inclusionType: "ADDITIVE" as const,
    calculationPhase: "SUBTOTAL" as const,
    appliesToCustomAmounts: false,
    ...overrides,
  };
}

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
const { squareOrderService } = await import("../square-order.service");
const { squareCatalogService } = await import("../square-catalog.service");

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
        expect.objectContaining({ status: "success" })
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
        service.pushOrder("t1", "m1", { orderId: "o-1", orderNumber: "ORD-001", customerFirstName: "J", customerLastName: "D", customerPhone: "555", orderMode: "pickup", items: [], totalAmount: 0 })
      ).rejects.toMatchObject({ code: "INTEGRATION_NOT_CONNECTED" });
    });

    it("should throw INTEGRATION_TOKEN_EXPIRED when no access token", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(
        makeConnection({ accessToken: null })
      );

      await expect(
        service.pushOrder("t1", "m1", { orderId: "o-1", orderNumber: "ORD-001", customerFirstName: "J", customerLastName: "D", customerPhone: "555", orderMode: "pickup", items: [], totalAmount: 0 })
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
        service.pushOrder("t1", "m1", { orderId: "o-1", orderNumber: "ORD-001", customerFirstName: "J", customerLastName: "D", customerPhone: "555", orderMode: "pickup", items: [], totalAmount: 0 })
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
          makeCategory({ externalId: "sq-cat-1", name: "Appetizers", sortOrder: 0 }),
          makeCategory({ externalId: "sq-cat-2", name: "Mains", sortOrder: 1 }),
        ],
        items: [
          makeItem({
            externalId: "sq-item-1",
            name: "Spring Rolls",
            description: "Crispy rolls",
            price: 8.99,
            modifiers: {
              groups: [
                makeGroup({
                  name: "Extra sauce",
                  options: [makeOption({ name: "Extra sauce", price: 0.5, externalId: "sq-mod-1" })],
                }),
              ],
            },
            categoryExternalIds: ["sq-cat-1"],
            variationMappings: [makeVariation({ externalId: "sq-var-1", name: "Regular" })],
          }),
          makeItem({
            externalId: "sq-item-2",
            name: "Steak",
            description: null,
            price: 24.99,
            modifiers: null,
            categoryExternalIds: ["sq-cat-2", "sq-cat-nonexistent"],
            variationMappings: [],
          }),
        ],
        taxes: [makeTax({ externalId: "sq-tax-1", name: "Sales Tax", percentage: 8.875 })],
        measurementUnits: [],
      });

      const result = await service.syncCatalog("t1", "m1");

      expect(result.objectsSynced).toBe(5); // 2 categories + 2 items + 1 tax
      expect(result.objectsMapped).toBe(5);
      expect(integrationRepository.updateSyncRecord).toHaveBeenCalledWith(
        "sync-1",
        expect.objectContaining({ status: "success", objectsSynced: 5, objectsMapped: 5 })
      );
    });

    it("should create a default menu when none exists", async () => {
      vi.mocked(integrationRepository.getConnection).mockResolvedValueOnce(makeConnection());

      // Override the mock $transaction to use a tx with no menu
      const prisma = (await import("@/lib/db")).default;
      const mockTx = {
        menu: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "new-menu-1" }),
        },
        menuCategory: { upsert: vi.fn() },
        menuItem: { upsert: vi.fn() },
        menuCategoryItem: { upsert: vi.fn() },
        taxConfig: { upsert: vi.fn() },
        merchantTaxRate: { upsert: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(
        ((fn: (tx: unknown) => unknown) => fn(mockTx) as Promise<unknown>) as never
      );

      vi.mocked(squareCatalogService.mapToMenuModels).mockReturnValueOnce({
        categories: [makeCategory({ externalId: "sq-cat-1", name: "Drinks", sortOrder: 0 })],
        items: [],
        taxes: [],
        measurementUnits: [],
      });

      const result = await service.syncCatalog("t1", "m1");

      expect(mockTx.menu.create).toHaveBeenCalled();
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
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(squareCatalogService.mapToMenuModels).mockReturnValueOnce({
        categories: [makeCategory({ externalId: "sq-cat-1", name: "Existing Cat", sortOrder: 0 })],
        items: [],
        taxes: [],
        measurementUnits: [],
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
});
