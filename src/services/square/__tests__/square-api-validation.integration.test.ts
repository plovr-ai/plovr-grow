/**
 * Square Sandbox API Validation Integration Test.
 *
 * Validates the full Catalog Sync pipeline against the real Square Sandbox API.
 * Requires SQUARE_SANDBOX_ACCESS_TOKEN to be set (skipped otherwise).
 *
 * IMPORTANT: All expected values are derived directly from raw Square API
 * CatalogObject data — NOT from mapToMenuModels(). This ensures we're testing
 * that the pipeline correctly transforms API data, not just that it's
 * internally consistent.
 *
 * Run with: npx vitest run --config vitest.config.integration.ts square-api-validation
 * Requires: MySQL running + SQUARE_SANDBOX_ACCESS_TOKEN set
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { SquareClient, SquareEnvironment } from "square";
import type { CatalogObject } from "square";
import { generateEntityId } from "@/lib/id";
import { squareCatalogService } from "@/services/square/square-catalog.service";
import { squareService } from "@/services/square/square.service";
import type { SquareCatalogResult } from "@/services/square/square-catalog.service";

const SANDBOX_TOKEN = process.env.SQUARE_SANDBOX_ACCESS_TOKEN;

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  "mysql://root:password@localhost:3306/plovr_test";

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

// Stable test IDs
const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const CONNECTION_ID = generateEntityId();

// Will be populated by the API call
let sandboxCatalog: SquareCatalogResult;

// ---------- helper: derive expected values directly from raw API objects ----------

/** Supported product types — items with other types should be skipped */
const SUPPORTED_PRODUCT_TYPES = new Set(["REGULAR", "FOOD_AND_BEV", "FOOD_AND_BEV_ITEM"]);

/** Type guard: narrow CatalogObject to Item */
function isItem(o: CatalogObject): o is CatalogObject & { type: "ITEM" } {
  return o.type === "ITEM";
}

/** Type guard: narrow CatalogObject to Tax */
function isTax(o: CatalogObject): o is CatalogObject & { type: "TAX" } {
  return o.type === "TAX";
}

/** Type guard: narrow CatalogObject to Category */
function isCategory(o: CatalogObject): o is CatalogObject & { type: "CATEGORY" } {
  return o.type === "CATEGORY";
}

/** Get valid (non-VARIABLE_PRICING) variations from an item */
function getValidVariations(item: CatalogObject & { type: "ITEM" }) {
  return (item.itemData?.variations ?? []).filter(
    (v): v is CatalogObject & { type: "ITEM_VARIATION" } =>
      v.type === "ITEM_VARIATION" &&
      v.itemVariationData?.pricingType !== "VARIABLE_PRICING"
  );
}

/**
 * From raw API items, compute expected syncable items independently of mapToMenuModels.
 * An item is syncable if:
 *  1. productType ∈ SUPPORTED_PRODUCT_TYPES (default "REGULAR")
 *  2. At least one variation that is NOT VARIABLE_PRICING
 */
function expectedSyncableItems(items: CatalogObject[]) {
  return items.filter(isItem).filter((item) => {
    const data = item.itemData;
    if (!data) return false;

    const productType: string = data.productType ?? "REGULAR";
    if (!SUPPORTED_PRODUCT_TYPES.has(productType)) return false;

    return getValidVariations(item).length > 0;
  });
}

/** From raw API taxes, filter to enabled taxes */
function expectedEnabledTaxes(taxes: CatalogObject[]) {
  return taxes.filter(isTax).filter((t) => t.taxData?.enabled !== false);
}

/** Convert Square money (bigint cents) to dollars */
function centsToPrice(amount?: bigint | null): number {
  if (!amount) return 0;
  return Number(amount) / 100;
}

async function seedTestData() {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Square API Validation Tenant",
      slug: `sq-api-test-${Date.now()}`,
    },
  });
  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `sq-api-merchant-${Date.now()}`,
      name: "Square API Validation Merchant",
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
      accessToken: SANDBOX_TOKEN!,
      refreshToken: "sandbox-no-refresh",
      tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
}

async function cleanupTestData() {
  // Delete in reverse dependency order
  await prisma.menuItemModifierGroup.deleteMany({ where: { menuItem: { tenantId: TENANT_ID } } });
  await prisma.modifierOption.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.modifierGroup.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuItemTax.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuCategoryItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuCategory.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menu.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchantTaxRate.deleteMany({ where: { merchantId: MERCHANT_ID } });
  await prisma.taxConfig.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationSyncRecord.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationConnection.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

describe.skipIf(!SANDBOX_TOKEN)(
  "Square Sandbox API Validation (Integration)",
  () => {
    beforeAll(async () => {
      await cleanupTestData();

      // Fetch real catalog from Square Sandbox
      const client = new SquareClient({
        token: SANDBOX_TOKEN!,
        environment: SquareEnvironment.Sandbox,
      });

      const allObjects: CatalogObject[] = [];
      const page = await client.catalog.list();
      for await (const obj of page) {
        allObjects.push(obj);
      }

      sandboxCatalog = {
        categories: allObjects.filter((o) => o.type === "CATEGORY"),
        items: allObjects.filter((o) => o.type === "ITEM"),
        modifierLists: allObjects.filter((o) => o.type === "MODIFIER_LIST"),
        taxes: allObjects.filter((o) => o.type === "TAX"),
        images: allObjects.filter((o) => o.type === "IMAGE"),
      };

      await seedTestData();

      // Run sync once — all subsequent tests validate DB state against raw API data
      const fetchSpy = vi
        .spyOn(squareCatalogService, "fetchFullCatalog")
        .mockResolvedValue(sandboxCatalog);
      try {
        await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      } finally {
        fetchSpy.mockRestore();
      }
    }, 60_000);

    afterAll(async () => {
      await cleanupTestData();
      await prisma.$disconnect();
    });

    // ---- 1. Basic connectivity ----

    it("fetches non-empty catalog from Square Sandbox", () => {
      const totalObjects =
        sandboxCatalog.categories.length +
        sandboxCatalog.items.length +
        sandboxCatalog.modifierLists.length +
        sandboxCatalog.taxes.length;

      expect(totalObjects).toBeGreaterThan(0);
    });

    // ---- 2. Categories: compare DB against raw API categoryData.name ----

    it("persists every API CATEGORY with correct name", async () => {
      const expectedNames = sandboxCatalog.categories
        .filter(isCategory)
        .filter((c) => !!c.id)
        .map((c) => c.categoryData?.name ?? "Unnamed");

      const dbCategories = await prisma.menuCategory.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });

      expect(dbCategories).toHaveLength(expectedNames.length);

      const dbNames = dbCategories.map((c) => c.name);
      for (const name of expectedNames) {
        expect(dbNames).toContain(name);
      }
    });

    // ---- 3. Items: count and names derived from raw API filtering rules ----

    it("persists only syncable items (correct product types with valid variations)", async () => {
      const syncable = expectedSyncableItems(sandboxCatalog.items);

      const dbItems = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });

      expect(dbItems).toHaveLength(syncable.length);

      // Every syncable API item name should appear in DB
      const dbNames = dbItems.map((i) => i.name);
      for (const item of syncable) {
        const expectedName = item.itemData?.name ?? "Unnamed";
        expect(dbNames).toContain(expectedName);
      }
    });

    it("skips non-food items (gift cards, etc.)", async () => {
      const nonFood = sandboxCatalog.items.filter(isItem).filter((item) => {
        const productType: string = item.itemData?.productType ?? "REGULAR";
        return !SUPPORTED_PRODUCT_TYPES.has(productType);
      });

      if (nonFood.length === 0) return; // sandbox may not have non-food items

      const dbItems = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });
      const dbNames = dbItems.map((i) => i.name);

      for (const item of nonFood) {
        const name = item.itemData?.name ?? "Unnamed";
        expect(dbNames).not.toContain(name);
      }
    });

    // ---- 4. Item prices: base price = min variation price from raw API ----

    it("sets each item price to the minimum variation price from raw API", async () => {
      const syncable = expectedSyncableItems(sandboxCatalog.items);

      const dbItems = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });

      for (const apiItem of syncable) {
        const data = apiItem.itemData!;
        const validVariations = getValidVariations(apiItem);

        const expectedPrice = Math.min(
          ...validVariations.map((v) =>
            centsToPrice(v.itemVariationData?.priceMoney?.amount)
          )
        );

        const dbItem = dbItems.find((i) => i.name === (data.name ?? "Unnamed"));
        expect(dbItem).toBeDefined();
        expect(Number(dbItem!.price)).toBeCloseTo(expectedPrice, 2);
      }
    });

    // ---- 5. Taxes: compare DB against raw API taxData fields ----

    it("persists enabled taxes with correct name, rate, and inclusion type from raw API", async () => {
      const enabledTaxes = expectedEnabledTaxes(sandboxCatalog.taxes);

      const dbTaxConfigs = await prisma.taxConfig.findMany({
        where: { tenantId: TENANT_ID },
      });

      expect(dbTaxConfigs).toHaveLength(enabledTaxes.length);

      // Rate is stored on MerchantTaxRate, not TaxConfig
      const dbMerchantTaxRates = await prisma.merchantTaxRate.findMany({
        where: { merchantId: MERCHANT_ID },
        include: { taxConfig: true },
      });

      for (const apiTax of enabledTaxes) {
        const expectedName = apiTax.taxData?.name ?? "Tax";
        const expectedRate = parseFloat(apiTax.taxData?.percentage ?? "0") / 100;
        const expectedInclusion =
          apiTax.taxData?.inclusionType === "INCLUSIVE" ? "inclusive" : "additive";

        // Validate TaxConfig name and inclusionType
        const dbTaxConfig = dbTaxConfigs.find((t) => t.name === expectedName);
        expect(dbTaxConfig, `tax config "${expectedName}" should exist in DB`).toBeDefined();
        expect(dbTaxConfig!.inclusionType).toBe(expectedInclusion);

        // Validate MerchantTaxRate.rate
        const dbRate = dbMerchantTaxRates.find(
          (r) => r.taxConfigId === dbTaxConfig!.id
        );
        expect(dbRate, `merchant tax rate for "${expectedName}" should exist`).toBeDefined();
        expect(Number(dbRate!.rate)).toBeCloseTo(expectedRate, 4);
      }
    });

    // ---- 6. Modifier groups: count from raw API modifier list info ----

    it("persists correct number of modifier groups per item from raw API", async () => {
      const syncable = expectedSyncableItems(sandboxCatalog.items);
      const modifierListMap = new Map(
        sandboxCatalog.modifierLists.map((ml) => [ml.id, ml])
      );

      const dbItems = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
        include: { modifierGroups: true },
      });

      for (const apiItem of syncable) {
        const data = apiItem.itemData!;
        const itemName = data.name ?? "Unnamed";

        // Count expected modifier groups from raw API:
        // 1. If >1 valid variation → 1 "Options" group for variations
        const validVariations = getValidVariations(apiItem);
        const hasVariationGroup = validVariations.length > 1 ? 1 : 0;

        // 2. Count enabled modifier lists that exist in the catalog
        const enabledModifierLists = (data.modifierListInfo ?? []).filter(
          (mlInfo) => mlInfo.enabled !== false && modifierListMap.has(mlInfo.modifierListId!)
        );

        const expectedGroupCount = hasVariationGroup + enabledModifierLists.length;

        const dbItem = dbItems.find((i) => i.name === itemName);
        expect(dbItem, `item "${itemName}" should exist in DB`).toBeDefined();
        expect(
          dbItem!.modifierGroups.length,
          `item "${itemName}" should have ${expectedGroupCount} modifier groups`
        ).toBe(expectedGroupCount);
      }
    });

    // ---- 7. Sync record: verify status and counts against raw API ----

    it("records sync success with correct item counts from raw API", async () => {
      const syncable = expectedSyncableItems(sandboxCatalog.items);
      const skipped = sandboxCatalog.items.length - syncable.length;
      const enabledTaxes = expectedEnabledTaxes(sandboxCatalog.taxes);

      const syncRecord = await prisma.integrationSyncRecord.findFirst({
        where: { connectionId: CONNECTION_ID },
        orderBy: { createdAt: "desc" },
      });

      expect(syncRecord).toBeDefined();
      expect(syncRecord!.status).toBe("success");

      const stats = syncRecord!.stats as Record<string, unknown>;
      expect(stats).toBeDefined();
      expect(stats.itemsMapped).toBe(syncable.length);
      // itemsSkipped can include items with 0 valid variations, so >= skipped-by-type
      expect(stats.itemsSkipped).toBeGreaterThanOrEqual(skipped);

      // Tax inclusion counts from raw API (enabledTaxes already narrowed to Tax type)
      const inclusiveCount = enabledTaxes.filter(
        (t) => t.taxData?.inclusionType === "INCLUSIVE"
      ).length;
      const additiveCount = enabledTaxes.length - inclusiveCount;
      expect(stats.taxesInclusive).toBe(inclusiveCount);
      expect(stats.taxesAdditive).toBe(additiveCount);
    });

    // ---- 8. Idempotency ----

    it("re-sync produces no duplicates", async () => {
      const fetchSpy = vi
        .spyOn(squareCatalogService, "fetchFullCatalog")
        .mockResolvedValue(sandboxCatalog);

      try {
        await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

        const syncable = expectedSyncableItems(sandboxCatalog.items);
        const enabledTaxes = expectedEnabledTaxes(sandboxCatalog.taxes);

        const dbItems = await prisma.menuItem.findMany({
          where: { tenantId: TENANT_ID, deleted: false },
        });
        expect(dbItems).toHaveLength(syncable.length);

        const dbCategories = await prisma.menuCategory.findMany({
          where: { tenantId: TENANT_ID, deleted: false },
        });
        expect(dbCategories).toHaveLength(sandboxCatalog.categories.length);

        const dbTaxConfigs = await prisma.taxConfig.findMany({
          where: { tenantId: TENANT_ID },
        });
        expect(dbTaxConfigs).toHaveLength(enabledTaxes.length);
      } finally {
        fetchSpy.mockRestore();
      }
    }, 60_000);
  }
);
