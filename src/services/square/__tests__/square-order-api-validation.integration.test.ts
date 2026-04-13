/**
 * Square Order API Validation Integration Test.
 *
 * Validates the Order push pipeline against the real Square Sandbox API.
 * Requires SQUARE_SANDBOX_ACCESS_TOKEN to be set (skipped otherwise).
 *
 * IMPORTANT: All expected values are derived by independently computing
 * from the raw Square API response — NOT from our service's internal
 * return values. The goal is to catch transformation bugs (price
 * conversion, catalog ID mapping, tax percentage encoding, etc.) that
 * a smoke test would miss.
 *
 * Run with: npx vitest run --config vitest.config.integration.ts square-order-api-validation
 * Requires: MySQL running + SQUARE_SANDBOX_ACCESS_TOKEN set
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { SquareClient, SquareEnvironment } from "square";
import type { CatalogObject } from "square";
import { generateEntityId } from "@/lib/id";
import { squareCatalogService } from "@/services/square/square-catalog.service";
import { squareService } from "@/services/square/square.service";
import type { SquareCatalogResult } from "@/services/square/square-catalog.service";
import type { SquareOrderPushInput } from "@/services/square/square.types";
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

// State shared between tests — populated in beforeAll
let sandboxLocationId: string;
let pushInput: SquareOrderPushInput;

// The raw Square API response from orders.get() — the source of truth
// for ALL assertions. We call createOrder() then IMMEDIATELY read back
// via the SDK so every test validates against the API response, not our
// service's return value.
let squareOrderId: string;

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
    // Keep the raw Square order response for all tests to assert against
    let rawSquareOrder: Awaited<ReturnType<SquareClient["orders"]["get"]>>["order"];

    // Keep the input data used for independent expected-value computation
    let testItemPrice: number; // dollars
    let testItemQuantity: number;
    let itemTaxes: ItemTaxInfo[];

    // ExternalIdMapping records for independent catalog-ID verification
    let menuItemExternalId: string; // Square ITEM_VARIATION ID for the test item
    let taxCatalogIds: Map<string, string>; // taxConfigId → Square TAX catalog ID

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

      const sandboxCatalog: SquareCatalogResult = {
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
      testItemPrice = Number(testItem.price);
      testItemQuantity = 2;

      // Read the ExternalIdMapping for this menu item → Square ITEM_VARIATION
      const itemMapping = await prisma.externalIdMapping.findFirst({
        where: {
          tenantId: TENANT_ID,
          internalType: "MenuItem",
          internalId: testItem.id,
          externalSource: "SQUARE",
          externalType: "ITEM_VARIATION",
        },
      });
      expect(itemMapping).not.toBeNull();
      menuItemExternalId = itemMapping!.externalId;

      // Look up tax configs assigned to this item
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

      itemTaxes = menuItemTaxes.map((mit) => ({
        taxConfigId: mit.taxConfig.id,
        name: mit.taxConfig.name,
        rate: taxRateByConfigId.get(mit.taxConfig.id) ?? 0,
        roundingMethod: mit.taxConfig.roundingMethod as "half_up" | "half_even",
        inclusionType: mit.taxConfig.inclusionType as "additive" | "inclusive",
      }));

      // Read ExternalIdMapping for each TaxConfig → Square TAX
      taxCatalogIds = new Map();
      for (const tax of itemTaxes) {
        const taxMapping = await prisma.externalIdMapping.findFirst({
          where: {
            tenantId: TENANT_ID,
            internalType: "TaxConfig",
            internalId: tax.taxConfigId,
            externalSource: "SQUARE",
            externalType: "TAX",
          },
        });
        if (taxMapping) {
          taxCatalogIds.set(tax.taxConfigId, taxMapping.externalId);
        }
      }

      const subtotal = testItemPrice * testItemQuantity;
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
            price: testItemPrice,
            quantity: testItemQuantity,
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

      // 6. Call createOrder — then read back from Square API as source of truth
      const result = await squareOrderService.createOrder(
        TENANT_ID,
        MERCHANT_ID,
        pushInput
      );
      squareOrderId = result.squareOrderId;

      const getResp = await client.orders.get({ orderId: squareOrderId });
      rawSquareOrder = getResp.order;
    }, 90_000);

    afterAll(async () => {
      await cleanupTestData();
      await prisma.$disconnect();
    });

    // ================================================================
    // 1. Price transformation: dollars → cents (BigInt)
    //    buildLineItems: BigInt(Math.round(item.price * 100))
    //    If this conversion is wrong, Square's basePriceMoney won't
    //    match independently computed cents.
    // ================================================================

    it("line item basePriceMoney matches independently computed cents from input price", () => {
      const lineItem = rawSquareOrder!.lineItems![0];
      const expectedCents = BigInt(Math.round(testItemPrice * 100));

      expect(lineItem.basePriceMoney).toBeDefined();
      expect(lineItem.basePriceMoney!.amount).toBe(expectedCents);
      expect(lineItem.basePriceMoney!.currency).toBe("USD");
    });

    // ================================================================
    // 2. Catalog ID resolution: MenuItem → ITEM_VARIATION
    //    resolveExternalIds maps menuItemId → Square catalog variation.
    //    We independently read the ExternalIdMapping and compare against
    //    what Square actually received on the line item.
    // ================================================================

    it("line item catalogObjectId matches ExternalIdMapping for ITEM_VARIATION", () => {
      const lineItem = rawSquareOrder!.lineItems![0];

      // The line item on Square should reference the correct catalog variation
      expect(lineItem.catalogObjectId).toBe(menuItemExternalId);
    });

    // ================================================================
    // 3. Tax percentage encoding: rate 0.0875 → "8.7500"
    //    buildTaxes: (config.rate * 100).toFixed(4)
    //    If this encoding is wrong, Square's tax percentage string
    //    won't match independently computed values.
    // ================================================================

    it("tax percentage on Square matches independently computed value from DB rate", () => {
      if (itemTaxes.length === 0) return; // sandbox may have no taxes

      const squareTaxes = rawSquareOrder!.taxes ?? [];
      expect(squareTaxes.length).toBe(itemTaxes.length);

      for (const inputTax of itemTaxes) {
        // Independently compute what Square should receive
        const expectedPercentage = (inputTax.rate * 100).toFixed(4);
        const expectedType =
          inputTax.inclusionType === "inclusive" ? "INCLUSIVE" : "ADDITIVE";

        const matchingTax = squareTaxes.find((t) => t.name === inputTax.name);
        expect(matchingTax, `tax "${inputTax.name}" should exist on Square order`).toBeDefined();
        expect(matchingTax!.percentage).toBe(expectedPercentage);
        expect(matchingTax!.type).toBe(expectedType);
      }
    });

    // ================================================================
    // 4. Tax catalog ID mapping: TaxConfig → Square TAX
    //    buildTaxes resolves TaxConfig IDs via ExternalIdMapping.
    //    We independently read the mapping and compare against Square.
    // ================================================================

    it("tax catalogObjectId on Square matches ExternalIdMapping for TAX", () => {
      if (itemTaxes.length === 0) return;

      const squareTaxes = rawSquareOrder!.taxes ?? [];

      for (const inputTax of itemTaxes) {
        const expectedCatalogId = taxCatalogIds.get(inputTax.taxConfigId);
        if (!expectedCatalogId) continue; // no mapping = no catalogObjectId expected

        const matchingTax = squareTaxes.find((t) => t.name === inputTax.name);
        expect(matchingTax).toBeDefined();
        expect(matchingTax!.catalogObjectId).toBe(expectedCatalogId);
      }
    });

    // ================================================================
    // 5. Tax amount consistency: Square computes tax server-side.
    //    If our percentage encoding or applied-tax linkage is wrong,
    //    Square's computed totalTaxMoney will diverge from what we
    //    expect based on (subtotal × rate).
    // ================================================================

    it("Square-computed totalTaxMoney is consistent with input rates applied to subtotal", () => {
      const subtotalCents = testItemPrice * 100 * testItemQuantity;

      // Independently compute expected tax amount from input rates
      const additiveTaxes = itemTaxes.filter((t) => t.inclusionType === "additive");
      const expectedTaxCents = additiveTaxes.reduce(
        (sum, t) => sum + Math.round(subtotalCents * t.rate),
        0
      );

      const actualTaxCents = Number(rawSquareOrder!.totalTaxMoney?.amount ?? BigInt(0));

      // Allow 1 cent tolerance for rounding differences between our
      // per-tax Math.round and Square's internal rounding
      expect(Math.abs(actualTaxCents - expectedTaxCents)).toBeLessThanOrEqual(1);
    });

    // ================================================================
    // 6. No service charges when tipAmount = 0
    //    buildServiceCharges returns empty array → Square order has no
    //    service charges. Confirms zero values are NOT sent as $0 charges.
    // ================================================================

    it("no service charges when tipAmount and deliveryFee are zero", () => {
      const serviceCharges = rawSquareOrder!.serviceCharges ?? [];
      expect(serviceCharges).toHaveLength(0);
    });

    // ================================================================
    // 6b. Tip service charge (AUTO_GRATUITY) — separate order
    //     Creates a second order with non-zero tipAmount to verify the
    //     dollars-to-cents conversion and type mapping independently.
    //     If Square Sandbox rejects AUTO_GRATUITY, this test documents
    //     the limitation rather than silently hiding it.
    // ================================================================

    it("tip creates AUTO_GRATUITY service charge with correct cents on Square", async () => {
      const tipOrderId = generateEntityId();
      const tipOrderNumber = `ORD-TIP-${Date.now()}`;
      const tipAmount = 2.75;

      // Seed a separate internal order for tip test
      await prisma.order.create({
        data: {
          id: tipOrderId,
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          orderNumber: tipOrderNumber,
          status: "completed",
          fulfillmentStatus: "pending",
          orderMode: "pickup",
          subtotal: pushInput.items[0].price * pushInput.items[0].quantity,
          taxAmount: pushInput.taxAmount,
          totalAmount: pushInput.totalAmount + tipAmount,
          customerFirstName: "Tip",
          customerLastName: "Tester",
          customerPhone: "555-0200",
        },
      });
      await prisma.orderFulfillment.create({
        data: {
          id: generateEntityId(),
          orderId: tipOrderId,
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          status: "pending",
        },
      });

      const tipInput: SquareOrderPushInput = {
        ...pushInput,
        orderId: tipOrderId,
        orderNumber: tipOrderNumber,
        customerFirstName: "Tip",
        customerLastName: "Tester",
        customerPhone: "555-0200",
        tipAmount,
        totalAmount: pushInput.totalAmount + tipAmount,
      };

      const result = await squareOrderService.createOrder(
        TENANT_ID,
        MERCHANT_ID,
        tipInput
      );

      // Read back from Square API
      const client = new SquareClient({
        token: SANDBOX_TOKEN!,
        environment: SquareEnvironment.Sandbox,
      });
      const resp = await client.orders.get({ orderId: result.squareOrderId });
      const tipOrder = resp.order!;

      const serviceCharges = tipOrder.serviceCharges ?? [];
      const tipCharge = serviceCharges.find((sc) => sc.type === "AUTO_GRATUITY");
      expect(tipCharge, "tip should appear as AUTO_GRATUITY").toBeDefined();

      const expectedTipCents = BigInt(Math.round(tipAmount * 100));
      expect(tipCharge!.amountMoney?.amount).toBe(expectedTipCents);
      expect(tipCharge!.amountMoney?.currency).toBe("USD");
    }, 30_000);

    // ================================================================
    // 7. Fulfillment: orderMode "pickup" → type PICKUP, state PROPOSED,
    //    recipient fields correctly populated.
    //    buildFulfillment: displayName = `${first} ${last}`.trim()
    // ================================================================

    it("fulfillment type, state, and recipient match input independently", () => {
      const fulfillments = rawSquareOrder!.fulfillments ?? [];
      expect(fulfillments).toHaveLength(1);

      const f = fulfillments[0];
      expect(f.type).toBe("PICKUP"); // "pickup" orderMode → "PICKUP"
      expect(f.state).toBe("PROPOSED");

      // Independently compute expected displayName
      const expectedDisplayName =
        `${pushInput.customerFirstName} ${pushInput.customerLastName}`.trim();
      expect(f.pickupDetails?.recipient?.displayName).toBe(expectedDisplayName);
      expect(f.pickupDetails?.recipient?.phoneNumber).toBe(pushInput.customerPhone);
      expect(f.pickupDetails?.recipient?.emailAddress).toBe(pushInput.customerEmail);
      expect(f.pickupDetails?.scheduleType).toBe("ASAP");
    });

    // ================================================================
    // 8. Metadata: plovr_order_id and plovr_order_number
    //    createOrder sets metadata on the Square order.
    // ================================================================

    it("metadata contains plovr_order_id and plovr_order_number", () => {
      const metadata = rawSquareOrder!.metadata;
      expect(metadata).toBeDefined();
      expect(metadata!.plovr_order_id).toBe(ORDER_ID);
      expect(metadata!.plovr_order_number).toBe(ORDER_NUMBER);
    });

    // ================================================================
    // 9. ticketName = orderNumber
    // ================================================================

    it("ticketName on Square matches orderNumber", () => {
      expect(rawSquareOrder!.ticketName).toBe(ORDER_NUMBER);
    });

    // ================================================================
    // 10. referenceId = orderId (not orderNumber, not some other ID)
    // ================================================================

    it("referenceId on Square is the internal orderId", () => {
      expect(rawSquareOrder!.referenceId).toBe(ORDER_ID);
    });

    // ================================================================
    // 11. DB consistency: ExternalIdMapping and OrderFulfillment.externalVersion
    //     Fetch latest version from Square and compare against what
    //     our service persisted in the DB.
    // ================================================================

    it("DB externalOrderId matches Square order ID and externalVersion matches Square version", async () => {
      const orderMapping = await prisma.externalIdMapping.findFirst({
        where: {
          tenantId: TENANT_ID,
          internalType: "Order",
          internalId: ORDER_ID,
          externalSource: "SQUARE",
        },
      });
      expect(orderMapping).not.toBeNull();
      expect(orderMapping!.externalId).toBe(squareOrderId);

      const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId: ORDER_ID },
      });
      expect(fulfillment).not.toBeNull();
      expect(fulfillment!.externalVersion).toBe(Number(rawSquareOrder!.version));
    });

    // ================================================================
    // 12. Fulfillment state update: "confirmed" → RESERVED on Square
    //     Also verifies version increments (optimistic concurrency).
    // ================================================================

    it("updateOrderStatus changes fulfillment to RESERVED and increments version", async () => {
      const versionBefore = Number(rawSquareOrder!.version);

      await squareOrderService.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        ORDER_ID,
        "confirmed"
      );

      // Read back from Square API
      const client = new SquareClient({
        token: SANDBOX_TOKEN!,
        environment: SquareEnvironment.Sandbox,
      });
      const response = await client.orders.get({ orderId: squareOrderId });
      const updated = response.order;

      expect(updated!.fulfillments?.[0]?.state).toBe("RESERVED");
      expect(Number(updated!.version)).toBeGreaterThan(versionBefore);

      // DB externalVersion should also be updated
      const dbFulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId: ORDER_ID },
      });
      expect(dbFulfillment!.externalVersion).toBe(Number(updated!.version));
    }, 30_000);

    // ================================================================
    // 13. Idempotency: same input → same idempotency key → same order
    //     (Square dedup, not our service returning cached value)
    // ================================================================

    it("idempotent create returns same order via Square dedup", async () => {
      const retryResult = await squareOrderService.createOrder(
        TENANT_ID,
        MERCHANT_ID,
        pushInput
      );

      expect(retryResult.squareOrderId).toBe(squareOrderId);
    }, 30_000);
  }
);
