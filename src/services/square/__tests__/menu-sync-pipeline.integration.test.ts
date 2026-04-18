/**
 * E2E Integration tests for Menu Sync Pipeline.
 *
 * Verifies the full chain:
 *   Square POS API (mocked) → SquareService.syncCatalog → DB → MenuService.getMenu
 *
 * Covers:
 * - Happy path: full catalog sync
 * - Idempotency: re-sync produces no duplicates
 * - Incremental updates: catalog changes sync correctly
 * - Concurrency: two simultaneous syncs handled properly
 * - Data consistency: getMenu returns correct data after sync
 * - Error handling: failed sync doesn't leave partial data
 * - Multi-tenant isolation
 * - Soft delete restoration
 *
 * Run with: npx vitest run --config vitest.config.integration.ts
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { generateEntityId } from "@/lib/id";
import { squareService } from "../square.service";
import { squareCatalogService } from "../square-catalog.service";
import type { SquareCatalogResult } from "../square-catalog.service";

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  "mysql://root:password@localhost:3306/plovr_test";

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

// ==================== Test IDs ====================
const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const CONNECTION_ID = generateEntityId();

// Second tenant for isolation tests
const TENANT_B_ID = generateEntityId();
const MERCHANT_B_ID = generateEntityId();
const CONNECTION_B_ID = generateEntityId();

// ==================== Mock Square Catalog Factory ====================

/**
 * Build a mock SquareCatalogResult with realistic CatalogObject shapes.
 * External IDs are deterministic for assertions.
 */
function buildMockCatalog(config: {
  categories?: Array<{ id: string; name: string }>;
  items?: Array<{
    id: string;
    name: string;
    description?: string;
    priceCents: number;
    categoryId?: string;
    taxIds?: string[];
    variations?: Array<{ id: string; name: string; priceCents: number }>;
    modifierLists?: Array<{
      id: string;
      name: string;
      selectionType?: string;
      modifiers: Array<{ id: string; name: string; priceCents: number }>;
    }>;
  }>;
  taxes?: Array<{ id: string; name: string; percentage: string; inclusionType?: string }>;
}): SquareCatalogResult {
  const categories = (config.categories ?? []).map((c) => ({
    id: c.id,
    type: "CATEGORY" as const,
    categoryData: { name: c.name },
  }));

  const modifierLists = (config.items ?? [])
    .flatMap((item) => item.modifierLists ?? [])
    .map((ml) => ({
      id: ml.id,
      type: "MODIFIER_LIST" as const,
      modifierListData: {
        name: ml.name,
        selectionType: ml.selectionType ?? "MULTIPLE",
        modifiers: ml.modifiers.map((mod) => ({
          id: mod.id,
          type: "MODIFIER" as const,
          modifierData: {
            name: mod.name,
            priceMoney: { amount: BigInt(mod.priceCents), currency: "USD" },
            ordinal: 0,
          },
        })),
      },
    }));

  const items = (config.items ?? []).map((item) => {
    const variations = item.variations ?? [
      { id: `${item.id}-var-default`, name: "Regular", priceCents: item.priceCents },
    ];
    return {
      id: item.id,
      type: "ITEM" as const,
      itemData: {
        name: item.name,
        description: item.description ?? null,
        descriptionPlaintext: item.description ?? null,
        categoryId: item.categoryId ?? undefined,
        taxIds: item.taxIds ?? [],
        productType: "REGULAR",
        variations: variations.map((v) => ({
          id: v.id,
          type: "ITEM_VARIATION" as const,
          itemVariationData: {
            name: v.name,
            priceMoney: { amount: BigInt(v.priceCents), currency: "USD" },
            pricingType: "FIXED_PRICING",
            ordinal: 0,
          },
        })),
        modifierListInfo: (item.modifierLists ?? []).map((ml) => ({
          modifierListId: ml.id,
          enabled: true,
        })),
        imageIds: [],
      },
    };
  });

  const taxes = (config.taxes ?? []).map((t) => ({
    id: t.id,
    type: "TAX" as const,
    taxData: {
      name: t.name,
      percentage: t.percentage,
      enabled: true,
      inclusionType: t.inclusionType ?? "ADDITIVE",
    },
  }));

  // Cast to SquareCatalogResult — the real SDK types are complex,
  // but mapToMenuModels only accesses the fields we provide.
  return {
    categories,
    items,
    modifierLists,
    taxes,
    images: [],
  } as unknown as SquareCatalogResult;
}

// ==================== DB Helpers ====================

async function countSyncTables(tenantId: string, merchantId: string) {
  const [
    menus,
    categories,
    items,
    categoryItems,
    taxConfigs,
    merchantTaxRates,
    idMappings,
    modifierGroups,
    modifierOptions,
    menuItemModifierGroups,
    syncRecords,
  ] = await Promise.all([
    prisma.menu.count({ where: { tenantId, deleted: false } }),
    prisma.menuCategory.count({ where: { tenantId, deleted: false } }),
    prisma.menuItem.count({ where: { tenantId, deleted: false } }),
    prisma.menuCategoryItem.count({ where: { tenantId, deleted: false } }),
    prisma.taxConfig.count({ where: { tenantId, deleted: false } }),
    prisma.merchantTaxRate.count({ where: { merchantId, deleted: false } }),
    prisma.externalIdMapping.count({ where: { tenantId, deleted: false } }),
    prisma.modifierGroup.count({ where: { tenantId, deleted: false } }),
    prisma.modifierOption.count({ where: { tenantId, deleted: false } }),
    prisma.menuItemModifierGroup.count({
      where: { menuItem: { tenantId } },
    }),
    prisma.integrationSyncRecord.count({ where: { tenantId } }),
  ]);
  return {
    menus,
    categories,
    items,
    categoryItems,
    taxConfigs,
    merchantTaxRates,
    idMappings,
    modifierGroups,
    modifierOptions,
    menuItemModifierGroups,
    syncRecords,
  };
}

async function resetMenuData(tenantId: string, merchantId: string) {
  // Delete in FK-safe order
  await prisma.menuItemModifierGroup.deleteMany({
    where: { menuItem: { tenantId } },
  });
  await prisma.modifierOption.deleteMany({ where: { tenantId } });
  await prisma.modifierGroup.deleteMany({ where: { tenantId } });
  await prisma.menuItemTax.deleteMany({ where: { tenantId } });
  await prisma.merchantTaxRate.deleteMany({ where: { merchantId } });
  await prisma.menuCategoryItem.deleteMany({ where: { tenantId } });
  await prisma.featuredItem.deleteMany({ where: { tenantId } });
  await prisma.menuItem.deleteMany({ where: { tenantId } });
  await prisma.menuCategory.deleteMany({ where: { tenantId } });
  await prisma.menu.deleteMany({ where: { tenantId } });
  await prisma.taxConfig.deleteMany({ where: { tenantId } });
  await prisma.externalIdMapping.deleteMany({ where: { tenantId } });
  await prisma.integrationSyncRecord.deleteMany({ where: { tenantId } });
}

async function seedTestData() {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Menu Sync Test Tenant",
      slug: `menu-sync-${Date.now()}`,
    },
  });

  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `menu-sync-merchant-${Date.now()}`,
      name: "Test Merchant",
    },
  });

  await prisma.integrationConnection.create({
    data: {
      id: CONNECTION_ID,
      tenantId: TENANT_ID,
      merchantId: MERCHANT_ID,
      type: "POS_SQUARE",
      category: "POS",
      status: "active",
      externalAccountId: "sq-test-account",
      externalLocationId: "sq-test-location",
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      scopes: "ITEMS_READ MERCHANT_PROFILE_READ",
    },
  });
}

async function cleanupTestData() {
  // Tenant A
  await resetMenuData(TENANT_ID, MERCHANT_ID);
  await prisma.webhookEvent.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationConnection.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });

  // Tenant B (if created)
  await resetMenuData(TENANT_B_ID, MERCHANT_B_ID);
  await prisma.integrationConnection.deleteMany({ where: { tenantId: TENANT_B_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_B_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_B_ID } });
}

// ==================== Test Suite ====================

describe("Menu Sync Pipeline (Integration)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await cleanupTestData();
    await seedTestData();

    // Mock only the external Square API boundary
    fetchSpy = vi.spyOn(squareCatalogService, "fetchFullCatalog");
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await cleanupTestData();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await resetMenuData(TENANT_ID, MERCHANT_ID);
    fetchSpy.mockReset();
  });

  // ==================== A. Happy Path ====================

  describe("Happy Path — Full Sync", () => {
    it("should sync a complete catalog: categories, items, and taxes", async () => {
      const catalog = buildMockCatalog({
        categories: [
          { id: "sq-cat-1", name: "Appetizers" },
          { id: "sq-cat-2", name: "Mains" },
        ],
        items: [
          { id: "sq-item-1", name: "Spring Rolls", priceCents: 899, categoryId: "sq-cat-1" },
          { id: "sq-item-2", name: "Steak", priceCents: 2499, categoryId: "sq-cat-2", description: "Juicy grilled steak" },
          { id: "sq-item-3", name: "Salad", priceCents: 1199, categoryId: "sq-cat-1" },
        ],
        taxes: [
          { id: "sq-tax-1", name: "Sales Tax", percentage: "8.875" },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      const result = await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // 2 categories + 3 items + 1 tax = 6
      expect(result.objectsSynced).toBe(6);
      expect(result.objectsMapped).toBe(6);

      // Verify DB state
      const counts = await countSyncTables(TENANT_ID, MERCHANT_ID);
      expect(counts.menus).toBe(1);
      expect(counts.categories).toBe(2);
      expect(counts.items).toBe(3);
      expect(counts.categoryItems).toBe(3); // each item in one category
      expect(counts.taxConfigs).toBe(1);
      expect(counts.merchantTaxRates).toBe(1);

      // Verify category names
      const cats = await prisma.menuCategory.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
        orderBy: { sortOrder: "asc" },
      });
      expect(cats.map((c) => c.name)).toEqual(["Appetizers", "Mains"]);

      // Verify item names and prices
      const items = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
        orderBy: { name: "asc" },
      });
      expect(items.map((i) => i.name)).toEqual(["Salad", "Spring Rolls", "Steak"]);
      expect(Number(items.find((i) => i.name === "Steak")!.price)).toBe(24.99);

      // Verify sync record
      const syncRecords = await prisma.integrationSyncRecord.findMany({
        where: { tenantId: TENANT_ID },
        orderBy: { startedAt: "desc" },
      });
      expect(syncRecords[0].status).toBe("success");
      expect(syncRecords[0].objectsSynced).toBe(6);

      // Verify external ID mappings
      const mappings = await prisma.externalIdMapping.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(mappings.length).toBeGreaterThanOrEqual(6); // categories + items + variations + tax
    });

    it("should create a default 'Main Menu' when none exists", async () => {
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Drinks" }],
        items: [],
        taxes: [],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const menus = await prisma.menu.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(menus).toHaveLength(1);
      expect(menus[0].name).toBe("Main Menu");
    });
  });

  // ==================== B. Data Consistency ====================

  describe("Data Consistency — getMenu Round-Trip", () => {
    it("should produce a correct getMenu response after sync", async () => {
      const catalog = buildMockCatalog({
        categories: [
          { id: "sq-cat-1", name: "Burgers" },
          { id: "sq-cat-2", name: "Drinks" },
        ],
        items: [
          { id: "sq-item-1", name: "Classic Burger", priceCents: 1099, categoryId: "sq-cat-1" },
          { id: "sq-item-2", name: "Lemonade", priceCents: 499, categoryId: "sq-cat-2" },
        ],
        taxes: [
          { id: "sq-tax-1", name: "Sales Tax", percentage: "8.875" },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // Use MenuService to read back
      const { menuService } = await import("@/services/menu");
      const menu = await menuService.getMenu(TENANT_ID, MERCHANT_ID);

      expect(menu.merchantName).toBe("Test Merchant");
      expect(menu.categories.length).toBeGreaterThanOrEqual(2);

      // Find non-featured categories
      const burgers = menu.categories.find((c) => c.name === "Burgers");
      const drinks = menu.categories.find((c) => c.name === "Drinks");
      expect(burgers).toBeDefined();
      expect(drinks).toBeDefined();
      expect(burgers!.menuItems).toHaveLength(1);
      expect(burgers!.menuItems[0].name).toBe("Classic Burger");
      expect(Number(burgers!.menuItems[0].price)).toBe(10.99);
    });

    it("should preserve modifier groups through sync and read", async () => {
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Burgers" }],
        items: [
          {
            id: "sq-item-1",
            name: "Burger",
            priceCents: 1099,
            categoryId: "sq-cat-1",
            variations: [
              { id: "sq-var-sm", name: "Small", priceCents: 1099 },
              { id: "sq-var-lg", name: "Large", priceCents: 1399 },
            ],
          },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // Verify modifier group and options persisted
      const modGroups = await prisma.modifierGroup.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
        include: { options: { where: { deleted: false }, orderBy: { sortOrder: "asc" } } },
      });
      expect(modGroups).toHaveLength(1);
      expect(modGroups[0].name).toBe("Options");
      expect(modGroups[0].required).toBe(true);
      expect(modGroups[0].options).toHaveLength(2);
      expect(modGroups[0].options.map((o) => o.name)).toEqual(["Small", "Large"]);
      // Price delta: Large costs $3 more than base price
      expect(Number(modGroups[0].options[1].price)).toBe(3);
    });
  });

  // ==================== C. Idempotency ====================

  describe("Idempotency — Re-Sync", () => {
    it("should produce identical results when syncing the same catalog twice", async () => {
      const catalog = buildMockCatalog({
        categories: [
          { id: "sq-cat-1", name: "Appetizers" },
          { id: "sq-cat-2", name: "Mains" },
        ],
        items: [
          { id: "sq-item-1", name: "Soup", priceCents: 699, categoryId: "sq-cat-1" },
          { id: "sq-item-2", name: "Steak", priceCents: 2499, categoryId: "sq-cat-2" },
        ],
        taxes: [
          { id: "sq-tax-1", name: "Sales Tax", percentage: "8.875" },
        ],
      });

      // First sync
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      const countsAfterFirst = await countSyncTables(TENANT_ID, MERCHANT_ID);

      // Record IDs
      const categoriesAfterFirst = await prisma.menuCategory.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      const itemsAfterFirst = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });

      // Second sync (identical catalog)
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      const countsAfterSecond = await countSyncTables(TENANT_ID, MERCHANT_ID);

      // Counts should match (except syncRecords which increases)
      expect(countsAfterSecond.menus).toBe(countsAfterFirst.menus);
      expect(countsAfterSecond.categories).toBe(countsAfterFirst.categories);
      expect(countsAfterSecond.items).toBe(countsAfterFirst.items);
      expect(countsAfterSecond.categoryItems).toBe(countsAfterFirst.categoryItems);
      expect(countsAfterSecond.taxConfigs).toBe(countsAfterFirst.taxConfigs);
      expect(countsAfterSecond.merchantTaxRates).toBe(countsAfterFirst.merchantTaxRates);

      // IDs should be identical (upserts hit existing rows)
      const categoriesAfterSecond = await prisma.menuCategory.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      const itemsAfterSecond = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(categoriesAfterSecond.map((c) => c.id).sort()).toEqual(
        categoriesAfterFirst.map((c) => c.id).sort()
      );
      expect(itemsAfterSecond.map((i) => i.id).sort()).toEqual(
        itemsAfterFirst.map((i) => i.id).sort()
      );
    });

    it("should not create duplicate MenuCategoryItem records on re-sync", async () => {
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Pizza" }],
        items: [
          { id: "sq-item-1", name: "Margherita", priceCents: 1499, categoryId: "sq-cat-1" },
        ],
      });

      // Two syncs
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      const countBefore = await prisma.menuCategoryItem.count({
        where: { tenantId: TENANT_ID },
      });

      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      const countAfter = await prisma.menuCategoryItem.count({
        where: { tenantId: TENANT_ID },
      });

      expect(countAfter).toBe(countBefore);
    });

    it("should not create duplicate MerchantTaxRate records on re-sync", async () => {
      const catalog = buildMockCatalog({
        categories: [],
        items: [],
        taxes: [
          { id: "sq-tax-1", name: "Sales Tax", percentage: "8.875" },
        ],
      });

      // Two syncs
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      const countBefore = await prisma.merchantTaxRate.count({
        where: { merchantId: MERCHANT_ID },
      });

      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      const countAfter = await prisma.merchantTaxRate.count({
        where: { merchantId: MERCHANT_ID },
      });

      expect(countAfter).toBe(countBefore);
      expect(countAfter).toBe(1);
    });
  });

  // ==================== D. Incremental Updates ====================

  describe("Incremental Updates", () => {
    it("should add new items when catalog grows", async () => {
      // First sync: 1 item
      const catalog1 = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Burgers" }],
        items: [
          { id: "sq-item-1", name: "Classic Burger", priceCents: 1099, categoryId: "sq-cat-1" },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog1);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const originalItem = await prisma.menuItem.findFirst({
        where: { tenantId: TENANT_ID, deleted: false },
      });

      // Second sync: 2 items (one new)
      const catalog2 = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Burgers" }],
        items: [
          { id: "sq-item-1", name: "Classic Burger", priceCents: 1099, categoryId: "sq-cat-1" },
          { id: "sq-item-2", name: "Cheese Burger", priceCents: 1299, categoryId: "sq-cat-1" },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog2);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const items = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
        orderBy: { name: "asc" },
      });
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.name)).toEqual(["Cheese Burger", "Classic Burger"]);

      // Original item ID unchanged
      const classicBurger = items.find((i) => i.name === "Classic Burger");
      expect(classicBurger!.id).toBe(originalItem!.id);
    });

    it("should update existing item name and price on re-sync", async () => {
      // First sync
      const catalog1 = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Burgers" }],
        items: [
          { id: "sq-item-1", name: "Burger", priceCents: 1000, categoryId: "sq-cat-1" },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog1);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const originalItem = await prisma.menuItem.findFirst({
        where: { tenantId: TENANT_ID, deleted: false },
      });

      // Second sync: same external ID, updated name and price
      const catalog2 = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Burgers" }],
        items: [
          { id: "sq-item-1", name: "Deluxe Burger", priceCents: 1200, categoryId: "sq-cat-1" },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog2);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const updatedItem = await prisma.menuItem.findFirst({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(updatedItem!.id).toBe(originalItem!.id); // Same internal ID
      expect(updatedItem!.name).toBe("Deluxe Burger");
      expect(Number(updatedItem!.price)).toBe(12);
    });

    it("should add new categories and taxes in subsequent syncs", async () => {
      // First sync: 1 category, no taxes
      const catalog1 = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Mains" }],
        items: [],
        taxes: [],
      });
      fetchSpy.mockResolvedValueOnce(catalog1);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // Second sync: 2 categories, 1 tax
      const catalog2 = buildMockCatalog({
        categories: [
          { id: "sq-cat-1", name: "Mains" },
          { id: "sq-cat-2", name: "Desserts" },
        ],
        items: [],
        taxes: [{ id: "sq-tax-1", name: "VAT", percentage: "10" }],
      });
      fetchSpy.mockResolvedValueOnce(catalog2);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const cats = await prisma.menuCategory.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(cats).toHaveLength(2);

      const taxes = await prisma.taxConfig.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(taxes).toHaveLength(1);
      expect(taxes[0].name).toBe("VAT");
    });
  });

  // ==================== D.1 Incremental Soft Delete ====================

  describe("Incremental Soft Delete", () => {
    it("should soft-delete categories, items, taxes, modifier groups, and their external ID mappings when Square reports them deleted", async () => {
      // First sync: seed a category with an item (that carries variations so a
      // modifier group/options are also created), a tax, and a merchant tax
      // rate — everything we want to watch get deleted.
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Seed Category" }],
        items: [
          {
            id: "sq-item-1",
            name: "Seed Item",
            priceCents: 999,
            categoryId: "sq-cat-1",
            variations: [
              { id: "sq-var-s", name: "Small", priceCents: 999 },
              { id: "sq-var-l", name: "Large", priceCents: 1299 },
            ],
          },
        ],
        taxes: [{ id: "sq-tax-1", name: "Sales Tax", percentage: "8.875" }],
      });
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // Sanity — everything we care about is present.
      const before = await countSyncTables(TENANT_ID, MERCHANT_ID);
      expect(before.categories).toBe(1);
      expect(before.items).toBe(1);
      expect(before.taxConfigs).toBe(1);
      expect(before.merchantTaxRates).toBe(1);
      expect(before.modifierGroups).toBe(1);
      expect(before.modifierOptions).toBe(2);

      // Grab ids so we can verify each row was soft-deleted individually.
      const catId = (await prisma.menuCategory.findFirstOrThrow({
        where: { tenantId: TENANT_ID, deleted: false },
      })).id;
      const itemId = (await prisma.menuItem.findFirstOrThrow({
        where: { tenantId: TENANT_ID, deleted: false },
      })).id;
      const taxId = (await prisma.taxConfig.findFirstOrThrow({
        where: { tenantId: TENANT_ID, deleted: false },
      })).id;
      const modGroupId = (await prisma.modifierGroup.findFirstOrThrow({
        where: { tenantId: TENANT_ID, deleted: false },
      })).id;

      // The modifier group was auto-created from variations so it does not
      // have its own external mapping. To exercise the ModifierGroup branch
      // of soft-delete, write a MODIFIER_LIST mapping manually.
      const modListExtId = "sq-modlist-del-1";
      await prisma.externalIdMapping.create({
        data: {
          id: generateEntityId(),
          tenantId: TENANT_ID,
          internalType: "ModifierGroup",
          internalId: modGroupId,
          externalSource: "SQUARE",
          externalType: "MODIFIER_LIST",
          externalId: modListExtId,
        },
      });

      // Second sync (incremental) reports everything deleted.
      const fetchIncrementalSpy = vi.spyOn(
        squareCatalogService,
        "fetchIncrementalCatalog"
      );
      fetchIncrementalSpy.mockResolvedValueOnce({
        categories: [],
        items: [],
        modifierLists: [],
        taxes: [],
        images: [],
        deletedIds: ["sq-cat-1", "sq-item-1", "sq-tax-1", modListExtId],
      });

      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID, true);

      // Category + item + tax + tax rate all soft-deleted, each scoped to
      // the correct row (not a mass-delete).
      const deletedCat = await prisma.menuCategory.findUniqueOrThrow({
        where: { id: catId },
      });
      expect(deletedCat.deleted).toBe(true);

      const deletedItem = await prisma.menuItem.findUniqueOrThrow({
        where: { id: itemId },
      });
      expect(deletedItem.deleted).toBe(true);

      const deletedTax = await prisma.taxConfig.findUniqueOrThrow({
        where: { id: taxId },
      });
      expect(deletedTax.deleted).toBe(true);
      const deletedRate = await prisma.merchantTaxRate.findFirstOrThrow({
        where: { taxConfigId: taxId, merchantId: MERCHANT_ID },
      });
      expect(deletedRate.deleted).toBe(true);

      // Modifier group + its options soft-deleted.
      const deletedGroup = await prisma.modifierGroup.findUniqueOrThrow({
        where: { id: modGroupId },
      });
      expect(deletedGroup.deleted).toBe(true);
      const deletedOpts = await prisma.modifierOption.findMany({
        where: { groupId: modGroupId },
      });
      expect(deletedOpts.length).toBe(2);
      expect(deletedOpts.every((o) => o.deleted)).toBe(true);

      // The external ID mappings themselves are soft-deleted so the next
      // sync won't try to re-delete (and the same external ID can be
      // re-used for a brand-new internal record later).
      const deletedMappings = await prisma.externalIdMapping.findMany({
        where: {
          tenantId: TENANT_ID,
          externalSource: "SQUARE",
          externalId: {
            in: ["sq-cat-1", "sq-item-1", "sq-tax-1", modListExtId],
          },
        },
      });
      expect(deletedMappings).toHaveLength(4);
      expect(deletedMappings.every((m) => m.deleted)).toBe(true);

      fetchIncrementalSpy.mockRestore();
    });
  });

  // ==================== E. Soft Delete Restoration ====================

  describe("Soft Delete Restoration", () => {
    it("should restore a soft-deleted category on re-sync", async () => {
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Pasta" }],
        items: [],
      });

      // Sync and then soft-delete the category
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const cat = await prisma.menuCategory.findFirst({
        where: { tenantId: TENANT_ID },
      });
      await prisma.menuCategory.update({
        where: { id: cat!.id },
        data: { deleted: true },
      });

      // Verify it's deleted
      const deleted = await prisma.menuCategory.findFirst({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(deleted).toBeNull();

      // Re-sync should restore it
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const restored = await prisma.menuCategory.findFirst({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(restored).not.toBeNull();
      expect(restored!.name).toBe("Pasta");
      expect(restored!.id).toBe(cat!.id); // Same ID
    });

    it("should restore a soft-deleted item on re-sync", async () => {
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Mains" }],
        items: [
          { id: "sq-item-1", name: "Steak", priceCents: 2499, categoryId: "sq-cat-1" },
        ],
      });

      // Sync and then soft-delete the item
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const item = await prisma.menuItem.findFirst({
        where: { tenantId: TENANT_ID },
      });
      await prisma.menuItem.update({
        where: { id: item!.id },
        data: { deleted: true },
      });

      // Re-sync should restore it
      fetchSpy.mockResolvedValueOnce(catalog);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const restored = await prisma.menuItem.findFirst({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(restored).not.toBeNull();
      expect(restored!.name).toBe("Steak");
      expect(restored!.id).toBe(item!.id);
    });
  });

  // ==================== F. Concurrency ====================

  describe("Concurrency", () => {
    it("should reject a concurrent sync when one is already running", async () => {
      // Manually insert a running sync record
      await prisma.integrationSyncRecord.create({
        data: {
          id: generateEntityId(),
          tenantId: TENANT_ID,
          connectionId: CONNECTION_ID,
          syncType: "CATALOG_FULL",
          status: "running",
          startedAt: new Date(), // Recent, not stale
        },
      });

      await expect(
        squareService.syncCatalog(TENANT_ID, MERCHANT_ID)
      ).rejects.toMatchObject({ code: "SQUARE_SYNC_ALREADY_RUNNING" });
    });

    it("should allow a sync after a stale running record (>10 min old)", async () => {
      // Insert a stale running record (15 minutes old)
      await prisma.integrationSyncRecord.create({
        data: {
          id: generateEntityId(),
          tenantId: TENANT_ID,
          connectionId: CONNECTION_ID,
          syncType: "CATALOG_FULL",
          status: "running",
          startedAt: new Date(Date.now() - 15 * 60 * 1000),
        },
      });

      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Test" }],
        items: [],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      // Should succeed — stale record is ignored
      const result = await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      expect(result.objectsSynced).toBe(1);
    });

    it("should handle two truly concurrent sync attempts — exactly one succeeds", async () => {
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Concurrent" }],
        items: [
          { id: "sq-item-1", name: "Pizza", priceCents: 1500, categoryId: "sq-cat-1" },
        ],
      });

      // Both calls get the same catalog
      fetchSpy.mockResolvedValue(catalog);

      const [resultA, resultB] = await Promise.allSettled([
        squareService.syncCatalog(TENANT_ID, MERCHANT_ID),
        squareService.syncCatalog(TENANT_ID, MERCHANT_ID),
      ]);

      const succeeded = [resultA, resultB].filter((r) => r.status === "fulfilled");
      const failed = [resultA, resultB].filter((r) => r.status === "rejected");

      // Exactly one should succeed
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      const failReason = (failed[0] as PromiseRejectedResult).reason;
      // With FOR UPDATE lock the loser is always caught by the guard
      expect(failReason.code).toBe("SQUARE_SYNC_ALREADY_RUNNING");

      // DB state should be consistent — only one sync's data
      const counts = await countSyncTables(TENANT_ID, MERCHANT_ID);
      expect(counts.categories).toBe(1);
      expect(counts.items).toBe(1);
    });
  });

  // ==================== G. Multi-Tenant Isolation ====================

  describe("Multi-Tenant Isolation", () => {
    beforeAll(async () => {
      // Create second tenant
      await prisma.tenant.create({
        data: {
          id: TENANT_B_ID,
          name: "Tenant B",
          slug: `tenant-b-${Date.now()}`,
        },
      });
      await prisma.merchant.create({
        data: {
          id: MERCHANT_B_ID,
          tenantId: TENANT_B_ID,
          slug: `merchant-b-${Date.now()}`,
          name: "Merchant B",
        },
      });
      await prisma.integrationConnection.create({
        data: {
          id: CONNECTION_B_ID,
          tenantId: TENANT_B_ID,
          merchantId: MERCHANT_B_ID,
          type: "POS_SQUARE",
          category: "POS",
          status: "active",
          externalAccountId: "sq-acct-b",
          accessToken: "token-b",
          refreshToken: "refresh-b",
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          scopes: "ITEMS_READ",
        },
      });
    });

    afterAll(async () => {
      await resetMenuData(TENANT_B_ID, MERCHANT_B_ID);
      await prisma.integrationConnection.deleteMany({ where: { tenantId: TENANT_B_ID } });
      await prisma.merchant.deleteMany({ where: { tenantId: TENANT_B_ID } });
      await prisma.tenant.deleteMany({ where: { id: TENANT_B_ID } });
    });

    it("should isolate menu data between tenants", async () => {
      // Sync Tenant A: Burgers
      const catalogA = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Burgers" }],
        items: [
          { id: "sq-item-1", name: "Classic Burger", priceCents: 1099, categoryId: "sq-cat-1" },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalogA);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // Sync Tenant B: Sushi
      const catalogB = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Sushi" }],
        items: [
          { id: "sq-item-1", name: "Salmon Roll", priceCents: 1599, categoryId: "sq-cat-1" },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalogB);
      await squareService.syncCatalog(TENANT_B_ID, MERCHANT_B_ID);

      // Verify isolation
      const tenantAItems = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      const tenantBItems = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_B_ID, deleted: false },
      });

      expect(tenantAItems).toHaveLength(1);
      expect(tenantAItems[0].name).toBe("Classic Burger");

      expect(tenantBItems).toHaveLength(1);
      expect(tenantBItems[0].name).toBe("Salmon Roll");

      // IDs should be different even though Square external IDs are the same
      expect(tenantAItems[0].id).not.toBe(tenantBItems[0].id);
    });
  });

  // ==================== H. Error Handling ====================

  describe("Error Handling & Transaction Atomicity", () => {
    it("should mark sync as failed when Square API fetch throws", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("Square API rate limited"));

      await expect(
        squareService.syncCatalog(TENANT_ID, MERCHANT_ID)
      ).rejects.toMatchObject({ code: "SQUARE_CATALOG_SYNC_FAILED" });

      // Verify sync record is failed
      const records = await prisma.integrationSyncRecord.findMany({
        where: { tenantId: TENANT_ID },
        orderBy: { startedAt: "desc" },
      });
      expect(records.length).toBeGreaterThanOrEqual(1);
      expect(records[0].status).toBe("failed");
      expect(records[0].errorMessage).toContain("Square API rate limited");
    });

    it("should not leave orphaned data when transaction fails", async () => {
      // Return a catalog, but make the transaction fail by having
      // the mapping produce data that triggers a constraint violation.
      // We spy on mapToMenuModels to throw midway through the transaction.
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Test" }],
        items: [],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      const mapSpy = vi.spyOn(squareCatalogService, "mapToMenuModels");
      mapSpy.mockImplementationOnce(() => {
        throw new Error("Mapping explosion");
      });

      await expect(
        squareService.syncCatalog(TENANT_ID, MERCHANT_ID)
      ).rejects.toMatchObject({ code: "SQUARE_CATALOG_SYNC_FAILED" });

      // No menu data should exist (transaction rolled back)
      const counts = await countSyncTables(TENANT_ID, MERCHANT_ID);
      expect(counts.menus).toBe(0);
      expect(counts.categories).toBe(0);
      expect(counts.items).toBe(0);

      mapSpy.mockRestore();
    });

    it("should not block subsequent syncs after a failed sync", async () => {
      // First sync fails
      fetchSpy.mockRejectedValueOnce(new Error("Temporary failure"));
      await expect(
        squareService.syncCatalog(TENANT_ID, MERCHANT_ID)
      ).rejects.toThrow();

      // Verify no running sync records
      const runningRecords = await prisma.integrationSyncRecord.findMany({
        where: { tenantId: TENANT_ID, status: "running" },
      });
      expect(runningRecords).toHaveLength(0);

      // Second sync should succeed
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Recovery" }],
        items: [],
      });
      fetchSpy.mockResolvedValueOnce(catalog);
      const result = await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      expect(result.objectsSynced).toBe(1);
    });
  });

  // ==================== I. Edge Cases ====================

  describe("Edge Cases", () => {
    it("should handle an empty catalog (no categories, items, or taxes)", async () => {
      const catalog = buildMockCatalog({
        categories: [],
        items: [],
        taxes: [],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      const result = await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      expect(result.objectsSynced).toBe(0);
      expect(result.objectsMapped).toBe(0);

      // A default "Main Menu" should still be created
      const menus = await prisma.menu.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(menus).toHaveLength(1);
      expect(menus[0].name).toBe("Main Menu");
    });

    it("should handle items with no category associations", async () => {
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Drinks" }],
        items: [
          // Item with no categoryId — uncategorized
          { id: "sq-item-1", name: "Mystery Dish", priceCents: 999 },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const items = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe("Mystery Dish");

      // No junction rows for this item
      const junctions = await prisma.menuCategoryItem.findMany({
        where: { tenantId: TENANT_ID, menuItemId: items[0].id },
      });
      expect(junctions).toHaveLength(0);
    });

    it("should handle items with multiple variations creating correct external ID mappings", async () => {
      const catalog = buildMockCatalog({
        categories: [{ id: "sq-cat-1", name: "Coffee" }],
        items: [
          {
            id: "sq-item-1",
            name: "Latte",
            priceCents: 400,
            categoryId: "sq-cat-1",
            variations: [
              { id: "sq-var-s", name: "Small", priceCents: 400 },
              { id: "sq-var-m", name: "Medium", priceCents: 500 },
              { id: "sq-var-l", name: "Large", priceCents: 600 },
            ],
          },
        ],
      });
      fetchSpy.mockResolvedValueOnce(catalog);

      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // Should have 1 ITEM mapping
      const itemMappings = await prisma.externalIdMapping.findMany({
        where: {
          tenantId: TENANT_ID,
          externalSource: "SQUARE",
          externalType: "ITEM",
          deleted: false,
        },
      });
      expect(itemMappings).toHaveLength(1);

      // Check ALL mappings created for this tenant
      const allMappings = await prisma.externalIdMapping.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });

      // For a 3-variation item, the sync creates mappings in this order per variation:
      // 1. ModifierOption/ITEM_VARIATION (from variation loop)
      // 2. MenuItem/ITEM_VARIATION (backward-compat, overwrites #1 since same externalId)
      // 3. ModifierOption/MODIFIER (from syncModifierGroups, overwrites #2)
      // Final state: each variation has a ModifierOption/MODIFIER mapping
      const variationModifierMappings = allMappings.filter(
        (m) => m.externalType === "MODIFIER" && m.internalType === "ModifierOption"
      );
      expect(variationModifierMappings).toHaveLength(3);

      // Verify the ModifierOption mappings reference existing modifier options
      for (const mapping of variationModifierMappings) {
        const option = await prisma.modifierOption.findUnique({
          where: { id: mapping.internalId },
        });
        expect(option).not.toBeNull();
      }

      // Verify the ITEM mapping exists and points to the correct MenuItem
      expect(itemMappings).toHaveLength(1);
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: itemMappings[0].internalId },
      });
      expect(menuItem).not.toBeNull();
      expect(menuItem!.name).toBe("Latte");
    });

    it("should update tax rate correctly on re-sync with changed percentage", async () => {
      // First sync with 8.875% tax
      const catalog1 = buildMockCatalog({
        categories: [],
        items: [],
        taxes: [{ id: "sq-tax-1", name: "Sales Tax", percentage: "8.875" }],
      });
      fetchSpy.mockResolvedValueOnce(catalog1);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const rateBefore = await prisma.merchantTaxRate.findFirst({
        where: { merchantId: MERCHANT_ID, deleted: false },
      });
      // Decimal(5,4) rounds to 4 decimal places: 8.875/100 = 0.08875 → 0.0888
      expect(Number(rateBefore!.rate)).toBeCloseTo(0.08875, 3);

      // Second sync with updated rate
      const catalog2 = buildMockCatalog({
        categories: [],
        items: [],
        taxes: [{ id: "sq-tax-1", name: "Sales Tax", percentage: "9.5" }],
      });
      fetchSpy.mockResolvedValueOnce(catalog2);
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      const rateAfter = await prisma.merchantTaxRate.findFirst({
        where: { merchantId: MERCHANT_ID, deleted: false },
      });
      expect(Number(rateAfter!.rate)).toBeCloseTo(0.095, 4);
      // Same ID (upserted, not duplicated)
      expect(rateAfter!.id).toBe(rateBefore!.id);
    });
  });
});
