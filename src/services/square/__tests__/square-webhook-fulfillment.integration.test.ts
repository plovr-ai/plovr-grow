/**
 * Integration test for Square webhook fulfillment-state handling.
 *
 * Covers the monotonic rank guard added for #104:
 *  - Square echoing RESERVED back must not promote a confirmed order to preparing.
 *  - A RESERVED echo against a preparing order must not regress it to confirmed.
 *  - A stale PROPOSED webhook must not roll a confirmed order back to pending.
 *  - A genuine pending → RESERVED transition must still advance to confirmed.
 *
 * Run with: npx vitest run --config vitest.config.integration.ts
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { generateEntityId } from "@/lib/id";
import { SquareWebhookService } from "../square-webhook.service";

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  "mysql://root:password@localhost:3306/plovr_test";

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const CONNECTION_ID = generateEntityId();
const ORDER_ID = generateEntityId();
const MAPPING_ID = generateEntityId();

const SQUARE_MERCHANT_ID = "sq-merchant-integration";
const SQUARE_ORDER_ID = "sq-order-integration";

function buildOrderUpdatedPayload(
  state: string,
  eventId: string,
  options: { cancelReason?: string; version?: number } = {}
) {
  const fulfillment: Record<string, unknown> = { state };
  if (options.cancelReason) {
    fulfillment.pickup_details = { cancel_reason: options.cancelReason };
  }
  const order: Record<string, unknown> = {
    id: SQUARE_ORDER_ID,
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
      id: SQUARE_ORDER_ID,
      object: { order },
    },
  });
}

async function seedBaseFixtures() {
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Square Webhook IT Tenant",
      slug: `sq-wh-tenant-${Date.now()}`,
    },
  });
  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `sq-wh-merchant-${Date.now()}`,
      name: "Square Webhook IT Merchant",
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
      externalLocationId: "sq-loc-1",
    },
  });
  await prisma.externalIdMapping.create({
    data: {
      id: MAPPING_ID,
      tenantId: TENANT_ID,
      internalType: "Order",
      internalId: ORDER_ID,
      externalSource: "SQUARE",
      externalType: "ORDER",
      externalId: SQUARE_ORDER_ID,
    },
  });
}

async function cleanupAll() {
  await prisma.webhookEvent.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.integrationConnection.deleteMany({
    where: { tenantId: TENANT_ID },
  });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

async function upsertOrder(
  fulfillmentStatus: string,
  overrides: Record<string, unknown> = {}
) {
  await prisma.order.upsert({
    where: { id: ORDER_ID },
    create: {
      id: ORDER_ID,
      tenantId: TENANT_ID,
      merchantId: MERCHANT_ID,
      orderNumber: `IT-${Date.now()}`,
      customerFirstName: "IT",
      customerLastName: "Tester",
      customerPhone: "555-0100",
      orderMode: "pickup",
      salesChannel: "online_order",
      status: "completed",
      fulfillmentStatus,
      items: [],
      subtotal: 10,
      taxAmount: 0,
      totalAmount: 10,
      ...overrides,
    },
    update: {
      fulfillmentStatus,
      status: "completed",
      confirmedAt: null,
      preparingAt: null,
      readyAt: null,
      fulfilledAt: null,
      cancelledAt: null,
      cancelReason: null,
      squareOrderVersion: null,
      ...overrides,
    },
  });
}

describe("Square webhook fulfillment rank guard (integration)", () => {
  const service = new SquareWebhookService();

  beforeAll(async () => {
    await cleanupAll();
    await seedBaseFixtures();
  });

  afterAll(async () => {
    await cleanupAll();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear webhook events so each case reuses its own event_id without dedup
    await prisma.webhookEvent.deleteMany({ where: { tenantId: TENANT_ID } });
  });

  it("does not promote confirmed order when Square echoes RESERVED", async () => {
    await upsertOrder("confirmed", { confirmedAt: new Date("2026-04-10T10:00:00Z") });

    const result = await service.handleWebhook(
      buildOrderUpdatedPayload("RESERVED", "evt-it-confirmed-reserved")
    );
    expect(result.deduplicated).toBe(false);

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.fulfillmentStatus).toBe("confirmed");
    expect(row?.preparingAt).toBeNull();
  });

  it("does not regress preparing order when Square echoes RESERVED", async () => {
    await upsertOrder("preparing", {
      confirmedAt: new Date("2026-04-10T10:00:00Z"),
      preparingAt: new Date("2026-04-10T10:05:00Z"),
    });

    await service.handleWebhook(
      buildOrderUpdatedPayload("RESERVED", "evt-it-preparing-reserved")
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.fulfillmentStatus).toBe("preparing");
  });

  it("does not regress confirmed order when a stale PROPOSED arrives", async () => {
    await upsertOrder("confirmed", { confirmedAt: new Date("2026-04-10T10:00:00Z") });

    await service.handleWebhook(
      buildOrderUpdatedPayload("PROPOSED", "evt-it-confirmed-proposed")
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.fulfillmentStatus).toBe("confirmed");
  });

  it("advances pending → confirmed when Square accepts the order", async () => {
    await upsertOrder("pending");

    await service.handleWebhook(
      buildOrderUpdatedPayload("RESERVED", "evt-it-pending-reserved")
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.fulfillmentStatus).toBe("confirmed");
    expect(row?.confirmedAt).not.toBeNull();
  });

  it("advances ready → fulfilled when Square marks order completed", async () => {
    await upsertOrder("ready", {
      confirmedAt: new Date("2026-04-10T10:00:00Z"),
      preparingAt: new Date("2026-04-10T10:05:00Z"),
      readyAt: new Date("2026-04-10T10:10:00Z"),
    });

    await service.handleWebhook(
      buildOrderUpdatedPayload("COMPLETED", "evt-it-ready-completed")
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.fulfillmentStatus).toBe("fulfilled");
    expect(row?.fulfilledAt).not.toBeNull();
  });

  it("cancels order when Square sends CANCELED fulfillment state", async () => {
    await upsertOrder("confirmed", {
      confirmedAt: new Date("2026-04-10T10:00:00Z"),
    });

    await service.handleWebhook(
      buildOrderUpdatedPayload("CANCELED", "evt-it-cancel-with-reason", {
        cancelReason: "Out of stock",
      })
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.status).toBe("canceled");
    expect(row?.cancelledAt).not.toBeNull();
    expect(row?.cancelReason).toBe("Out of stock");
  });

  it("cancels order on FAILED fulfillment state with default reason", async () => {
    await upsertOrder("preparing", {
      confirmedAt: new Date("2026-04-10T10:00:00Z"),
      preparingAt: new Date("2026-04-10T10:05:00Z"),
    });

    await service.handleWebhook(
      buildOrderUpdatedPayload("FAILED", "evt-it-failed")
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.status).toBe("canceled");
    expect(row?.cancelReason).toBe("Fulfillment failed on Square");
  });

  it("cancellation overrides rank guard from ready state", async () => {
    await upsertOrder("ready", {
      confirmedAt: new Date("2026-04-10T10:00:00Z"),
      preparingAt: new Date("2026-04-10T10:05:00Z"),
      readyAt: new Date("2026-04-10T10:10:00Z"),
    });

    await service.handleWebhook(
      buildOrderUpdatedPayload("CANCELED", "evt-it-cancel-from-ready")
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.status).toBe("canceled");
    expect(row?.cancelReason).toBe("Canceled on Square POS");
  });

  it("does not resurrect a canceled order via stale forward webhook", async () => {
    await upsertOrder("pending");
    // Pre-cancel the order
    await prisma.order.update({
      where: { id: ORDER_ID },
      data: { status: "canceled", cancelledAt: new Date() },
    });

    await service.handleWebhook(
      buildOrderUpdatedPayload("PREPARED", "evt-it-cancel-resurrect")
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.status).toBe("canceled");
    expect(row?.fulfillmentStatus).toBe("pending");
  });

  // ==================== #109: out-of-order webhook guard ====================

  it("drops a stale webhook whose version <= stored version", async () => {
    await upsertOrder("preparing", { squareOrderVersion: 5 });

    await service.handleWebhook(
      buildOrderUpdatedPayload("PREPARED", "evt-it-stale-v3", { version: 3 })
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.fulfillmentStatus).toBe("preparing");
    expect(row?.squareOrderVersion).toBe(5);
  });

  it("applies a newer-version webhook and bumps the stored version", async () => {
    await upsertOrder("preparing", { squareOrderVersion: 5 });

    await service.handleWebhook(
      buildOrderUpdatedPayload("PREPARED", "evt-it-fresh-v8", { version: 8 })
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.fulfillmentStatus).toBe("ready");
    expect(row?.squareOrderVersion).toBe(8);
  });

  it("falls back to legacy behavior when payload omits version", async () => {
    await upsertOrder("preparing", { squareOrderVersion: 5 });

    await service.handleWebhook(
      buildOrderUpdatedPayload("PREPARED", "evt-it-no-version")
    );

    const row = await prisma.order.findUnique({ where: { id: ORDER_ID } });
    expect(row?.fulfillmentStatus).toBe("ready");
    // Missing version must not clear the stored version
    expect(row?.squareOrderVersion).toBe(5);
  });
});
