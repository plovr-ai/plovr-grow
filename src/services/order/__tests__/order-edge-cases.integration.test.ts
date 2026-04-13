/**
 * Order Edge Cases Integration Tests
 *
 * Covers concurrency, idempotency, and edge cases that existing tests miss:
 *
 * 1. Concurrent order creation — 5 simultaneous orders, verify unique order numbers
 * 2. Concurrent fulfillment transitions — exactly 1 CAS winner
 * 3. Duplicate order cancellation — idempotent behavior
 * 4. Zero subtotal order — free item
 * 5. Discount exceeds subtotal — balanceDue clamped to 0
 * 6. Invalid fulfillment state transition — backward rejected
 *
 * Run with: npx vitest run --config vitest.config.integration.ts
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { generateEntityId } from "@/lib/id";

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE importing any service modules
// ---------------------------------------------------------------------------

const mockGetMenuItemsByIds = vi.fn();
vi.mock("@/services/menu", () => ({
  menuService: {
    getMenuItemsByIds: (...args: unknown[]) => mockGetMenuItemsByIds(...args),
  },
}));

const mockGetMerchantById = vi.fn();
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantById: (...args: unknown[]) => mockGetMerchantById(...args),
  },
}));

const mockGetMenuItemsTaxConfigIds = vi.fn();
const mockGetTaxConfigsByIds = vi.fn();
const mockGetMerchantTaxRateMap = vi.fn();
vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getMenuItemsTaxConfigIds: (...args: unknown[]) => mockGetMenuItemsTaxConfigIds(...args),
    getTaxConfigsByIds: (...args: unknown[]) => mockGetTaxConfigsByIds(...args),
    getMerchantTaxRateMap: (...args: unknown[]) => mockGetMerchantTaxRateMap(...args),
  },
}));

// DO NOT mock sequenceRepository — let it hit the real DB for concurrency tests

vi.mock("@/services/giftcard", () => ({
  giftCardService: {
    redeemGiftCard: vi.fn(),
  },
}));

const mockCreatePaymentRecord = vi.fn();
vi.mock("@/services/payment", () => ({
  paymentService: {
    createPaymentRecord: (...args: unknown[]) => mockCreatePaymentRecord(...args),
  },
}));

vi.mock("@/services/integration/pos-provider-registry", () => ({
  posProviderRegistry: {
    getProvider: () => ({
      type: "POS_SQUARE",
      pushOrder: vi.fn().mockResolvedValue({ externalOrderId: "sq-mock" }),
      updateFulfillment: vi.fn(),
      cancelOrder: vi.fn(),
    }),
  },
}));

vi.mock("@/services/square/square.service", () => ({
  squareService: { syncCatalog: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Real PrismaClient + override @/lib/db
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

// ---------------------------------------------------------------------------
// Import real services AFTER mocks are set up
// ---------------------------------------------------------------------------

import { orderService } from "@/services/order/order.service";
import { fulfillmentService } from "@/services/order/fulfillment.service";
import type { CreateMerchantOrderInput } from "@/services/order/order.types";

// ---------------------------------------------------------------------------
// Test IDs (unique per run)
// ---------------------------------------------------------------------------

const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const MENU_ITEM_ID = generateEntityId();
const MENU_ID = generateEntityId();
const CATEGORY_ID = generateEntityId();
const CATEGORY_ITEM_ID = generateEntityId();

const MERCHANT_TIMEZONE = "America/Los_Angeles";

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seedTestData() {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Edge Case Test Tenant",
      slug: `ec-tenant-${Date.now()}`,
    },
  });

  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `ec-merchant-${Date.now()}`,
      name: "Edge Case Test Merchant",
      timezone: MERCHANT_TIMEZONE,
    },
  });

  await prisma.menu.create({
    data: { id: MENU_ID, tenantId: TENANT_ID, name: "EC Menu" },
  });

  await prisma.menuCategory.create({
    data: { id: CATEGORY_ID, tenantId: TENANT_ID, menuId: MENU_ID, name: "EC Category" },
  });

  await prisma.menuItem.create({
    data: { id: MENU_ITEM_ID, tenantId: TENANT_ID, name: "EC Burger", price: 10.00 },
  });

  await prisma.menuCategoryItem.create({
    data: { id: CATEGORY_ITEM_ID, tenantId: TENANT_ID, categoryId: CATEGORY_ID, menuItemId: MENU_ITEM_ID },
  });
}

async function cleanupTestData() {
  await prisma.fulfillmentStatusLog.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderFulfillment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationSyncRecord.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderItemModifier.deleteMany({
    where: { orderItem: { order: { tenantId: TENANT_ID } } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { tenantId: TENANT_ID } },
  });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderSequence.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuCategoryItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuCategory.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menu.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupOrderCreationMocks(overrides?: { price?: number }) {
  const price = overrides?.price ?? 10.00;
  mockGetMenuItemsByIds.mockResolvedValue([
    { id: MENU_ITEM_ID, name: "EC Burger", price, status: "active" },
  ]);
  mockGetMerchantById.mockResolvedValue({
    id: MERCHANT_ID,
    name: "Edge Case Test Merchant",
    timezone: MERCHANT_TIMEZONE,
  });
  mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
  mockGetTaxConfigsByIds.mockResolvedValue([]);
  mockGetMerchantTaxRateMap.mockResolvedValue(new Map());
  mockCreatePaymentRecord.mockResolvedValue({ id: generateEntityId() });
}

function makeOrderInput(overrides: Partial<CreateMerchantOrderInput> = {}): CreateMerchantOrderInput {
  return {
    merchantId: MERCHANT_ID,
    customerFirstName: "EC",
    customerLastName: "Tester",
    customerPhone: "555-0200",
    customerEmail: "ec@test.com",
    orderMode: "pickup",
    items: [
      {
        menuItemId: MENU_ITEM_ID,
        name: "EC Burger",
        price: 10.00,
        quantity: 1,
        totalPrice: 10.00,
        selectedModifiers: [],
      },
    ],
    ...overrides,
  };
}

async function createPaidOrder(
  overrides?: Partial<CreateMerchantOrderInput>,
  paymentAmount?: number
): Promise<string> {
  const amount = paymentAmount ?? 10.00;
  const order = await orderService.createMerchantOrderAtomic(
    TENANT_ID,
    makeOrderInput(overrides),
    {
      payment: {
        provider: "stripe",
        providerPaymentId: `pi_ec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        amount,
        currency: "USD",
      },
    }
  );
  return order.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Order Edge Cases (integration)", () => {
  beforeAll(async () => {
    await cleanupTestData();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // =========================================================================
  // Block 1: Concurrent order creation
  // =========================================================================
  describe("Concurrent order creation", () => {
    it("5 concurrent orders all succeed with unique order numbers", async () => {
      setupOrderCreationMocks();

      const promises = Array.from({ length: 5 }, (_, i) =>
        orderService.createMerchantOrderAtomic(
          TENANT_ID,
          makeOrderInput({
            customerFirstName: `Concurrent-${i}`,
            customerPhone: `555-020${i}`,
          }),
          {
            payment: {
              provider: "stripe",
              providerPaymentId: `pi_concurrent_${Date.now()}_${i}`,
              amount: 10.00,
              currency: "USD",
            },
          }
        )
      );

      const results = await Promise.allSettled(promises);

      // All 5 should succeed
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(5);

      // All 5 should have unique order numbers
      const orderNumbers = fulfilled.map(
        (r) => (r as PromiseFulfilledResult<{ orderNumber: string }>).value.orderNumber
      );
      const uniqueNumbers = new Set(orderNumbers);
      expect(uniqueNumbers.size).toBe(5);

      // All 5 should have unique IDs
      const orderIds = fulfilled.map(
        (r) => (r as PromiseFulfilledResult<{ id: string }>).value.id
      );
      const uniqueIds = new Set(orderIds);
      expect(uniqueIds.size).toBe(5);

      // All 5 should exist in the DB
      const dbOrders = await prisma.order.findMany({
        where: { tenantId: TENANT_ID, id: { in: orderIds } },
      });
      expect(dbOrders).toHaveLength(5);
    });
  });

  // =========================================================================
  // Block 2: Concurrent fulfillment transitions
  // =========================================================================
  describe("Concurrent fulfillment transitions", () => {
    it("exactly 1 succeeds and 2 fail with CAS conflict for 3 concurrent transitions", async () => {
      setupOrderCreationMocks();
      const orderId = await createPaidOrder();

      // Verify starting state is pending
      const fulfillment = await prisma.orderFulfillment.findFirst({ where: { orderId } });
      expect(fulfillment).not.toBeNull();
      expect(fulfillment!.status).toBe("pending");

      // Fire 3 concurrent transitions from pending -> confirmed
      const promises = Array.from({ length: 3 }, () =>
        fulfillmentService.transitionStatus(TENANT_ID, orderId, {
          fulfillmentStatus: "confirmed",
          source: "internal",
        })
      );

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly 1 should succeed, exactly 2 should fail with CAS conflict
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);

      for (const r of rejected) {
        const reason = (r as PromiseRejectedResult).reason;
        expect(String(reason)).toContain("FULFILLMENT_CONCURRENT_CONFLICT");
      }

      // DB should be in confirmed state
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("confirmed");

      // Exactly 1 status log entry
      const dbFulfillment = await prisma.orderFulfillment.findFirst({ where: { orderId } });
      const logs = await prisma.fulfillmentStatusLog.findMany({
        where: { fulfillmentId: dbFulfillment!.id },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].fromStatus).toBe("pending");
      expect(logs[0].toStatus).toBe("confirmed");
    });
  });

  // =========================================================================
  // Block 3: Duplicate order cancellation is idempotent
  // =========================================================================
  describe("Duplicate order cancellation is idempotent", () => {
    it("second cancel is a no-op and preserves the first cancel reason", async () => {
      setupOrderCreationMocks();
      const orderId = await createPaidOrder();

      // First cancellation
      await orderService.cancelOrder(TENANT_ID, orderId, "Customer changed mind");

      const afterFirst = await prisma.order.findUnique({ where: { id: orderId } });
      expect(afterFirst!.status).toBe("canceled");
      expect(afterFirst!.cancelReason).toBe("Customer changed mind");
      expect(afterFirst!.cancelledAt).not.toBeNull();
      const firstCancelledAt = afterFirst!.cancelledAt!;

      // Second cancellation with a different reason
      await orderService.cancelOrder(TENANT_ID, orderId, "Duplicate request");

      const afterSecond = await prisma.order.findUnique({ where: { id: orderId } });
      expect(afterSecond!.status).toBe("canceled");
      // Reason should be from the FIRST call
      expect(afterSecond!.cancelReason).toBe("Customer changed mind");
      // cancelledAt should be preserved from first call
      expect(afterSecond!.cancelledAt!.getTime()).toBe(firstCancelledAt.getTime());

      // Verify fulfillment cancelledAt is set (via manual transition for this test)
      // Note: cancelOrder does not automatically transition fulfillment, but we
      // verify the order-level fields are idempotent
    });
  });

  // =========================================================================
  // Block 4: Edge case: zero subtotal order
  // =========================================================================
  describe("Edge case: zero subtotal order", () => {
    it("creates an order with $0.00 item successfully", async () => {
      setupOrderCreationMocks({ price: 0 });

      const order = await orderService.createMerchantOrderAtomic(
        TENANT_ID,
        makeOrderInput({
          items: [
            {
              menuItemId: MENU_ITEM_ID,
              name: "Free Sample",
              price: 0,
              quantity: 1,
              totalPrice: 0,
              selectedModifiers: [],
            },
          ],
        }),
        {
          payment: {
            provider: "stripe",
            providerPaymentId: `pi_zero_${Date.now()}`,
            amount: 0,
            currency: "USD",
          },
        }
      );

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();

      const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(dbOrder).not.toBeNull();
      expect(Number(dbOrder!.subtotal)).toBe(0);
      expect(Number(dbOrder!.totalAmount)).toBe(0);
      expect(dbOrder!.status).toBe("completed");
    });
  });

  // =========================================================================
  // Block 5: Edge case: discount exceeds subtotal
  // =========================================================================
  describe("Edge case: discount exceeds subtotal", () => {
    it("balanceDue is clamped to 0 when gift card payment exceeds total", async () => {
      setupOrderCreationMocks();

      // Order total is $10, but gift card pays $15
      const order = await orderService.createMerchantOrderAtomic(
        TENANT_ID,
        makeOrderInput({
          giftCardPayment: 15,
        })
      );

      expect(order).toBeDefined();

      const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(dbOrder).not.toBeNull();
      expect(Number(dbOrder!.subtotal)).toBeCloseTo(10.00, 2);
      // balanceDue should be clamped to 0, NOT negative
      expect(Number(dbOrder!.balanceDue)).toBe(0);
      expect(Number(dbOrder!.giftCardPayment)).toBe(15);
      // Order should be completed because gift card covers full amount
      expect(dbOrder!.status).toBe("completed");
    });
  });

  // =========================================================================
  // Block 6: Invalid fulfillment state transition rejected
  // =========================================================================
  describe("Invalid fulfillment state transition rejected", () => {
    it("rejects backward transition from fulfilled to pending", async () => {
      setupOrderCreationMocks();
      const orderId = await createPaidOrder();

      // Advance to fulfilled: pending -> confirmed -> preparing -> ready -> fulfilled
      await fulfillmentService.transitionStatus(TENANT_ID, orderId, {
        fulfillmentStatus: "confirmed",
        source: "internal",
      });
      await fulfillmentService.transitionStatus(TENANT_ID, orderId, {
        fulfillmentStatus: "preparing",
        source: "internal",
      });
      await fulfillmentService.transitionStatus(TENANT_ID, orderId, {
        fulfillmentStatus: "ready",
        source: "internal",
      });
      await fulfillmentService.transitionStatus(TENANT_ID, orderId, {
        fulfillmentStatus: "fulfilled",
        source: "internal",
      });

      // Verify fulfilled state
      const dbOrderBefore = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrderBefore!.fulfillmentStatus).toBe("fulfilled");

      // Try backward transition: fulfilled -> pending
      await expect(
        fulfillmentService.transitionStatus(TENANT_ID, orderId, {
          fulfillmentStatus: "pending",
          source: "internal",
        })
      ).rejects.toThrow("INVALID_FULFILLMENT_STATUS_TRANSITION");

      // DB should remain at fulfilled
      const dbOrderAfter = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrderAfter!.fulfillmentStatus).toBe("fulfilled");
    });

    it("rejects transition from canceled (terminal state)", async () => {
      setupOrderCreationMocks();
      const orderId = await createPaidOrder();

      // Transition to canceled: pending -> canceled
      await fulfillmentService.transitionStatus(TENANT_ID, orderId, {
        fulfillmentStatus: "canceled",
        source: "internal",
      });

      const dbOrderBefore = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrderBefore!.fulfillmentStatus).toBe("canceled");

      // Try transition from canceled -> confirmed
      await expect(
        fulfillmentService.transitionStatus(TENANT_ID, orderId, {
          fulfillmentStatus: "confirmed",
          source: "internal",
        })
      ).rejects.toThrow("INVALID_FULFILLMENT_STATUS_TRANSITION");

      // DB should remain at canceled
      const dbOrderAfter = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrderAfter!.fulfillmentStatus).toBe("canceled");
    });
  });
});
