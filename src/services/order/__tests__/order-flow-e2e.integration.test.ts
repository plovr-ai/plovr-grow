/**
 * Order Flow E2E Integration Test
 *
 * Verifies the complete order lifecycle with Square POS integration:
 * 1. Order creation via createMerchantOrderAtomic
 * 2. Square POS push via order-listener event handler
 * 3. Webhook-driven fulfillment state transitions
 * 4. Order cancellation via Square webhook
 * 5. Guard mechanisms (stale version, loop prevention, monotonic rank)
 * 6. Square push failure with retry record creation
 *
 * Uses real MySQL database with mocked external dependencies.
 *
 * Run with: npx vitest run --config vitest.config.integration.ts
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { generateEntityId } from "@/lib/id";

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE importing any service modules
// ---------------------------------------------------------------------------

// Mock menuService — orderService imports this at module top level
const mockGetMenuItemsByIds = vi.fn();
vi.mock("@/services/menu", () => ({
  menuService: {
    getMenuItemsByIds: (...args: unknown[]) => mockGetMenuItemsByIds(...args),
  },
}));

// Mock merchantService
const mockGetMerchantById = vi.fn();
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantById: (...args: unknown[]) => mockGetMerchantById(...args),
  },
}));

// Mock taxConfigRepository
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

// Mock sequenceRepository
const mockGetNextOrderSequence = vi.fn();
vi.mock("@/repositories/sequence.repository", () => ({
  sequenceRepository: {
    getNextOrderSequence: (...args: unknown[]) => mockGetNextOrderSequence(...args),
  },
}));

// Mock giftCardService (used by createMerchantOrderAtomic)
vi.mock("@/services/giftcard", () => ({
  giftCardService: {
    redeemGiftCard: vi.fn(),
  },
}));

// Mock paymentService (createMerchantOrderAtomic creates payment records via this)
const mockCreatePaymentRecord = vi.fn();
vi.mock("@/services/payment", () => ({
  paymentService: {
    createPaymentRecord: (...args: unknown[]) => mockCreatePaymentRecord(...args),
  },
}));

// Mock POS provider registry for order-listener tests
const mockPushOrder = vi.fn();
const mockUpdateFulfillment = vi.fn();
const mockCancelOrder = vi.fn();
vi.mock("@/services/integration/pos-provider-registry", () => ({
  posProviderRegistry: {
    getProvider: () => ({
      type: "POS_SQUARE",
      pushOrder: (...args: unknown[]) => mockPushOrder(...args),
      updateFulfillment: (...args: unknown[]) => mockUpdateFulfillment(...args),
      cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
    }),
  },
}));

// Mock squareService (used by webhook service for catalog sync)
vi.mock("@/services/square/square.service", () => ({
  squareService: {
    syncCatalog: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Real PrismaClient + override @/lib/db for repository code
//
// vi.mock factories are hoisted to the top of the file and execute before
// any top-level variable initializations. We must create the PrismaClient
// inside vi.hoisted() so the reference is available when the factory runs.
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
import { SquareWebhookService } from "@/services/square/square-webhook.service";
import {
  registerOrderEventHandlers,
  unregisterOrderEventHandlers,
} from "@/services/integration/order-listener";
import type { SquareWebhookPayload } from "@/services/square/square.types";
import type { CreateMerchantOrderInput } from "@/services/order/order.types";

// ---------------------------------------------------------------------------
// Test IDs (stable across tests, unique per run)
// ---------------------------------------------------------------------------

const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const CONNECTION_ID = generateEntityId();
const MENU_ITEM_ID = generateEntityId();
const MENU_ID = generateEntityId();
const CATEGORY_ID = generateEntityId();
const CATEGORY_ITEM_ID = generateEntityId();
const TAX_CONFIG_ID = generateEntityId();
const TAX_RATE_ID = generateEntityId();
const MENU_ITEM_TAX_ID = generateEntityId();
const ITEM_VARIATION_MAPPING_ID = generateEntityId();
const TAX_MAPPING_ID = generateEntityId();

const SQUARE_MERCHANT_ID = "sq-merchant-e2e";
const SQUARE_ORDER_ID = `sq-order-e2e-${Date.now()}`;
const MERCHANT_TIMEZONE = "America/Los_Angeles";

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seedTestData() {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "E2E Test Tenant",
      slug: `e2e-tenant-${Date.now()}`,
    },
  });

  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `e2e-merchant-${Date.now()}`,
      name: "E2E Test Merchant",
      timezone: MERCHANT_TIMEZONE,
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
      externalAccountId: SQUARE_MERCHANT_ID,
      externalLocationId: "sq-loc-e2e",
    },
  });

  // Menu hierarchy: Menu -> MenuCategory -> MenuCategoryItem -> MenuItem
  await prisma.menu.create({
    data: {
      id: MENU_ID,
      tenantId: TENANT_ID,
      name: "E2E Menu",
    },
  });

  await prisma.menuCategory.create({
    data: {
      id: CATEGORY_ID,
      tenantId: TENANT_ID,
      menuId: MENU_ID,
      name: "E2E Category",
    },
  });

  await prisma.menuItem.create({
    data: {
      id: MENU_ITEM_ID,
      tenantId: TENANT_ID,
      name: "E2E Burger",
      price: 12.99,
    },
  });

  await prisma.menuCategoryItem.create({
    data: {
      id: CATEGORY_ITEM_ID,
      tenantId: TENANT_ID,
      categoryId: CATEGORY_ID,
      menuItemId: MENU_ITEM_ID,
    },
  });

  // Tax configuration
  await prisma.taxConfig.create({
    data: {
      id: TAX_CONFIG_ID,
      tenantId: TENANT_ID,
      name: "Sales Tax",
      roundingMethod: "half_up",
      inclusionType: "additive",
    },
  });

  await prisma.merchantTaxRate.create({
    data: {
      id: TAX_RATE_ID,
      merchantId: MERCHANT_ID,
      taxConfigId: TAX_CONFIG_ID,
      rate: 0.0875,
    },
  });

  await prisma.menuItemTax.create({
    data: {
      id: MENU_ITEM_TAX_ID,
      tenantId: TENANT_ID,
      menuItemId: MENU_ITEM_ID,
      taxConfigId: TAX_CONFIG_ID,
    },
  });

  // ExternalIdMapping: MenuItem -> ITEM_VARIATION (for Square push)
  await prisma.externalIdMapping.create({
    data: {
      id: ITEM_VARIATION_MAPPING_ID,
      tenantId: TENANT_ID,
      internalType: "MenuItem",
      internalId: MENU_ITEM_ID,
      externalSource: "SQUARE",
      externalType: "ITEM_VARIATION",
      externalId: "sq-item-var-e2e",
    },
  });

  // ExternalIdMapping: TaxConfig -> TAX
  await prisma.externalIdMapping.create({
    data: {
      id: TAX_MAPPING_ID,
      tenantId: TENANT_ID,
      internalType: "TaxConfig",
      internalId: TAX_CONFIG_ID,
      externalSource: "SQUARE",
      externalType: "TAX",
      externalId: "sq-tax-e2e",
    },
  });
}

async function cleanupTestData() {
  // Delete in reverse FK dependency order
  await prisma.fulfillmentStatusLog.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderFulfillment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationSyncRecord.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.webhookEvent.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderItemModifier.deleteMany({
    where: { orderItem: { order: { tenantId: TENANT_ID } } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { tenantId: TENANT_ID } },
  });
  await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderSequence.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationConnection.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.menuItemTax.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchantTaxRate.deleteMany({ where: { merchantId: MERCHANT_ID } });
  await prisma.taxConfig.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.modifierOption.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.modifierGroup.deleteMany({ where: { tenantId: TENANT_ID } });
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

/**
 * Setup mocks that orderService.createMerchantOrder depends on.
 */
function setupOrderCreationMocks(sequenceNum = 1) {
  mockGetMenuItemsByIds.mockResolvedValue([
    {
      id: MENU_ITEM_ID,
      name: "E2E Burger",
      price: 12.99,
      status: "active",
    },
  ]);

  mockGetMerchantById.mockResolvedValue({
    id: MERCHANT_ID,
    name: "E2E Test Merchant",
    timezone: MERCHANT_TIMEZONE,
  });

  // Tax mocks: return empty tax data for simplicity
  mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
  mockGetTaxConfigsByIds.mockResolvedValue([]);
  mockGetMerchantTaxRateMap.mockResolvedValue(new Map());

  mockGetNextOrderSequence.mockResolvedValue(sequenceNum);

  // paymentService.createPaymentRecord succeeds by default
  mockCreatePaymentRecord.mockResolvedValue({ id: generateEntityId() });
}

/**
 * Build a standard order input for tests.
 */
function makeOrderInput(overrides: Partial<CreateMerchantOrderInput> = {}): CreateMerchantOrderInput {
  return {
    merchantId: MERCHANT_ID,
    customerFirstName: "E2E",
    customerLastName: "Tester",
    customerPhone: "555-0199",
    customerEmail: "e2e@test.com",
    orderMode: "pickup",
    items: [
      {
        menuItemId: MENU_ITEM_ID,
        name: "E2E Burger",
        price: 12.99,
        quantity: 1,
        totalPrice: 12.99,
        selectedModifiers: [],
      },
    ],
    ...overrides,
  };
}

/**
 * Build a Square order.updated webhook payload.
 */
function buildOrderUpdatedPayload(
  state: string,
  eventId: string,
  options: {
    squareOrderId?: string;
    cancelReason?: string;
    version?: number;
  } = {}
): string {
  const sqOrderId = options.squareOrderId ?? SQUARE_ORDER_ID;
  const fulfillment: Record<string, unknown> = { state };
  if (options.cancelReason) {
    fulfillment.pickup_details = { cancel_reason: options.cancelReason };
  }
  const order: Record<string, unknown> = {
    id: sqOrderId,
    fulfillments: [fulfillment],
  };
  if (options.version !== undefined) {
    order.version = options.version;
  }
  return JSON.stringify({
    merchant_id: SQUARE_MERCHANT_ID,
    type: "order.updated",
    event_id: eventId,
    created_at: new Date().toISOString(),
    data: {
      type: "order",
      id: sqOrderId,
      object: { order },
    },
  });
}

/**
 * Dispatch a raw webhook payload through SquareWebhookService.routeEvent().
 */
async function dispatchViaRouteEvent(
  service: SquareWebhookService,
  rawBody: string
) {
  const payload: SquareWebhookPayload = JSON.parse(rawBody);
  const connection = {
    tenantId: TENANT_ID,
    merchantId: MERCHANT_ID,
    id: CONNECTION_ID,
  };
  await service.routeEvent(payload.type, payload, connection);
}

/**
 * Create an ExternalIdMapping for an order -> Square order.
 */
async function createOrderMapping(orderId: string, squareOrderId: string) {
  return prisma.externalIdMapping.create({
    data: {
      id: generateEntityId(),
      tenantId: TENANT_ID,
      internalType: "Order",
      internalId: orderId,
      externalSource: "SQUARE",
      externalType: "ORDER",
      externalId: squareOrderId,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Order Flow E2E (integration)", () => {
  const webhookService = new SquareWebhookService();

  beforeAll(async () => {
    await cleanupTestData();
    await seedTestData();
  });

  afterAll(async () => {
    unregisterOrderEventHandlers();
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Happy Path: order creation -> Square push -> fulfillment lifecycle
  // =========================================================================
  describe("Happy Path: order creation -> Square push -> fulfillment lifecycle", () => {
    let orderId: string;
    const sqOrderId = `sq-happy-${Date.now()}`;

    it("creates an order via createMerchantOrderAtomic", async () => {
      setupOrderCreationMocks(1);

      const emitSpy = vi.spyOn(orderEventEmitter, "emit");

      const order = await orderService.createMerchantOrderAtomic(
        TENANT_ID,
        makeOrderInput(),
        {
          payment: {
            provider: "stripe",
            providerPaymentId: `pi_e2e_happy_${Date.now()}`,
            amount: 12.99,
            currency: "USD",
          },
        }
      );

      orderId = order.id;

      // Verify order in DB
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder).not.toBeNull();
      expect(dbOrder!.status).toBe("completed");
      expect(dbOrder!.fulfillmentStatus).toBe("pending");
      expect(Number(dbOrder!.totalAmount)).toBeCloseTo(12.99, 2);

      // Verify OrderItem created
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId },
        include: { modifiers: true },
      });
      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].name).toBe("E2E Burger");
      expect(Number(orderItems[0].unitPrice)).toBeCloseTo(12.99, 2);

      // Verify OrderFulfillment created
      const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId },
      });
      expect(fulfillment).not.toBeNull();
      expect(fulfillment!.status).toBe("pending");

      // Verify order.paid event was emitted
      const paidCall = emitSpy.mock.calls.find((c) => c[0] === "order.paid");
      expect(paidCall).toBeDefined();
      expect(paidCall![1]).toMatchObject({
        orderId,
        tenantId: TENANT_ID,
        status: "completed",
      });

      emitSpy.mockRestore();
    });

    it("simulates Square push: creates ExternalIdMapping", async () => {
      // Simulate what order-listener does after push succeeds:
      // 1. Push to Square (mocked) returns an external order ID
      // 2. Create ExternalIdMapping
      await createOrderMapping(orderId, sqOrderId);

      const mapping = await prisma.externalIdMapping.findFirst({
        where: {
          tenantId: TENANT_ID,
          internalType: "Order",
          internalId: orderId,
          externalSource: "SQUARE",
        },
      });
      expect(mapping).not.toBeNull();
      expect(mapping!.externalId).toBe(sqOrderId);
    });

    it("PROPOSED webhook does not change pending fulfillment (rank guard: same rank)", async () => {
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("PROPOSED", "evt-proposed-1", {
          squareOrderId: sqOrderId,
          version: 1,
        })
      );

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("pending");
    });

    it("RESERVED webhook advances pending -> confirmed", async () => {
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("RESERVED", "evt-reserved-1", {
          squareOrderId: sqOrderId,
          version: 2,
        })
      );

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("confirmed");
    });

    it("RESERVED echo does not change confirmed fulfillment (same rank)", async () => {
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("RESERVED", "evt-reserved-echo", {
          squareOrderId: sqOrderId,
          version: 3,
        })
      );

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("confirmed");
    });

    it("PREPARED webhook advances confirmed -> ready", async () => {
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("PREPARED", "evt-prepared-1", {
          squareOrderId: sqOrderId,
          version: 4,
        })
      );

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("ready");
    });

    it("COMPLETED webhook advances ready -> fulfilled", async () => {
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("COMPLETED", "evt-completed-1", {
          squareOrderId: sqOrderId,
          version: 5,
        })
      );

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("fulfilled");
    });

    it("verifies fulfillment status log has correct transitions", async () => {
      const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId },
      });
      expect(fulfillment).not.toBeNull();

      const logs = await prisma.fulfillmentStatusLog.findMany({
        where: { fulfillmentId: fulfillment!.id },
        orderBy: { createdAt: "asc" },
      });

      // Expected transitions: pending->confirmed, confirmed->ready, ready->fulfilled
      expect(logs).toHaveLength(3);
      expect(logs[0].fromStatus).toBe("pending");
      expect(logs[0].toStatus).toBe("confirmed");
      expect(logs[1].fromStatus).toBe("confirmed");
      expect(logs[1].toStatus).toBe("ready");
      expect(logs[2].fromStatus).toBe("ready");
      expect(logs[2].toStatus).toBe("fulfilled");
    });
  });

  // =========================================================================
  // 2. Order cancellation via Square webhook
  // =========================================================================
  describe("Order cancellation via Square webhook", () => {
    let orderId: string;
    const sqOrderId = `sq-cancel-${Date.now()}`;

    it("creates an order, maps to Square, then cancels via webhook", async () => {
      setupOrderCreationMocks(2);

      const order = await orderService.createMerchantOrderAtomic(
        TENANT_ID,
        makeOrderInput(),
        {
          payment: {
            provider: "stripe",
            providerPaymentId: `pi_e2e_cancel_${Date.now()}`,
            amount: 12.99,
            currency: "USD",
          },
        }
      );
      orderId = order.id;

      // Create Square mapping
      await createOrderMapping(orderId, sqOrderId);

      // Send CANCELED webhook
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("CANCELED", "evt-cancel-1", {
          squareOrderId: sqOrderId,
          cancelReason: "Customer requested cancellation",
          version: 2,
        })
      );

      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder!.status).toBe("canceled");
      expect(dbOrder!.cancelledAt).not.toBeNull();
      expect(dbOrder!.cancelReason).toBe("Customer requested cancellation");

      // Verify fulfillment is also canceled
      const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId },
      });
      expect(fulfillment!.status).toBe("canceled");
    });
  });

  // =========================================================================
  // 3. Guard mechanisms
  // =========================================================================
  describe("Guard mechanisms", () => {
    let guardOrderId: string;
    const sqGuardOrderId = `sq-guard-${Date.now()}`;

    beforeAll(async () => {
      setupOrderCreationMocks(3);

      const order = await orderService.createMerchantOrderAtomic(
        TENANT_ID,
        makeOrderInput(),
        {
          payment: {
            provider: "stripe",
            providerPaymentId: `pi_e2e_guard_${Date.now()}`,
            amount: 12.99,
            currency: "USD",
          },
        }
      );
      guardOrderId = order.id;

      await createOrderMapping(guardOrderId, sqGuardOrderId);
    });

    it("stale version guard: ignores webhook with version <= current", async () => {
      // First, advance to confirmed with version 10
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("RESERVED", "evt-guard-advance", {
          squareOrderId: sqGuardOrderId,
          version: 10,
        })
      );

      let dbOrder = await prisma.order.findUnique({ where: { id: guardOrderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("confirmed");

      // Now send a webhook with version 5 (stale) — should be ignored
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("PREPARED", "evt-guard-stale", {
          squareOrderId: sqGuardOrderId,
          version: 5,
        })
      );

      dbOrder = await prisma.order.findUnique({ where: { id: guardOrderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("confirmed");
    });

    it("loop prevention: order-listener skips push when source is square_webhook", async () => {
      mockPushOrder.mockClear();

      // Register handlers
      unregisterOrderEventHandlers();
      registerOrderEventHandlers();

      // Emit an order.paid event with source=square_webhook
      // The handler should check event.source and skip the push
      orderEventEmitter.emit("order.paid", {
        orderId: guardOrderId,
        orderNumber: "ORD-GUARD",
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        timestamp: new Date(),
        status: "completed",
        previousStatus: "created",
        source: "square_webhook",
        customerPhone: "555-0199",
        customerFirstName: "E2E",
        customerLastName: "Tester",
        totalAmount: 12.99,
      });

      // Wait for the setTimeout(0) in event emitter to fire
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockPushOrder).not.toHaveBeenCalled();

      unregisterOrderEventHandlers();
    });

    it("monotonic rank guard: preparing order ignores RESERVED webhook", async () => {
      // Manually set fulfillment to "preparing" to test rank guard
      const fulfillment = await prisma.orderFulfillment.findFirst({
        where: { orderId: guardOrderId },
      });
      expect(fulfillment).not.toBeNull();

      // Transition: confirmed -> preparing via DB update
      await prisma.orderFulfillment.update({
        where: { id: fulfillment!.id },
        data: { status: "preparing" },
      });
      await prisma.order.update({
        where: { id: guardOrderId },
        data: { fulfillmentStatus: "preparing" },
      });

      // Send RESERVED (rank 1) against preparing (rank 2) — should be ignored
      await dispatchViaRouteEvent(
        webhookService,
        buildOrderUpdatedPayload("RESERVED", "evt-guard-monotonic", {
          squareOrderId: sqGuardOrderId,
          version: 15,
        })
      );

      const dbOrder = await prisma.order.findUnique({ where: { id: guardOrderId } });
      expect(dbOrder!.fulfillmentStatus).toBe("preparing");
    });
  });

  // =========================================================================
  // 4. Square push failure -> retry record
  // =========================================================================
  describe("Square push failure -> retry record", () => {
    it("creates IntegrationSyncRecord with status=failed when push fails", async () => {
      setupOrderCreationMocks(4);

      // Create a new order
      const order = await orderService.createMerchantOrderAtomic(
        TENANT_ID,
        makeOrderInput(),
        {
          payment: {
            provider: "stripe",
            providerPaymentId: `pi_e2e_fail_${Date.now()}`,
            amount: 12.99,
            currency: "USD",
          },
        }
      );

      // Mock pushOrder to throw
      mockPushOrder.mockRejectedValueOnce(new Error("Square API timeout"));

      // Register the order-listener handlers
      unregisterOrderEventHandlers();
      registerOrderEventHandlers();

      // Manually invoke handleOrderPaid by emitting the event
      // The order-listener will try to push and fail, creating a retry record
      orderEventEmitter.emit("order.paid", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        timestamp: new Date(),
        status: "completed",
        previousStatus: "created",
        customerPhone: "555-0199",
        customerFirstName: "E2E",
        customerLastName: "Tester",
        totalAmount: 12.99,
      });

      // Wait for the setTimeout(0) in event emitter + async handler to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify IntegrationSyncRecord was created with status=failed
      const syncRecords = await prisma.integrationSyncRecord.findMany({
        where: {
          tenantId: TENANT_ID,
          connectionId: CONNECTION_ID,
          status: "failed",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(syncRecords.length).toBeGreaterThanOrEqual(1);
      const record = syncRecords[0];
      expect(record.syncType).toBe("ORDER_PUSH");
      expect(record.errorMessage).toContain("Square API timeout");

      unregisterOrderEventHandlers();
    });
  });
});
