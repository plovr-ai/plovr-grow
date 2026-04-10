/**
 * P0 Integration tests for gift card concurrency & idempotency.
 *
 * Verifies:
 * 1. Concurrent redemptions on the same card are serialized via FOR UPDATE
 * 2. Double-drain is prevented (two requests each requesting full balance)
 * 3. Payment webhook CAS prevents duplicate status transitions
 * 4. Duplicate PaymentIntent is rejected by unique constraint
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

// Seed data IDs
const TENANT_ID = generateEntityId();
const MERCHANT_ID = generateEntityId();
const PURCHASE_ORDER_ID = generateEntityId();
const GIFT_CARD_ID = generateEntityId();

// Two order IDs for concurrent tests
const ORDER_A_ID = generateEntityId();
const ORDER_B_ID = generateEntityId();

async function seedTestData() {
  await prisma.tenant.create({
    data: { id: TENANT_ID, name: "Concurrency Test Tenant", slug: `conc-tenant-${Date.now()}` },
  });

  await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      slug: `conc-merchant-${Date.now()}`,
      name: "Concurrency Test Merchant",
    },
  });

  // Purchase order (FK for gift card)
  await prisma.order.create({
    data: {
      id: PURCHASE_ORDER_ID,
      tenantId: TENANT_ID,
      merchantId: MERCHANT_ID,
      orderNumber: `SEED-CONC-${Date.now()}`,
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

  // Gift card with $50 balance
  await prisma.giftCard.create({
    data: {
      id: GIFT_CARD_ID,
      tenantId: TENANT_ID,
      cardNumber: `CONC-${Date.now()}`,
      initialAmount: 50,
      currentBalance: 50,
      purchaseOrderId: PURCHASE_ORDER_ID,
    },
  });
}

async function cleanupTestData() {
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.giftCardTransaction.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.giftCard.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderSequence.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.order.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.merchant.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

async function resetGiftCardBalance(balance: number) {
  await prisma.giftCardTransaction.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.order.deleteMany({
    where: { tenantId: TENANT_ID, id: { not: PURCHASE_ORDER_ID } },
  });
  await prisma.giftCard.update({
    where: { id: GIFT_CARD_ID },
    data: { currentBalance: balance },
  });
}

/**
 * Helper: simulate a gift card redemption inside a transaction with FOR UPDATE locking.
 * Mirrors the real flow in createMerchantOrderAtomic → giftCardService.redeemGiftCard.
 */
function redeemInTransaction(orderId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the gift card row (FOR UPDATE)
    const rows = await (tx as unknown as PrismaClient).$queryRaw<
      Array<{ id: string; current_balance: string }>
    >`SELECT id, current_balance FROM gift_cards WHERE id = ${GIFT_CARD_ID} AND tenant_id = ${TENANT_ID} AND deleted = false FOR UPDATE`;

    if (rows.length === 0) throw new Error("Gift card not found");

    const currentBalance = Number(rows[0].current_balance);

    if (currentBalance <= 0) {
      throw new Error("Gift card has no balance");
    }

    const amountToRedeem = Math.min(amount, currentBalance);
    const newBalance = currentBalance - amountToRedeem;

    // 2. Create order
    await tx.order.create({
      data: {
        id: orderId,
        tenantId: TENANT_ID,
        merchantId: MERCHANT_ID,
        orderNumber: `CONC-${orderId.slice(-6)}-${Date.now()}`,
        customerFirstName: "Test",
        customerLastName: "User",
        customerPhone: "111-111-1111",
        orderMode: "pickup",
        salesChannel: "online_order",
        items: [{ name: "Test Item", price: amount, quantity: 1 }],
        subtotal: amount,
        taxAmount: 0,
        giftCardPayment: amountToRedeem,
        cashPayment: amount - amountToRedeem,
        totalAmount: amount,
      },
    });

    // 3. Update gift card balance
    await tx.giftCard.update({
      where: { id: GIFT_CARD_ID },
      data: { currentBalance: newBalance },
    });

    // 4. Create redemption transaction record
    await tx.giftCardTransaction.create({
      data: {
        id: generateEntityId(),
        tenantId: TENANT_ID,
        giftCardId: GIFT_CARD_ID,
        orderId,
        type: "redemption",
        amount: amountToRedeem,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
      },
    });

    return { amountRedeemed: amountToRedeem, newBalance };
  });
}

describe("Gift Card Concurrency & Idempotency (Integration)", () => {
  beforeAll(async () => {
    await cleanupTestData();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await resetGiftCardBalance(50);
  });

  // ==================== Concurrency Tests ====================

  describe("Concurrent Redemptions (FOR UPDATE locking)", () => {
    it("should serialize concurrent redemptions — total deducted never exceeds balance", async () => {
      // Balance: $50, two concurrent requests each for $30
      // Expected: one gets $30, the other gets at most $20 (partial)
      // Total deducted must equal $50 (not $60)

      const [resultA, resultB] = await Promise.allSettled([
        redeemInTransaction(ORDER_A_ID, 30),
        redeemInTransaction(ORDER_B_ID, 30),
      ]);

      // Both should succeed (partial redemption for the second)
      expect(resultA.status).toBe("fulfilled");
      expect(resultB.status).toBe("fulfilled");

      const amountA =
        resultA.status === "fulfilled" ? resultA.value.amountRedeemed : 0;
      const amountB =
        resultB.status === "fulfilled" ? resultB.value.amountRedeemed : 0;

      // Total deducted must equal the original balance (no over-deduction)
      expect(amountA + amountB).toBe(50);

      // One got 30, the other got 20 (order is non-deterministic)
      expect([amountA, amountB].sort()).toEqual([20, 30]);

      // Verify final balance is 0
      const giftCard = await prisma.giftCard.findUnique({
        where: { id: GIFT_CARD_ID },
      });
      expect(Number(giftCard!.currentBalance)).toBe(0);
    });

    it("should prevent double-drain — two requests each requesting full balance", async () => {
      // Balance: $50, two concurrent requests each for $50
      // Expected: first gets $50, second sees $0 and throws "no balance"

      const orderC = generateEntityId();
      const orderD = generateEntityId();

      const [resultC, resultD] = await Promise.allSettled([
        redeemInTransaction(orderC, 50),
        redeemInTransaction(orderD, 50),
      ]);

      // Exactly one should succeed, the other should fail with "no balance"
      const succeeded = [resultC, resultD].filter(
        (r) => r.status === "fulfilled"
      );
      const failed = [resultC, resultD].filter(
        (r) => r.status === "rejected"
      );

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      const successResult = (
        succeeded[0] as PromiseFulfilledResult<{
          amountRedeemed: number;
          newBalance: number;
        }>
      ).value;
      expect(successResult.amountRedeemed).toBe(50);
      expect(successResult.newBalance).toBe(0);

      const failReason = (failed[0] as PromiseRejectedResult).reason;
      expect(failReason.message).toBe("Gift card has no balance");

      // Verify final balance is 0, not -50
      const giftCard = await prisma.giftCard.findUnique({
        where: { id: GIFT_CARD_ID },
      });
      expect(Number(giftCard!.currentBalance)).toBe(0);

      // Verify only one order was created (the other was rolled back)
      const orders = await prisma.order.findMany({
        where: {
          tenantId: TENANT_ID,
          id: { in: [orderC, orderD] },
        },
      });
      expect(orders).toHaveLength(1);
    });

    it("should maintain transaction record consistency under concurrency", async () => {
      // Balance: $50, two concurrent partial redemptions of $20
      // Both should succeed; records should form a consistent chain

      const orderE = generateEntityId();
      const orderF = generateEntityId();

      await Promise.all([
        redeemInTransaction(orderE, 20),
        redeemInTransaction(orderF, 20),
      ]);

      // Fetch all redemption transactions, ordered by creation
      const transactions = await prisma.giftCardTransaction.findMany({
        where: { tenantId: TENANT_ID, giftCardId: GIFT_CARD_ID },
        orderBy: { createdAt: "asc" },
      });

      expect(transactions).toHaveLength(2);

      // Verify chain: first tx balanceAfter === second tx balanceBefore
      const first = transactions[0];
      const second = transactions[1];

      expect(Number(first.balanceBefore)).toBe(50);
      expect(Number(first.balanceAfter)).toBe(30);
      expect(Number(second.balanceBefore)).toBe(30);
      expect(Number(second.balanceAfter)).toBe(10);

      // Verify final balance matches last transaction
      const giftCard = await prisma.giftCard.findUnique({
        where: { id: GIFT_CARD_ID },
      });
      expect(Number(giftCard!.currentBalance)).toBe(10);
    });
  });

  // ==================== Idempotency Tests ====================

  describe("Payment Idempotency", () => {
    it("should reject duplicate PaymentIntent via unique constraint", async () => {
      const orderId1 = generateEntityId();
      const orderId2 = generateEntityId();
      const sharedPaymentIntentId = `pi_duplicate_${Date.now()}`;

      // Create two orders to use as FK targets
      for (const oid of [orderId1, orderId2]) {
        await prisma.order.create({
          data: {
            id: oid,
            tenantId: TENANT_ID,
            merchantId: MERCHANT_ID,
            orderNumber: `DUP-${oid.slice(-6)}-${Date.now()}`,
            customerFirstName: "Dup",
            customerLastName: "Test",
            customerPhone: "222-222-2222",
            orderMode: "pickup",
            salesChannel: "online_order",
            items: [],
            subtotal: 10,
            taxAmount: 0,
            totalAmount: 10,
          },
        });
      }

      // First payment record — should succeed
      await prisma.payment.create({
        data: {
          id: generateEntityId(),
          tenantId: TENANT_ID,
          orderId: orderId1,
          stripePaymentIntentId: sharedPaymentIntentId,
          amount: 10,
          currency: "USD",
          status: "pending",
        },
      });

      // Second payment record with same PaymentIntent — should fail
      await expect(
        prisma.payment.create({
          data: {
            id: generateEntityId(),
            tenantId: TENANT_ID,
            orderId: orderId2,
            stripePaymentIntentId: sharedPaymentIntentId,
            amount: 10,
            currency: "USD",
            status: "pending",
          },
        })
      ).rejects.toThrow(); // Prisma unique constraint violation
    });

    it("should apply CAS — only first call transitions pending→succeeded, second is no-op", async () => {
      const orderId = generateEntityId();
      const paymentId = generateEntityId();
      const intentId = `pi_cas_${Date.now()}`;

      // Create order + payment in pending status
      await prisma.order.create({
        data: {
          id: orderId,
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          orderNumber: `CAS-${Date.now()}`,
          customerFirstName: "CAS",
          customerLastName: "Test",
          customerPhone: "333-333-3333",
          orderMode: "pickup",
          salesChannel: "online_order",
          items: [],
          subtotal: 25,
          taxAmount: 0,
          totalAmount: 25,
        },
      });

      await prisma.payment.create({
        data: {
          id: paymentId,
          tenantId: TENANT_ID,
          orderId,
          stripePaymentIntentId: intentId,
          amount: 25,
          currency: "USD",
          status: "pending",
        },
      });

      const casUpdate = (paidAt: Date) =>
        prisma.payment.updateMany({
          where: {
            stripePaymentIntentId: intentId,
            status: "pending",
            deleted: false,
          },
          data: {
            status: "succeeded",
            paidAt,
          },
        });

      // First webhook: pending → succeeded (should succeed)
      const r1 = await casUpdate(new Date("2026-04-09T10:00:00Z"));
      expect(r1.count).toBe(1);

      // Second webhook (duplicate/replay): still targets pending → succeeded
      // But status is now "succeeded", so WHERE doesn't match
      const r2 = await casUpdate(new Date("2026-04-09T10:00:01Z"));
      expect(r2.count).toBe(0);

      // Verify payment is in succeeded status with first timestamp
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      expect(payment!.status).toBe("succeeded");
      expect(payment!.paidAt!.toISOString()).toBe("2026-04-09T10:00:00.000Z");
    });

    it("should prevent CAS transition from succeeded back to pending", async () => {
      const orderId = generateEntityId();
      const paymentId = generateEntityId();
      const intentId = `pi_no_revert_${Date.now()}`;

      await prisma.order.create({
        data: {
          id: orderId,
          tenantId: TENANT_ID,
          merchantId: MERCHANT_ID,
          orderNumber: `NR-${Date.now()}`,
          customerFirstName: "NoRevert",
          customerLastName: "Test",
          customerPhone: "444-444-4444",
          orderMode: "pickup",
          salesChannel: "online_order",
          items: [],
          subtotal: 15,
          taxAmount: 0,
          totalAmount: 15,
        },
      });

      // Create payment already in succeeded status
      await prisma.payment.create({
        data: {
          id: paymentId,
          tenantId: TENANT_ID,
          orderId,
          stripePaymentIntentId: intentId,
          amount: 15,
          currency: "USD",
          status: "succeeded",
          paidAt: new Date(),
        },
      });

      // Try to transition succeeded → failed (late "failed" webhook)
      const result = await prisma.payment.updateMany({
        where: {
          stripePaymentIntentId: intentId,
          status: "pending", // CAS: only from pending
          deleted: false,
        },
        data: { status: "failed" },
      });

      // Should not update — CAS condition not met
      expect(result.count).toBe(0);

      // Verify still succeeded
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      expect(payment!.status).toBe("succeeded");
    });
  });

  // ==================== Edge Cases ====================

  describe("Balance Edge Cases", () => {
    it("should handle exact balance redemption — balance goes to zero", async () => {
      const orderId = generateEntityId();

      const result = await redeemInTransaction(orderId, 50);

      expect(result.amountRedeemed).toBe(50);
      expect(result.newBalance).toBe(0);

      const giftCard = await prisma.giftCard.findUnique({
        where: { id: GIFT_CARD_ID },
      });
      expect(Number(giftCard!.currentBalance)).toBe(0);
    });

    it("should cap redemption at available balance (partial redemption)", async () => {
      const orderId = generateEntityId();

      // Request $80 from a $50 card
      const result = await redeemInTransaction(orderId, 80);

      expect(result.amountRedeemed).toBe(50);
      expect(result.newBalance).toBe(0);

      // Verify the order recorded the correct giftCardPayment
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      expect(Number(order!.giftCardPayment)).toBe(50);
      expect(Number(order!.cashPayment)).toBe(30); // 80 - 50
    });

    it("should reject redemption on zero-balance card", async () => {
      // Drain the card first
      await prisma.giftCard.update({
        where: { id: GIFT_CARD_ID },
        data: { currentBalance: 0 },
      });

      const orderId = generateEntityId();

      await expect(redeemInTransaction(orderId, 10)).rejects.toThrow(
        "Gift card has no balance"
      );

      // Verify no order was created (transaction rolled back)
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      expect(order).toBeNull();
    });
  });
});
