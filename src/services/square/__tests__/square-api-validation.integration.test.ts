/**
 * Square Sandbox API Validation Integration Test.
 *
 * Validates the full Catalog Sync pipeline against the real Square Sandbox API.
 * Requires SQUARE_SANDBOX_ACCESS_TOKEN to be set (skipped otherwise).
 *
 * This test:
 * 1. Creates a real SquareClient pointing at the Square Sandbox
 * 2. Fetches actual catalog data from the sandbox account
 * 3. Seeds a test tenant/merchant/connection in the DB
 * 4. Runs the sync pipeline with real API data
 * 5. Validates DB state matches the API response
 *
 * Run with: npx vitest run --config vitest.config.integration.ts square-api-validation
 * Requires: MySQL running + SQUARE_SANDBOX_ACCESS_TOKEN set
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { SquareClient, SquareEnvironment } from "square";
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
  // Seed IntegrationConnection with real sandbox token
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
      tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
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
      // Clean up any leftover data from previous runs
      await cleanupTestData();

      // 1. Fetch real catalog from Square Sandbox
      const client = new SquareClient({
        token: SANDBOX_TOKEN!,
        environment: SquareEnvironment.Sandbox,
      });

      // Verify connectivity first
      const allObjects: import("square").CatalogObject[] = [];
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

      // 2. Seed DB with test tenant/merchant/connection
      await seedTestData();
    }, 60_000); // Allow 60s for API call

    afterAll(async () => {
      await cleanupTestData();
      await prisma.$disconnect();
    });

    it("fetches non-empty catalog from Square Sandbox", () => {
      // The sandbox should have at least some catalog objects
      const totalObjects =
        sandboxCatalog.categories.length +
        sandboxCatalog.items.length +
        sandboxCatalog.modifierLists.length +
        sandboxCatalog.taxes.length;

      expect(totalObjects).toBeGreaterThan(0);
    });

    it("syncCatalog persists categories matching API CATEGORY objects", async () => {
      // Run the full sync pipeline (uses real token from DB connection)
      // Mock fetchFullCatalog to return the already-fetched sandbox data
      // (avoids a second API call and ensures we validate against the same snapshot)
      const fetchSpy = vi
        .spyOn(squareCatalogService, "fetchFullCatalog")
        .mockResolvedValue(sandboxCatalog);

      try {
        const result = await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
        expect(result.objectsMapped).toBeGreaterThan(0);

        // Validate categories
        const dbCategories = await prisma.menuCategory.findMany({
          where: { tenantId: TENANT_ID, deleted: false },
          orderBy: { sortOrder: "asc" },
        });

        const expectedCategoryNames = sandboxCatalog.categories
          .filter((c) => c.type === "CATEGORY" && c.id)
          .map((c) => c.categoryData?.name ?? "Unnamed");

        expect(dbCategories).toHaveLength(expectedCategoryNames.length);

        const dbCategoryNames = dbCategories.map((c) => c.name);
        for (const name of expectedCategoryNames) {
          expect(dbCategoryNames).toContain(name);
        }
      } finally {
        fetchSpy.mockRestore();
      }
    }, 60_000);

    it("syncCatalog persists items matching API ITEM objects (excluding non-food)", async () => {
      // We need to re-sync since previous test cleaned up via afterEach
      // But since we're in the same describe without afterEach, data persists
      const mapped = squareCatalogService.mapToMenuModels(sandboxCatalog);

      const dbItems = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
      });

      // mapped.items excludes gift cards and non-food items
      expect(dbItems).toHaveLength(mapped.items.length);

      const dbItemNames = dbItems.map((i) => i.name);
      for (const item of mapped.items) {
        expect(dbItemNames).toContain(item.name);
      }
    });

    it("syncCatalog persists modifier groups matching API MODIFIER_LIST objects", async () => {
      const mapped = squareCatalogService.mapToMenuModels(sandboxCatalog);

      // Count total modifier groups across all items (includes variation groups + modifier lists)
      const expectedTotalGroups = mapped.items.reduce(
        (sum, item) => sum + item.modifierGroups.length,
        0
      );

      const dbModifierJunctions = await prisma.menuItemModifierGroup.findMany({
        where: { menuItem: { tenantId: TENANT_ID } },
      });

      expect(dbModifierJunctions).toHaveLength(expectedTotalGroups);
    });

    it("syncCatalog persists tax configs matching API TAX objects", async () => {
      const mapped = squareCatalogService.mapToMenuModels(sandboxCatalog);

      const dbTaxConfigs = await prisma.taxConfig.findMany({
        where: { tenantId: TENANT_ID },
      });

      expect(dbTaxConfigs).toHaveLength(mapped.taxes.length);

      // Validate each tax name and rate
      for (const expectedTax of mapped.taxes) {
        const dbTax = dbTaxConfigs.find((t) => t.name === expectedTax.name);
        expect(dbTax).toBeDefined();
        expect(Number(dbTax!.rate)).toBeCloseTo(expectedTax.percentage / 100, 4);
        expect(dbTax!.inclusionType).toBe(expectedTax.inclusionType);
      }
    });

    it("IntegrationSyncRecord.stats records correct object counts", async () => {
      const mapped = squareCatalogService.mapToMenuModels(sandboxCatalog);

      const syncRecord = await prisma.integrationSyncRecord.findFirst({
        where: { connectionId: CONNECTION_ID },
        orderBy: { createdAt: "desc" },
      });

      expect(syncRecord).toBeDefined();
      expect(syncRecord!.status).toBe("success");

      const stats = syncRecord!.stats as {
        itemsMapped: number;
        itemsSkipped: number;
        taxesInclusive: number;
        taxesAdditive: number;
        variationsAsOptions: number;
      };

      expect(stats).toBeDefined();
      expect(stats.itemsMapped).toBe(mapped.stats.itemsMapped);
      expect(stats.itemsSkipped).toBe(mapped.stats.itemsSkipped);
      expect(stats.taxesInclusive).toBe(mapped.stats.taxesInclusive);
      expect(stats.taxesAdditive).toBe(mapped.stats.taxesAdditive);
      expect(stats.variationsAsOptions).toBe(mapped.stats.variationsAsOptions);
    });

    it("re-sync is idempotent with real API data", async () => {
      // Run sync again with the same catalog snapshot
      const fetchSpy = vi
        .spyOn(squareCatalogService, "fetchFullCatalog")
        .mockResolvedValue(sandboxCatalog);

      try {
        await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);

        const mapped = squareCatalogService.mapToMenuModels(sandboxCatalog);

        // No duplicate items
        const dbItems = await prisma.menuItem.findMany({
          where: { tenantId: TENANT_ID, deleted: false },
        });
        expect(dbItems).toHaveLength(mapped.items.length);

        // No duplicate categories
        const dbCategories = await prisma.menuCategory.findMany({
          where: { tenantId: TENANT_ID, deleted: false },
        });
        expect(dbCategories).toHaveLength(mapped.categories.length);

        // No duplicate tax configs
        const dbTaxConfigs = await prisma.taxConfig.findMany({
          where: { tenantId: TENANT_ID },
        });
        expect(dbTaxConfigs).toHaveLength(mapped.taxes.length);
      } finally {
        fetchSpy.mockRestore();
      }
    }, 60_000);
  }
);
