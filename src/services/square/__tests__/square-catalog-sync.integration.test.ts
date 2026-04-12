/**
 * Integration test for Square catalog sync end-to-end.
 *
 * Verifies that Square catalog synced via squareService.syncCatalog:
 * 1. Writes TaxConfig rows with correct inclusionType (INCLUSIVE → "inclusive")
 * 2. Writes MenuCategory + MenuItem rows with modifier groups in JSON
 * 3. Writes IntegrationSyncRecord.stats as JSON blob matching CatalogSyncStats
 * 4. Pricing computed from the loaded TaxConfig produces correct totals
 *
 * Run with: npx vitest run --config vitest.config.integration.ts
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { generateEntityId } from "@/lib/id";
import { vi } from "vitest";
import { squareCatalogService } from "@/services/square/square-catalog.service";
import { squareService } from "@/services/square/square.service";
import type { SquareCatalogResult } from "@/services/square/square-catalog.service";
import type { CatalogObject } from "square";

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  "mysql://root:password@localhost:3306/plovr_test";

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

// Seed data IDs (stable across tests)
const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const CONNECTION_ID = generateEntityId();

function buildSyntheticCatalog(): SquareCatalogResult {
  return {
    categories: [
      { type: "CATEGORY", id: "cat-drinks", categoryData: { name: "Drinks" } },
    ] as CatalogObject[],
    items: [
      // Multi-variation item (Small/Medium/Large Latte)
      {
        type: "ITEM",
        id: "item-latte",
        itemData: {
          name: "Latte",
          productType: "FOOD_AND_BEV",
          categoryId: "cat-drinks",
          taxIds: ["tax-vat"],
          variations: [
            {
              type: "ITEM_VARIATION",
              id: "var-s",
              itemVariationData: {
                name: "Small",
                ordinal: 0,
                pricingType: "FIXED_PRICING",
                priceMoney: { amount: BigInt(400), currency: "USD" },
              },
            },
            {
              type: "ITEM_VARIATION",
              id: "var-m",
              itemVariationData: {
                name: "Medium",
                ordinal: 1,
                pricingType: "FIXED_PRICING",
                priceMoney: { amount: BigInt(500), currency: "USD" },
              },
            },
            {
              type: "ITEM_VARIATION",
              id: "var-l",
              itemVariationData: {
                name: "Large",
                ordinal: 2,
                pricingType: "FIXED_PRICING",
                priceMoney: { amount: BigInt(600), currency: "USD" },
              },
            },
          ],
          modifierListInfo: [{ modifierListId: "ml-syrup", enabled: true }],
        },
      },
      // Gift card should be SKIPPED
      {
        type: "ITEM",
        id: "item-gc",
        itemData: {
          name: "Gift Card",
          productType: "GIFT_CARD",
          variations: [
            {
              type: "ITEM_VARIATION",
              id: "var-gc",
              itemVariationData: {
                name: "$10",
                ordinal: 0,
                pricingType: "FIXED_PRICING",
                priceMoney: { amount: BigInt(1000), currency: "USD" },
              },
            },
          ],
        },
      },
    ] as CatalogObject[],
    modifierLists: [
      {
        type: "MODIFIER_LIST",
        id: "ml-syrup",
        modifierListData: {
          name: "Syrup",
          selectionType: "SINGLE",
          minSelectedModifiers: BigInt(0),
          maxSelectedModifiers: BigInt(1),
          modifiers: [
            {
              type: "MODIFIER",
              id: "mod-vanilla",
              modifierData: {
                name: "Vanilla",
                ordinal: 0,
                priceMoney: { amount: BigInt(50), currency: "USD" },
              },
            },
          ],
        },
      },
    ] as unknown as CatalogObject[],
    taxes: [
      // Inclusive VAT 10%
      {
        type: "TAX",
        id: "tax-vat",
        taxData: {
          name: "VAT 10%",
          percentage: "10.0",
          inclusionType: "INCLUSIVE",
          calculationPhase: "TAX_SUBTOTAL_PHASE",
          enabled: true,
        },
      },
    ] as CatalogObject[],
    images: [],
  };
}

async function seedTestData() {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Test Tenant",
      slug: `test-tenant-${Date.now()}`,
    },
  });
  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `test-merchant-${Date.now()}`,
      name: "Test Merchant",
    },
  });
  // Seed an active Square IntegrationConnection with a fake token
  await prisma.integrationConnection.create({
    data: {
      id: CONNECTION_ID,
      tenantId: TENANT_ID,
      merchantId: MERCHANT_ID,
      type: "POS_SQUARE",
      category: "POS",
      status: "active",
      accessToken: "fake-test-token",
      refreshToken: "fake-refresh",
      tokenExpiresAt: new Date(Date.now() + 86400000), // 1 day from now
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

async function cleanupCatalogData() {
  // Clean catalog and tax data between tests, but keep tenant+merchant+connection
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
}

describe("Square Catalog Sync (Integration)", () => {
  beforeAll(async () => {
    await cleanupTestData();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Wipe catalog/tax data between tests so they don't interfere
    await cleanupCatalogData();
  });

  it("TaxConfig.inclusionType round-trips through real DB via repository", async () => {
    const { taxConfigRepository } = await import(
      "@/repositories/tax-config.repository"
    );

    const created = await taxConfigRepository.createTaxConfig(TENANT_ID, {
      name: "Test VAT",
      inclusionType: "inclusive",
    });
    expect(created.inclusionType).toBe("inclusive");

    const fetched = await taxConfigRepository.getTaxConfigById(
      TENANT_ID,
      created.id
    );
    expect(fetched?.inclusionType).toBe("inclusive");

    // Also test the batch path
    const batch = await taxConfigRepository.getTaxConfigsByIds(TENANT_ID, [
      created.id,
    ]);
    expect(batch[0]?.inclusionType).toBe("inclusive");

    // Clean up immediately (so per-test cleanup still works cleanly)
    await prisma.taxConfig.delete({ where: { id: created.id } });
  });

  it("syncCatalog persists TaxConfig with inclusionType, modifier groups, and stats", async () => {
    // Mock the Square SDK call — everything else (mapper, DB writes, stats) runs for real
    const fetchSpy = vi
      .spyOn(squareCatalogService, "fetchFullCatalog")
      .mockResolvedValue(buildSyntheticCatalog());

    try {
      const result = await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      expect(result.objectsMapped).toBeGreaterThan(0);

      // Assert TaxConfig with inclusionType = "inclusive"
      const taxConfigs = await prisma.taxConfig.findMany({
        where: { tenantId: TENANT_ID },
      });
      expect(taxConfigs).toHaveLength(1);
      expect(taxConfigs[0].inclusionType).toBe("inclusive");
      expect(taxConfigs[0].name).toBe("VAT 10%");

      // Assert MerchantTaxRate was created with rate 0.10
      const rates = await prisma.merchantTaxRate.findMany({
        where: { merchantId: MERCHANT_ID },
      });
      expect(rates).toHaveLength(1);
      expect(Number(rates[0].rate)).toBeCloseTo(0.1, 4);

      // Assert MenuItem (Latte) persisted with modifier groups in JSON
      const items = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID },
      });
      // Gift card was skipped, only Latte persisted
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe("Latte");
      // Base price = min variation = $4.00
      expect(Number(items[0].price)).toBe(4);

      // Modifiers JSON contains the variation group ("Options") AND the Syrup modifier list
      const modifiers = items[0].modifiers as {
        groups: Array<{
          name: string;
          required: boolean;
          options: unknown[];
        }>;
      };
      expect(modifiers.groups).toHaveLength(2);

      const variationGroup = modifiers.groups.find((g) => g.name === "Options");
      expect(variationGroup).toBeDefined();
      expect(variationGroup!.required).toBe(true);
      expect(variationGroup!.options).toHaveLength(3);

      const syrupGroup = modifiers.groups.find((g) => g.name === "Syrup");
      expect(syrupGroup).toBeDefined();
      expect(syrupGroup!.options).toHaveLength(1);

      // Assert gift card was SKIPPED (not in ExternalIdMapping)
      const giftCardMapping = await prisma.externalIdMapping.findFirst({
        where: { tenantId: TENANT_ID, externalId: "item-gc" },
      });
      expect(giftCardMapping).toBeNull();

      // Assert ExternalIdMapping for the tax exists
      const taxMapping = await prisma.externalIdMapping.findFirst({
        where: { tenantId: TENANT_ID, externalId: "tax-vat" },
      });
      expect(taxMapping).toBeDefined();

      // Assert IntegrationSyncRecord has stats JSON
      const syncRecord = await prisma.integrationSyncRecord.findFirst({
        where: { connectionId: CONNECTION_ID },
        orderBy: { createdAt: "desc" },
      });
      expect(syncRecord).toBeDefined();
      expect(syncRecord!.status).toBe("success");

      // Stats JSON should contain itemsMapped=1 (Latte), itemsSkipped=1 (Gift Card)
      const stats = syncRecord!.stats as {
        itemsMapped: number;
        itemsSkipped: number;
        taxesInclusive: number;
        variationsAsOptions: number;
      };
      expect(stats).toBeDefined();
      expect(stats.itemsMapped).toBe(1);
      expect(stats.itemsSkipped).toBe(1);
      expect(stats.taxesInclusive).toBe(1);
      expect(stats.variationsAsOptions).toBe(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("re-sync is idempotent — no duplicate rows", async () => {
    const fetchSpy = vi
      .spyOn(squareCatalogService, "fetchFullCatalog")
      .mockResolvedValue(buildSyntheticCatalog());

    try {
      // First sync
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // Second sync with identical catalog data
      await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

      // Exactly one MerchantTaxRate per taxConfig
      const rates = await prisma.merchantTaxRate.findMany({
        where: { merchantId: MERCHANT_ID },
      });
      expect(rates).toHaveLength(1);

      // Exactly one MenuCategoryItem per (category, item) link
      const links = await prisma.menuCategoryItem.findMany({
        where: { tenantId: TENANT_ID },
      });
      expect(links).toHaveLength(1); // one link for the Latte → Drinks category

      // TaxConfig should still be one row (not duplicated)
      const taxConfigs = await prisma.taxConfig.findMany({
        where: { tenantId: TENANT_ID },
      });
      expect(taxConfigs).toHaveLength(1);

      // MenuItem should still be one row (Gift Card skipped)
      const items = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID },
      });
      expect(items).toHaveLength(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("pricing computed from DB-loaded inclusive TaxConfig produces correct totals", async () => {
    const { taxConfigRepository } = await import(
      "@/repositories/tax-config.repository"
    );
    const { calculateOrderPricing } = await import("@/lib/pricing");

    const taxConfig = await taxConfigRepository.createTaxConfig(TENANT_ID, {
      name: "Test VAT",
      inclusionType: "inclusive",
      roundingMethod: "half_up",
    });

    try {
      // Load it back via the read path (proves normalize works)
      const loaded = await taxConfigRepository.getTaxConfigById(
        TENANT_ID,
        taxConfig.id
      );
      expect(loaded?.inclusionType).toBe("inclusive");

      // Feed it into calculateOrderPricing: listed price $110 with 10% inclusive VAT
      // Expected: subtotal=110, inclusiveTax=10, additiveTax=0, total=110
      const result = calculateOrderPricing([
        {
          itemId: "test-item",
          unitPrice: 110,
          quantity: 1,
          taxes: [
            {
              rate: 0.1,
              roundingMethod: loaded!.roundingMethod as "half_up",
              inclusionType: loaded!.inclusionType,
            },
          ],
        },
      ]);

      expect(result.subtotal).toBe(110);
      expect(result.taxAmountInclusive).toBeCloseTo(10, 2);
      expect(result.taxAmountAdditive).toBe(0);
      expect(result.totalAmount).toBeCloseTo(110, 2);
    } finally {
      await prisma.taxConfig.delete({ where: { id: taxConfig.id } });
    }
  });
});
