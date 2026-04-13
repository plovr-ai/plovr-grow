/**
 * P1 Concurrency Guards Integration Tests
 *
 * Verifies that optimistic-locking (CAS) guards work correctly against a
 * real MySQL database:
 *
 * 1. Fulfillment optimistic locking: if the status changes between read
 *    and write, the transition throws FULFILLMENT_CONCURRENT_CONFLICT.
 * 2. Payment status atomic CAS: updatePaymentStatus skips the event when
 *    the DB row was already changed by a concurrent request.
 * 3. Cancel order atomic CAS: cancelOrder skips the event when the DB row
 *    was already canceled by a concurrent request.
 *
 * These tests simulate the race window deterministically — they modify DB
 * state between the service-level read and the CAS write — rather than
 * relying on Promise.allSettled to create true thread-level concurrency
 * (which is unreliable in single-threaded Node.js).
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
import { fulfillmentRepository } from "@/repositories/fulfillment.repository";
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
    it("throws CONCURRENT_CONFLICT when DB status differs from expected fromStatus", async () => {
      const orderId = await createPaidOrder();

      const fulfillment = await prisma.orderFulfillment.findFirst({ where: { orderId } });
      expect(fulfillment!.status).toBe("pending");

      // Simulate a concurrent request winning: advance DB from pending → confirmed
      await prisma.orderFulfillment.update({
        where: { id: fulfillment!.id },
        data: { status: "confirmed" },
      });

      // Call repository directly with stale fromStatus='pending'.
      // This simulates the exact race: service read 'pending', but DB is now
      // 'confirmed'. The CAS WHERE status='pending' returns count=0.
      await expect(
        fulfillmentRepository.transitionStatus(
          TENANT_ID,
          fulfillment!.id,
          orderId,
          "pending",    // stale fromStatus
          "confirmed",  // toStatus
          "internal"
        )
      ).rejects.toThrow("FULFILLMENT_CONCURRENT_CONFLICT");

      // DB should remain at 'confirmed' (the winning request's state)
      const dbFulfillment = await prisma.orderFulfillment.findFirst({ where: { orderId } });
      expect(dbFulfillment!.status).toBe("confirmed");

      // No status log should have been written by the failed request
      const logs = await prisma.fulfillmentStatusLog.findMany({
        where: { fulfillmentId: fulfillment!.id },
      });
      expect(logs).toHaveLength(0);
    });

    it("CAS prevents stale write from overwriting a newer status", async () => {
      const orderId = await createPaidOrder();
      const fulfillment = await prisma.orderFulfillment.findFirst({ where: { orderId } });

      // Simulate: another request advanced the order all the way to 'preparing'
      await prisma.orderFulfillment.update({
        where: { id: fulfillment!.id },
        data: { status: "preparing" },
      });

      // A stale request tries to write 'confirmed' with fromStatus='pending'
      // CAS fails because DB status is 'preparing', not 'pending'
      await expect(
        fulfillmentRepository.transitionStatus(
          TENANT_ID,
          fulfillment!.id,
          orderId,
          "pending",    // stale fromStatus
          "confirmed",  // toStatus
          "internal"
        )
      ).rejects.toThrow("FULFILLMENT_CONCURRENT_CONFLICT");

      // DB should remain at 'preparing'
      const dbFulfillment = await prisma.orderFulfillment.findFirst({ where: { orderId } });
      expect(dbFulfillment!.status).toBe("preparing");
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

      const fulfillment = await prisma.orderFulfillment.findFirst({ where: { orderId } });
      const logs = await prisma.fulfillmentStatusLog.findMany({
        where: { fulfillmentId: fulfillment!.id },
        orderBy: { createdAt: "asc" },
      });
      expect(logs).toHaveLength(4);
    });

    it("writes exactly one status log per successful transition", async () => {
      const orderId = await createPaidOrder();

      await fulfillmentService.transitionStatus(TENANT_ID, orderId, {
        fulfillmentStatus: "confirmed",
        source: "square_webhook",
        externalVersion: 2,
      });

      const fulfillment = await prisma.orderFulfillment.findFirst({ where: { orderId } });
      const logs = await prisma.fulfillmentStatusLog.findMany({
        where: { fulfillmentId: fulfillment!.id },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].fromStatus).toBe("pending");
      expect(logs[0].toStatus).toBe("confirmed");
      expect(logs[0].source).toBe("square_webhook");

      // externalVersion should be persisted
      expect(fulfillment!.externalVersion).toBe(2);
    });
  });

  // =========================================================================
  // 2. Payment status atomic CAS
  // =========================================================================
  describe("Payment status atomic CAS", () => {
    it("skips event when order was already completed by a concurrent request", async () => {
      const orderId = await createUnpaidOrder();

      // Simulate: another request already marked it completed directly in DB
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "completed", paidAt: new Date() },
      });

      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      // This call reads the order (sees 'created' in the read cache or 'completed'
      // from DB). Either way, the CAS updateMany WHERE status != 'completed'
      // returns count=0, so no event is emitted.
      await orderService.updatePaymentStatus(TENANT_ID, orderId, "completed");

      const paidEvents = emitSpy.mock.calls.filter((c) => c[0] === "order.paid");
      expect(paidEvents).toHaveLength(0);

      // DB should remain completed
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.status).toBe("completed");
    });

    it("successfully marks as completed and emits event when not yet completed", async () => {
      const orderId = await createUnpaidOrder();
      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      await orderService.updatePaymentStatus(TENANT_ID, orderId, "completed");

      const paidEvents = emitSpy.mock.calls.filter((c) => c[0] === "order.paid");
      expect(paidEvents).toHaveLength(1);

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.status).toBe("completed");
      expect(dbOrder!.paidAt).not.toBeNull();
    });

    it("payment_failed does not overwrite completed status", async () => {
      const orderId = await createUnpaidOrder();

      // First: mark as completed
      await orderService.updatePaymentStatus(TENANT_ID, orderId, "completed");

      // Then: try to mark as payment_failed — should be no-op
      await orderService.updatePaymentStatus(TENANT_ID, orderId, "payment_failed");

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.status).toBe("completed");
    });
  });

  // =========================================================================
  // 3. Cancel order atomic CAS
  // =========================================================================
  describe("Cancel order atomic CAS", () => {
    it("skips event when order was already canceled by a concurrent request", async () => {
      const orderId = await createPaidOrder();

      // Simulate: another request already canceled it in DB
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "canceled", cancelledAt: new Date(), cancelReason: "First cancel" },
      });

      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      // This call reads the order and sees 'canceled' → returns early (idempotent guard)
      await orderService.cancelOrder(TENANT_ID, orderId, "Late cancel");

      const cancelEvents = emitSpy.mock.calls.filter((c) => c[0] === "order.cancelled");
      expect(cancelEvents).toHaveLength(0);

      // Original reason should be preserved
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.cancelReason).toBe("First cancel");
    });

    it("successfully cancels and emits event when not yet canceled", async () => {
      const orderId = await createPaidOrder();
      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      await orderService.cancelOrder(TENANT_ID, orderId, "Customer request");

      const cancelEvents = emitSpy.mock.calls.filter((c) => c[0] === "order.cancelled");
      expect(cancelEvents).toHaveLength(1);

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.status).toBe("canceled");
      expect(dbOrder!.cancelReason).toBe("Customer request");
    });

    it("second cancel is idempotent no-op", async () => {
      const orderId = await createPaidOrder();

      await orderService.cancelOrder(TENANT_ID, orderId, "First cancel");

      const emitSpy = vi.spyOn(orderEventEmitter, "emit");
      await orderService.cancelOrder(TENANT_ID, orderId, "Second cancel");

      const cancelEvents = emitSpy.mock.calls.filter((c) => c[0] === "order.cancelled");
      expect(cancelEvents).toHaveLength(0);

      // Reason should remain from the first cancel
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.cancelReason).toBe("First cancel");
    });
  });
});
