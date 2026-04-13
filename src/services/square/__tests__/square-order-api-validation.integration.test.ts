/**
 * Square Order API Validation Integration Test.
 *
 * Validates the Order push pipeline against the real Square Sandbox API.
 * Requires SQUARE_SANDBOX_ACCESS_TOKEN to be set (skipped otherwise).
 *
 * Runs a catalog sync first (same pattern as square-api-validation.integration.test.ts)
 * to populate menu items and ExternalIdMapping records, then exercises
 * createOrder / updateOrderStatus through the real Square Sandbox.
 *
 * Run with: npx vitest run --config vitest.config.integration.ts square-order-api-validation
 * Requires: MySQL running + SQUARE_SANDBOX_ACCESS_TOKEN set
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { SquareClient, SquareEnvironment } from "square";
import type { CatalogObject } from "square"; // used by SquareCatalogResult
import { generateEntityId } from "@/lib/id";
import { squareCatalogService } from "@/services/square/square-catalog.service";
import { squareService } from "@/services/square/square.service";
import type { SquareCatalogResult } from "@/services/square/square-catalog.service";
import type { SquareOrderPushInput, SquareOrderPushResult } from "@/services/square/square.types";
import type { ItemTaxInfo } from "@/services/menu/tax-config.types";

// ---------------------------------------------------------------------------
// vi.hoisted PrismaClient — must be created inside vi.hoisted() so the
// reference is available when the vi.mock() factory executes (factories
// are hoisted above all top-level variable initializers).
// ---------------------------------------------------------------------------

const prisma = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: PC } = require("@prisma/client") as typeof import("@prisma/client");
  const url =
    process.env.DATABASE_URL ||
    "mysql://root:password@localhost:3306/plovr_test";
  return new PC({ datasources: { db: { url } } });
});

vi.mock("@/lib/db", () => ({
  default: prisma,
  __esModule: true,
}));

// Import after mock so the service picks up our PrismaClient
import { squareOrderService } from "@/services/square/square-order.service";

// ---------------------------------------------------------------------------
// Environment gate
// ---------------------------------------------------------------------------

const SANDBOX_TOKEN = process.env.SQUARE_SANDBOX_ACCESS_TOKEN;

// Stable test IDs (unique per run)
const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const CONNECTION_ID = generateEntityId();
const ORDER_ID = generateEntityId();
const ORDER_NUMBER = `ORD-SQ-API-${Date.now()}`;

// State shared between tests
let sandboxLocationId: string;
let sandboxCatalog: SquareCatalogResult;
let createResult: SquareOrderPushResult;
let pushInput: SquareOrderPushInput;

// ---------------------------------------------------------------------------
// Helpers (same filtering logic as square-api-validation.integration.test.ts)
// ---------------------------------------------------------------------------

// (Catalog helpers are not needed for the order tests — syncCatalog populates
// menu items and ID mappings that we read back from the DB directly.)

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seedTestData(locationId: string) {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Square Order API Test Tenant",
      slug: `sq-order-api-${Date.now()}`,
    },
  });
  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `sq-order-api-merchant-${Date.now()}`,
      name: "Square Order API Test Merchant",
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
      externalLocationId: locationId,
    },
  });
}

async function cleanupTestData() {
  // Order-related tables (reverse FK order)
  await prisma.fulfillmentStatusLog.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderFulfillment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderItemModifier.deleteMany({
    where: { orderItem: { order: { tenantId: TENANT_ID } } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { tenantId: TENANT_ID } },
  });
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderSequence.deleteMany({ where: { tenantId: TENANT_ID } });

  // Menu / catalog tables
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

  // Integration tables
  await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationSyncRecord.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.webhookEvent.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationConnection.deleteMany({ where: { tenantId: TENANT_ID } });

  // Core tables
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!SANDBOX_TOKEN)(
  "Square Order API Validation (Integration)",
  () => {
    beforeAll(async () => {
      await cleanupTestData();

      const client = new SquareClient({
        token: SANDBOX_TOKEN!,
        environment: SquareEnvironment.Sandbox,
      });

      // 1. Get sandbox location
      const locationsResp = await client.locations.list();
      const activeLocation = locationsResp.locations?.find(
        (l) => l.status === "ACTIVE"
      );
      expect(activeLocation?.id).toBeDefined();
      sandboxLocationId = activeLocation!.id!;

      // 2. Fetch sandbox catalog
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

      // 3. Seed DB
      await seedTestData(sandboxLocationId);

      // 4. Run catalog sync to populate menu items + ID mappings
      const fetchSpy = vi
        .spyOn(squareCatalogService, "fetchFullCatalog")
        .mockResolvedValue(sandboxCatalog);
      try {
        await squareService.syncCatalog(TENANT_ID, MERCHANT_ID);
      } finally {
        fetchSpy.mockRestore();
      }

      // 5. Build the order push input from synced DB data
      const dbItems = await prisma.menuItem.findMany({
        where: { tenantId: TENANT_ID, deleted: false },
        take: 1,
      });
      expect(dbItems.length).toBeGreaterThan(0);

      const testItem = dbItems[0];

      // Look up tax configs assigned to this item (via MenuItemTax)
      const menuItemTaxes = await prisma.menuItemTax.findMany({
        where: { tenantId: TENANT_ID, menuItemId: testItem.id },
        include: { taxConfig: true },
      });

      const merchantTaxRates = await prisma.merchantTaxRate.findMany({
        where: { merchantId: MERCHANT_ID },
      });
      const taxRateByConfigId = new Map(
        merchantTaxRates.map((r) => [r.taxConfigId, Number(r.rate)])
      );

      const itemTaxes: ItemTaxInfo[] = menuItemTaxes.map((mit) => ({
        taxConfigId: mit.taxConfig.id,
        name: mit.taxConfig.name,
        rate: taxRateByConfigId.get(mit.taxConfig.id) ?? 0,
        roundingMethod: mit.taxConfig.roundingMethod as "half_up" | "half_even",
        inclusionType: mit.taxConfig.inclusionType as "additive" | "inclusive",
      }));

      const itemPrice = Number(testItem.price);
      const quantity = 2;
      const subtotal = itemPrice * quantity;
      const taxAmount = itemTaxes.reduce(
        (sum, t) => sum + subtotal * t.rate,
        0
      );

      // Create an internal Order + OrderFulfillment so persistSquareOrderVersion works
      await prisma.order.create({
        data: {
          id: ORDER_ID,
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          orderNumber: ORDER_NUMBER,
          status: "completed",
          fulfillmentStatus: "pending",
          orderMode: "pickup",
          subtotal,
          taxAmount,
          totalAmount: subtotal + taxAmount,
          customerFirstName: "Sandbox",
          customerLastName: "Tester",
          customerPhone: "555-0100",
        },
      });

      await prisma.orderFulfillment.create({
        data: {
          id: generateEntityId(),
          orderId: ORDER_ID,
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          status: "pending",
        },
      });

      pushInput = {
        orderId: ORDER_ID,
        orderNumber: ORDER_NUMBER,
        customerFirstName: "Sandbox",
        customerLastName: "Tester",
        customerPhone: "555-0100",
        customerEmail: "sandbox@test.com",
        orderMode: "pickup",
        items: [
          {
            menuItemId: testItem.id,
            name: testItem.name,
            price: itemPrice,
            quantity,
            selectedModifiers: [],
            taxes: itemTaxes,
          },
        ],
        totalAmount: subtotal + taxAmount,
        taxAmount,
        tipAmount: 0,
        deliveryFee: 0,
        discount: 0,
        notes: "Integration test order",
      };
    }, 90_000);

    afterAll(async () => {
      await cleanupTestData();
      await prisma.$disconnect();
    });

    // ---- 1. Create order on Square Sandbox ----

    it("creates an order on Square Sandbox and returns valid order ID and version", async () => {
      createResult = await squareOrderService.createOrder(
        TENANT_ID,
        MERCHANT_ID,
        pushInput
      );

      expect(createResult.squareOrderId).toBeDefined();
      expect(typeof createResult.squareOrderId).toBe("string");
      expect(createResult.squareOrderId.length).toBeGreaterThan(0);
      expect(createResult.squareVersion).toBeGreaterThanOrEqual(1);
    }, 30_000);

    // ---- 2. Retrieve the created order and validate line items ----

    it("retrieves the created order from Square and validates line items match", async () => {
      const client = new SquareClient({
        token: SANDBOX_TOKEN!,
        environment: SquareEnvironment.Sandbox,
      });

      const response = await client.orders.get({
        orderId: createResult.squareOrderId,
      });

      const squareOrder = response.order;
      expect(squareOrder).toBeDefined();
      expect(squareOrder!.locationId).toBe(sandboxLocationId);
      expect(squareOrder!.referenceId).toBe(ORDER_ID);

      // Validate line items
      const lineItems = squareOrder!.lineItems ?? [];
      expect(lineItems).toHaveLength(pushInput.items.length);

      const firstLineItem = lineItems[0];
      expect(firstLineItem.name).toBe(pushInput.items[0].name);
      expect(firstLineItem.quantity).toBe(String(pushInput.items[0].quantity));

      // Validate fulfillment exists and is PROPOSED
      const fulfillments = squareOrder!.fulfillments ?? [];
      expect(fulfillments).toHaveLength(1);
      expect(fulfillments[0].type).toBe("PICKUP");
      expect(fulfillments[0].state).toBe("PROPOSED");
    }, 30_000);

    // ---- 3. Update fulfillment state ----

    it("updates fulfillment state and version increments", async () => {
      const initialVersion = createResult.squareVersion;

      // updateOrderStatus maps "confirmed" -> RESERVED
      await squareOrderService.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        ORDER_ID,
        "confirmed"
      );

      // Verify on Square
      const client = new SquareClient({
        token: SANDBOX_TOKEN!,
        environment: SquareEnvironment.Sandbox,
      });

      const response = await client.orders.get({
        orderId: createResult.squareOrderId,
      });

      const squareOrder = response.order;
      expect(squareOrder).toBeDefined();
      expect(squareOrder!.fulfillments?.[0]?.state).toBe("RESERVED");
      expect(Number(squareOrder!.version)).toBeGreaterThan(initialVersion);
    }, 30_000);

    // ---- 4. DB consistency: ExternalIdMapping and externalVersion match ----

    it("DB externalOrderId and externalVersion match Square API values", async () => {
      // Check ExternalIdMapping for Order type
      const orderMapping = await prisma.externalIdMapping.findFirst({
        where: {
          tenantId: TENANT_ID,
          internalType: "Order",
          internalId: ORDER_ID,
          externalSource: "SQUARE",
        },
      });
      expect(orderMapping).not.toBeNull();
      expect(orderMapping!.externalId).toBe(createResult.squareOrderId);

      // Check OrderFulfillment.externalVersion matches latest Square version
      const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId: ORDER_ID },
      });
      expect(fulfillment).not.toBeNull();
      expect(fulfillment!.externalVersion).not.toBeNull();

      // Fetch current version from Square to compare
      const client = new SquareClient({
        token: SANDBOX_TOKEN!,
        environment: SquareEnvironment.Sandbox,
      });
      const response = await client.orders.get({
        orderId: createResult.squareOrderId,
      });
      expect(fulfillment!.externalVersion).toBe(
        Number(response.order!.version)
      );
    }, 30_000);

    // ---- 5. Idempotent create returns same order on retry ----

    it("idempotent create returns same order on retry", async () => {
      const retryResult = await squareOrderService.createOrder(
        TENANT_ID,
        MERCHANT_ID,
        pushInput
      );

      // Square dedup via idempotency key should return the same order
      expect(retryResult.squareOrderId).toBe(createResult.squareOrderId);
    }, 30_000);

    // ---- 6. Sync record tracking ----

    it("records sync records for order push operations", async () => {
      const syncRecords = await prisma.integrationSyncRecord.findMany({
        where: {
          tenantId: TENANT_ID,
          connectionId: CONNECTION_ID,
          syncType: "ORDER_PUSH",
        },
        orderBy: { createdAt: "asc" },
      });

      // At least 2: initial create + idempotent retry (both succeeded)
      expect(syncRecords.length).toBeGreaterThanOrEqual(2);

      for (const record of syncRecords) {
        expect(record.status).toBe("success");
      }
    });
  }
);
