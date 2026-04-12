/**
 * Integration test for order creation transaction atomicity.
 *
 * Connects to a real MySQL test database and verifies that
 * prisma.$transaction() correctly rolls back ALL writes when any step fails.
 *
 * Run with: npx vitest run --config vitest.config.integration.ts
 * Requires: MySQL running with DATABASE_URL configured
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  "mysql://root:password@localhost:3306/plovr_test";

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

// Seed data IDs (stable across tests)
const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const PURCHASE_ORDER_ID = generateEntityId();
const GIFT_CARD_ID = generateEntityId();

async function seedTestData() {
  // Create tenant -> company -> merchant chain
  await prisma.tenant.create({
    data: { id: TENANT_ID, name: "Test Tenant", slug: `test-tenant-${Date.now()}` },
  });

  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `test-merchant-${Date.now()}`,
      name: "Test Merchant",
    },
  });

  // Create a purchase order (required as FK for gift card)
  await prisma.order.create({
    data: {
      id: PURCHASE_ORDER_ID,
      tenantId: TENANT_ID,
      merchantId: MERCHANT_ID,
      orderNumber: `SEED-${Date.now()}`,
      customerFirstName: "Seed",
      customerLastName: "Order",
      customerPhone: "000-000-0000",
      orderMode: "pickup",
      salesChannel: "giftcard",
      items: [],
      subtotal: 50,
      taxAmount: 0,
      totalAmount: 50,
    },
  });

  // Create a gift card with $50 balance
  await prisma.giftCard.create({
    data: {
      id: GIFT_CARD_ID,
      tenantId: TENANT_ID,
      cardNumber: `TEST-${Date.now()}`,
      initialAmount: 50,
      currentBalance: 50,
      purchaseOrderId: PURCHASE_ORDER_ID,
    },
  });
}

async function cleanupTestData() {
  // Delete in reverse dependency order
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.giftCardTransaction.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.giftCard.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderSequence.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

describe("Order Transaction Atomicity (Integration)", () => {
  beforeAll(async () => {
    await cleanupTestData();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up orders created during tests (except the seed purchase order)
    await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.giftCardTransaction.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.order.deleteMany({
      where: { tenantId: TENANT_ID, id: { not: PURCHASE_ORDER_ID } },
    });
    // Reset gift card balance back to 50
    await prisma.giftCard.update({
      where: { id: GIFT_CARD_ID },
      data: { currentBalance: 50 },
    });
  });

  it("should commit all operations when transaction succeeds", async () => {
    const orderId = generateEntityId();
    const paymentId = generateEntityId();
    const gcTxId = generateEntityId();

    await prisma.$transaction(async (tx) => {
      // 1. Create order
      await tx.order.create({
        data: {
          id: orderId,
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          orderNumber: `TXN-OK-${Date.now()}`,
          customerFirstName: "John",
          customerLastName: "Doe",
          customerPhone: "123-456-7890",
          orderMode: "pickup",
          items: [{ name: "Pizza", price: 30, quantity: 1 }],
          subtotal: 30,
          taxAmount: 0,
          giftCardPayment: 15,
          balanceDue: 15,
          totalAmount: 30,
        },
      });

      // 2. Redeem gift card
      await tx.giftCard.update({
        where: { id: GIFT_CARD_ID },
        data: { currentBalance: 35 }, // 50 - 15
      });

      await tx.giftCardTransaction.create({
        data: {
          id: gcTxId,
          tenantId: TENANT_ID,
          giftCardId: GIFT_CARD_ID,
          orderId,
          type: "redemption",
          amount: 15,
          balanceBefore: 50,
          balanceAfter: 35,
        },
      });

      // 3. Create payment record
      await tx.payment.create({
        data: {
          id: paymentId,
          tenantId: TENANT_ID,
          orderId,
          provider: "stripe",
          providerPaymentId: `pi_test_${Date.now()}`,
          amount: 15,
          currency: "USD",
          status: "pending",
        },
      });
    });

    // Verify ALL records exist
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order).not.toBeNull();
    expect(order!.customerFirstName).toBe("John");

    const giftCard = await prisma.giftCard.findUnique({ where: { id: GIFT_CARD_ID } });
    expect(Number(giftCard!.currentBalance)).toBe(35);

    const gcTransaction = await prisma.giftCardTransaction.findUnique({ where: { id: gcTxId } });
    expect(gcTransaction).not.toBeNull();
    expect(gcTransaction!.type).toBe("redemption");

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment).not.toBeNull();
    expect(Number(payment!.amount)).toBe(15);
  });

  it("should rollback ALL operations when gift card redemption fails mid-transaction", async () => {
    const orderId = generateEntityId();
    const paymentId = generateEntityId();

    // Record state before transaction attempt
    const giftCardBefore = await prisma.giftCard.findUnique({ where: { id: GIFT_CARD_ID } });
    const orderCountBefore = await prisma.order.count({
      where: { tenantId: TENANT_ID, id: { not: PURCHASE_ORDER_ID } },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        // 1. Create order — succeeds
        await tx.order.create({
          data: {
            id: orderId,
            tenantId: TENANT_ID,
            merchantId: MERCHANT_ID,
            orderNumber: `TXN-FAIL-${Date.now()}`,
            customerFirstName: "Jane",
            customerLastName: "Doe",
            customerPhone: "987-654-3210",
            orderMode: "pickup",
            items: [{ name: "Burger", price: 60, quantity: 1 }],
            subtotal: 60,
            taxAmount: 0,
            giftCardPayment: 60,
            balanceDue: 0,
            totalAmount: 60,
          },
        });

        // 2. Simulate gift card redemption failure
        // (e.g., business logic detects insufficient balance and throws)
        throw new Error("Insufficient gift card balance");

        // 3. Payment record — never reached
        await tx.payment.create({
          data: {
            id: paymentId,
            tenantId: TENANT_ID,
            orderId,
            provider: "stripe",
            providerPaymentId: `pi_fail_${Date.now()}`,
            amount: 0,
            currency: "USD",
            status: "pending",
          },
        });
      })
    ).rejects.toThrow("Insufficient gift card balance");

    // Verify: Order was NOT created (rolled back)
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order).toBeNull();

    // Verify: Order count unchanged
    const orderCountAfter = await prisma.order.count({
      where: { tenantId: TENANT_ID, id: { not: PURCHASE_ORDER_ID } },
    });
    expect(orderCountAfter).toBe(orderCountBefore);

    // Verify: Gift card balance unchanged
    const giftCardAfter = await prisma.giftCard.findUnique({ where: { id: GIFT_CARD_ID } });
    expect(Number(giftCardAfter!.currentBalance)).toBe(Number(giftCardBefore!.currentBalance));

    // Verify: Payment was NOT created
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment).toBeNull();
  });

  it("should rollback order and gift card when payment record creation fails", async () => {
    const orderId = generateEntityId();
    const gcTxId = generateEntityId();

    await expect(
      prisma.$transaction(async (tx) => {
        // 1. Create order — succeeds
        await tx.order.create({
          data: {
            id: orderId,
            tenantId: TENANT_ID,
            merchantId: MERCHANT_ID,
            orderNumber: `TXN-FAIL2-${Date.now()}`,
            customerFirstName: "Bob",
            customerLastName: "Smith",
            customerPhone: "555-555-5555",
            orderMode: "pickup",
            items: [{ name: "Salad", price: 25, quantity: 1 }],
            subtotal: 25,
            taxAmount: 0,
            giftCardPayment: 10,
            balanceDue: 15,
            totalAmount: 25,
          },
        });

        // 2. Redeem gift card — succeeds
        await tx.giftCard.update({
          where: { id: GIFT_CARD_ID },
          data: { currentBalance: 40 }, // 50 - 10
        });

        await tx.giftCardTransaction.create({
          data: {
            id: gcTxId,
            tenantId: TENANT_ID,
            giftCardId: GIFT_CARD_ID,
            orderId,
            type: "redemption",
            amount: 10,
            balanceBefore: 50,
            balanceAfter: 40,
          },
        });

        // 3. Payment record creation fails
        throw new Error("Payment service unavailable");
      })
    ).rejects.toThrow("Payment service unavailable");

    // Verify: Order was rolled back
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order).toBeNull();

    // Verify: Gift card balance was rolled back (still 50, not 40)
    const giftCard = await prisma.giftCard.findUnique({ where: { id: GIFT_CARD_ID } });
    expect(Number(giftCard!.currentBalance)).toBe(50);

    // Verify: Gift card transaction was rolled back
    const gcTransaction = await prisma.giftCardTransaction.findUnique({ where: { id: gcTxId } });
    expect(gcTransaction).toBeNull();
  });
});
