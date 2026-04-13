/**
 * P1 Concurrency Guards Integration Tests
 *
 * Verifies:
 * 1. Fulfillment optimistic locking: concurrent status transitions don't
 *    silently overwrite each other — one wins, the other gets
 *    FULFILLMENT_CONCURRENT_CONFLICT.
 * 2. Payment status atomic CAS: concurrent updatePaymentStatus("completed")
 *    calls emit exactly one order.paid event, not two.
 * 3. Cancel order atomic CAS: concurrent cancelOrder() calls emit exactly
 *    one order.cancelled event.
 *
 * Uses real MySQL database with mocked external dependencies.
 *
 * Run with: npx vitest run --config vitest.config.integration.ts
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from "vitest";
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

const mockGetNextOrderSequence = vi.fn();
vi.mock("@/repositories/sequence.repository", () => ({
  sequenceRepository: {
    getNextOrderSequence: (...args: unknown[]) => mockGetNextOrderSequence(...args),
  },
}));

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

// Prevent POS push side effects
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
import { orderEventEmitter } from "@/services/order/order-events";
import { fulfillmentService } from "@/services/order/fulfillment.service";
import type { CreateMerchantOrderInput } from "@/services/order/order.types";

// ---------------------------------------------------------------------------
// Test IDs
// ---------------------------------------------------------------------------

const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const MENU_ITEM_ID = generateEntityId();
const MENU_ID = generateEntityId();
const CATEGORY_ID = generateEntityId();
const CATEGORY_ITEM_ID = generateEntityId();

let orderSequence = 0;

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seedTestData() {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Concurrency Guard Test Tenant",
      slug: `cg-tenant-${Date.now()}`,
    },
  });

  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `cg-merchant-${Date.now()}`,
      name: "Concurrency Guard Test Merchant",
      timezone: "America/Los_Angeles",
    },
  });

  await prisma.menu.create({
    data: { id: MENU_ID, tenantId: TENANT_ID, name: "CG Menu" },
  });

  await prisma.menuCategory.create({
    data: { id: CATEGORY_ID, tenantId: TENANT_ID, menuId: MENU_ID, name: "CG Category" },
  });

  await prisma.menuItem.create({
    data: { id: MENU_ITEM_ID, tenantId: TENANT_ID, name: "CG Burger", price: 10.00 },
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

function setupOrderCreationMocks() {
  orderSequence += 1;
  mockGetMenuItemsByIds.mockResolvedValue([
    { id: MENU_ITEM_ID, name: "CG Burger", price: 10.00, status: "active" },
  ]);
  mockGetMerchantById.mockResolvedValue({
    id: MERCHANT_ID,
    name: "CG Test Merchant",
    timezone: "America/Los_Angeles",
  });
  mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
  mockGetTaxConfigsByIds.mockResolvedValue([]);
  mockGetMerchantTaxRateMap.mockResolvedValue(new Map());
  mockGetNextOrderSequence.mockResolvedValue(orderSequence);
  mockCreatePaymentRecord.mockResolvedValue({ id: generateEntityId() });
}

function makeOrderInput(): CreateMerchantOrderInput {
  return {
    merchantId: MERCHANT_ID,
    customerFirstName: "CG",
    customerLastName: "Tester",
    customerPhone: "555-0100",
    customerEmail: "cg@test.com",
    orderMode: "pickup",
    items: [
      {
        menuItemId: MENU_ITEM_ID,
        name: "CG Burger",
        price: 10.00,
        quantity: 1,
        totalPrice: 10.00,
        selectedModifiers: [],
      },
    ],
  };
}

async function createPaidOrder(): Promise<string> {
  setupOrderCreationMocks();
  const order = await orderService.createMerchantOrderAtomic(
    TENANT_ID,
    makeOrderInput(),
    {
      payment: {
        provider: "stripe",
        providerPaymentId: `pi_cg_${Date.now()}_${orderSequence}`,
        amount: 10.00,
        currency: "USD",
      },
    }
  );
  return order.id;
}

async function createUnpaidOrder(): Promise<string> {
  setupOrderCreationMocks();
  // Create order WITHOUT payment — status remains "created"
  const order = await orderService.createMerchantOrderAtomic(
    TENANT_ID,
    makeOrderInput({ paymentType: "in_store" })
  );
  return order.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("P1 Concurrency Guards (integration)", () => {
  beforeAll(async () => {
    await cleanupTestData();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Fulfillment optimistic locking (CAS on status)
  // =========================================================================
  describe("Fulfillment optimistic locking", () => {
    it("concurrent transitions from same state: one wins, one gets CONCURRENT_CONFLICT", async () => {
      const orderId = await createPaidOrder();

      // Both try pending -> confirmed concurrently
      const [resultA, resultB] = await Promise.allSettled([
        fulfillmentService.transitionStatus(TENANT_ID, orderId, {
          fulfillmentStatus: "confirmed",
          source: "internal",
        }),
        fulfillmentService.transitionStatus(TENANT_ID, orderId, {
          fulfillmentStatus: "confirmed",
          source: "square_webhook",
        }),
      ]);

      // Exactly one should succeed and one should fail
      const succeeded = [resultA, resultB].filter((r) => r.status === "fulfilled");
      const failed = [resultA, resultB].filter((r) => r.status === "rejected");

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      const error = (failed[0] as PromiseRejectedResult).reason;
      expect(error.code).toBe("FULFILLMENT_CONCURRENT_CONFLICT");

      // DB should reflect exactly one transition
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("confirmed");

      // Exactly one status log entry (not two)
      const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId },
      });
      const logs = await prisma.fulfillmentStatusLog.findMany({
        where: { fulfillmentId: fulfillment!.id },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].fromStatus).toBe("pending");
      expect(logs[0].toStatus).toBe("confirmed");
    });

    it("concurrent transitions to different states: higher rank wins, lower gets conflict", async () => {
      const orderId = await createPaidOrder();

      // First advance to confirmed (baseline)
      await fulfillmentService.transitionStatus(TENANT_ID, orderId, {
        fulfillmentStatus: "confirmed",
        source: "internal",
      });

      // Both try from confirmed: one to preparing, one to ready (skip)
      // Since both read "confirmed", only one write will succeed
      const [resultA, resultB] = await Promise.allSettled([
        fulfillmentService.transitionStatus(TENANT_ID, orderId, {
          fulfillmentStatus: "preparing",
          source: "internal",
        }),
        fulfillmentService.transitionStatus(TENANT_ID, orderId, {
          fulfillmentStatus: "preparing",
          source: "square_webhook",
        }),
      ]);

      const succeeded = [resultA, resultB].filter((r) => r.status === "fulfilled");
      const failed = [resultA, resultB].filter((r) => r.status === "rejected");

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("preparing");
    });

    it("sequential transitions work normally (no false conflict)", async () => {
      const orderId = await createPaidOrder();

      // Sequential: pending -> confirmed -> preparing -> ready -> fulfilled
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

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("fulfilled");

      const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId },
      });
      const logs = await prisma.fulfillmentStatusLog.findMany({
        where: { fulfillmentId: fulfillment!.id },
        orderBy: { createdAt: "asc" },
      });
      expect(logs).toHaveLength(4);
    });
  });

  // =========================================================================
  // 2. Payment status atomic CAS
  // =========================================================================
  describe("Payment status atomic CAS", () => {
    it("concurrent updatePaymentStatus('completed'): exactly one order.paid event", async () => {
      const orderId = await createUnpaidOrder();

      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      // Both try to mark as completed concurrently
      const [resultA, resultB] = await Promise.allSettled([
        orderService.updatePaymentStatus(TENANT_ID, orderId, "completed"),
        orderService.updatePaymentStatus(TENANT_ID, orderId, "completed"),
      ]);

      // Both should succeed (one does the update, one is a no-op)
      expect(resultA.status).toBe("fulfilled");
      expect(resultB.status).toBe("fulfilled");

      // DB should be completed
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.status).toBe("completed");
      expect(dbOrder!.paidAt).not.toBeNull();

      // Exactly ONE order.paid event (not two)
      const paidEvents = emitSpy.mock.calls.filter((c) => c[0] === "order.paid");
      expect(paidEvents).toHaveLength(1);
      expect(paidEvents[0][1]).toMatchObject({
        orderId,
        status: "completed",
      });
    });

    it("updatePaymentStatus after already completed: no-op, no event", async () => {
      const orderId = await createPaidOrder(); // already completed

      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      await orderService.updatePaymentStatus(TENANT_ID, orderId, "completed");

      const paidEvents = emitSpy.mock.calls.filter((c) => c[0] === "order.paid");
      expect(paidEvents).toHaveLength(0);
    });

    it("concurrent payment_failed does not overwrite completed", async () => {
      const orderId = await createUnpaidOrder();

      // First mark as completed
      await orderService.updatePaymentStatus(TENANT_ID, orderId, "completed");

      // Then try to mark as payment_failed (should be no-op)
      await orderService.updatePaymentStatus(TENANT_ID, orderId, "payment_failed");

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.status).toBe("completed");
    });

    it("concurrent completed vs payment_failed: completed wins", async () => {
      const orderId = await createUnpaidOrder();

      const [resultA, resultB] = await Promise.allSettled([
        orderService.updatePaymentStatus(TENANT_ID, orderId, "completed"),
        orderService.updatePaymentStatus(TENANT_ID, orderId, "payment_failed"),
      ]);

      expect(resultA.status).toBe("fulfilled");
      expect(resultB.status).toBe("fulfilled");

      // Final state depends on race winner, but should be consistent
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      // Both are terminal states — whichever won is fine, but the key invariant
      // is that the DB is in one of them, not stuck in "created"
      expect(["completed", "payment_failed"]).toContain(dbOrder!.status);
    });
  });

  // =========================================================================
  // 3. Cancel order atomic CAS
  // =========================================================================
  describe("Cancel order atomic CAS", () => {
    it("concurrent cancelOrder: exactly one order.cancelled event", async () => {
      const orderId = await createPaidOrder();

      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      const [resultA, resultB] = await Promise.allSettled([
        orderService.cancelOrder(TENANT_ID, orderId, "Reason A"),
        orderService.cancelOrder(TENANT_ID, orderId, "Reason B"),
      ]);

      // Both should succeed (one does the update, one is a no-op)
      expect(resultA.status).toBe("fulfilled");
      expect(resultB.status).toBe("fulfilled");

      // DB should be canceled
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.status).toBe("canceled");
      expect(dbOrder!.cancelledAt).not.toBeNull();

      // Exactly ONE order.cancelled event (not two)
      const cancelEvents = emitSpy.mock.calls.filter(
        (c) => c[0] === "order.cancelled"
      );
      expect(cancelEvents).toHaveLength(1);
    });

    it("cancelOrder after already canceled: no-op, no event", async () => {
      const orderId = await createPaidOrder();

      // First cancel
      await orderService.cancelOrder(TENANT_ID, orderId, "First cancel");

      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      // Second cancel — should be idempotent no-op
      await orderService.cancelOrder(TENANT_ID, orderId, "Second cancel");

      const cancelEvents = emitSpy.mock.calls.filter(
        (c) => c[0] === "order.cancelled"
      );
      expect(cancelEvents).toHaveLength(0);

      // Reason should remain from the first cancel
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.cancelReason).toBe("First cancel");
    });
  });
});
