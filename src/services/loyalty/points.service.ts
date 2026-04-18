import { pointTransactionRepository } from "@/repositories/point-transaction.repository";
import { loyaltyMemberRepository } from "@/repositories/loyalty-member.repository";
import { runInTransaction } from "@/lib/transaction";
import { Prisma } from "@prisma/client";
import { AppError, ErrorCodes } from "@/lib/errors";
import type {
  AwardPointsInput,
  AwardCustomPointsInput,
  PointsEarnResult,
  PaginatedTransactions,
} from "./loyalty.types";

/**
 * Calculate points for an order amount
 */
function calculatePointsForOrder(orderAmount: number, pointsPerDollar: number): number {
  // Round down to nearest integer
  return Math.floor(orderAmount * pointsPerDollar);
}

/**
 * Build an idempotent result from an existing earn transaction for an order.
 * Used when a duplicate award is detected (either via pre-check or P2002).
 */
async function buildIdempotentResult(
  tenantId: string,
  orderId: string
): Promise<PointsEarnResult> {
  const existing = await pointTransactionRepository.getEarnTransactionForOrder(
    tenantId,
    orderId
  );
  if (!existing) {
    throw new AppError(ErrorCodes.LOYALTY_POINTS_ALREADY_AWARDED, undefined, 409);
  }
  return {
    pointsEarned: existing.points,
    newBalance: existing.balanceAfter,
    transactionId: existing.id,
  };
}

/**
 * Award points to a member
 * Idempotent: duplicate calls for the same order return the existing result.
 */
async function awardPoints(
  tenantId: string,
  memberId: string,
  input: AwardPointsInput
): Promise<PointsEarnResult> {
  // Fast-path: check if points already awarded for this order
  if (input.orderId) {
    const alreadyAwarded = await pointTransactionRepository.hasEarnedForOrder(
      tenantId,
      input.orderId
    );
    if (alreadyAwarded) {
      return buildIdempotentResult(tenantId, input.orderId);
    }
  }

  // Get current member balance
  const member = await loyaltyMemberRepository.getById(tenantId, memberId);
  if (!member) {
    throw new AppError(ErrorCodes.LOYALTY_MEMBER_NOT_FOUND, undefined, 404);
  }

  // Calculate points
  const pointsEarned = calculatePointsForOrder(
    input.orderAmount,
    input.pointsPerDollar
  );

  if (pointsEarned <= 0) {
    return {
      pointsEarned: 0,
      newBalance: member.points,
      transactionId: "",
    };
  }

  const balanceBefore = member.points;
  const balanceAfter = balanceBefore + pointsEarned;

  try {
    // Atomic: create transaction record + update member balance
    const transaction = await runInTransaction(async (tx) => {
      const txn = await pointTransactionRepository.create(tenantId, {
        memberId,
        merchantId: input.merchantId,
        orderId: input.orderId,
        type: "earn",
        points: pointsEarned,
        balanceBefore,
        balanceAfter,
        description: input.description ?? `Earned ${pointsEarned} points from order`,
      }, tx);

      await loyaltyMemberRepository.updatePoints(tenantId, memberId, pointsEarned, tx);

      return txn;
    });

    return {
      pointsEarned,
      newBalance: balanceAfter,
      transactionId: transaction.id,
    };
  } catch (error) {
    // DB-level duplicate protection: unique constraint on (tenantId, orderId, type)
    if (
      input.orderId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return buildIdempotentResult(tenantId, input.orderId);
    }
    throw error;
  }
}

/**
 * Award a custom points amount (for special cases like gift card double points)
 * Unlike awardPoints, this accepts a pre-calculated points value.
 * Idempotent: duplicate calls for the same order return the existing result.
 */
async function awardPointsWithCustomAmount(
  tenantId: string,
  memberId: string,
  input: AwardCustomPointsInput
): Promise<PointsEarnResult> {
  // Fast-path: check if points already awarded for this order
  if (input.orderId) {
    const alreadyAwarded = await pointTransactionRepository.hasEarnedForOrder(
      tenantId,
      input.orderId
    );
    if (alreadyAwarded) {
      return buildIdempotentResult(tenantId, input.orderId);
    }
  }

  // Get current member balance
  const member = await loyaltyMemberRepository.getById(tenantId, memberId);
  if (!member) {
    throw new AppError(ErrorCodes.LOYALTY_MEMBER_NOT_FOUND, undefined, 404);
  }

  const pointsEarned = input.points;

  if (pointsEarned <= 0) {
    return {
      pointsEarned: 0,
      newBalance: member.points,
      transactionId: "",
    };
  }

  const balanceBefore = member.points;
  const balanceAfter = balanceBefore + pointsEarned;

  try {
    // Atomic: create transaction record + update member balance
    const transaction = await runInTransaction(async (tx) => {
      const txn = await pointTransactionRepository.create(tenantId, {
        memberId,
        merchantId: input.merchantId,
        orderId: input.orderId,
        type: "earn",
        points: pointsEarned,
        balanceBefore,
        balanceAfter,
        description: input.description ?? `Earned ${pointsEarned} points`,
      }, tx);

      await loyaltyMemberRepository.updatePoints(tenantId, memberId, pointsEarned, tx);

      return txn;
    });

    return {
      pointsEarned,
      newBalance: balanceAfter,
      transactionId: transaction.id,
    };
  } catch (error) {
    // DB-level duplicate protection: unique constraint on (tenantId, orderId, type)
    if (
      input.orderId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return buildIdempotentResult(tenantId, input.orderId);
    }
    throw error;
  }
}

/**
 * Manually adjust points (for admin use)
 */
async function adjustPoints(
  tenantId: string,
  memberId: string,
  points: number,
  description: string
): Promise<PointsEarnResult> {
  // Get current member balance
  const member = await loyaltyMemberRepository.getById(tenantId, memberId);
  if (!member) {
    throw new AppError(ErrorCodes.LOYALTY_MEMBER_NOT_FOUND, undefined, 404);
  }

  const balanceBefore = member.points;
  const balanceAfter = balanceBefore + points;

  // Prevent negative balance
  if (balanceAfter < 0) {
    throw new AppError(ErrorCodes.LOYALTY_NEGATIVE_BALANCE, undefined, 400);
  }

  // Create transaction record
  const transaction = await pointTransactionRepository.create(tenantId, {
    memberId,
    type: "adjust",
    points,
    balanceBefore,
    balanceAfter,
    description,
  });

  // Update member balance
  await loyaltyMemberRepository.updatePoints(tenantId, memberId, points);

  return {
    pointsEarned: points,
    newBalance: balanceAfter,
    transactionId: transaction.id,
  };
}

/**
 * Get transaction history for a member
 */
async function getTransactionHistory(
  tenantId: string,
  memberId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<PaginatedTransactions> {
  const result = await pointTransactionRepository.getByMember(
    tenantId,
    memberId,
    options
  );

  return {
    ...result,
    items: result.items.map((t) => ({
      id: t.id,
      memberId: t.memberId,
      merchantId: t.merchantId,
      orderId: t.orderId,
      type: t.type,
      points: t.points,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      description: t.description,
      createdAt: t.createdAt,
      merchant: t.merchant,
      order: t.order,
    })),
  };
}

/**
 * Get total points earned by a member
 */
async function getTotalPointsEarned(tenantId: string, memberId: string): Promise<number> {
  return pointTransactionRepository.getTotalPointsEarned(tenantId, memberId);
}

/**
 * Check if points already awarded for an order
 */
async function hasEarnedForOrder(tenantId: string, orderId: string): Promise<boolean> {
  return pointTransactionRepository.hasEarnedForOrder(tenantId, orderId);
}

export const pointsService = {
  calculatePointsForOrder,
  awardPoints,
  awardPointsWithCustomAmount,
  adjustPoints,
  getTransactionHistory,
  getTotalPointsEarned,
  hasEarnedForOrder,
};
