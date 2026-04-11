import {
  pointTransactionRepository,
  type PointTransactionRepository,
} from "@/repositories/point-transaction.repository";
import {
  loyaltyMemberRepository,
  type LoyaltyMemberRepository,
} from "@/repositories/loyalty-member.repository";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError, ErrorCodes } from "@/lib/errors";
import type {
  AwardPointsInput,
  AwardCustomPointsInput,
  PointsEarnResult,
  PaginatedTransactions,
} from "./loyalty.types";

export class PointsService {
  private _transactionRepository: PointTransactionRepository | null = null;
  private _memberRepository: LoyaltyMemberRepository | null = null;

  private get transactionRepository(): PointTransactionRepository {
    if (!this._transactionRepository) {
      this._transactionRepository = pointTransactionRepository;
    }
    return this._transactionRepository;
  }

  private get memberRepository(): LoyaltyMemberRepository {
    if (!this._memberRepository) {
      this._memberRepository = loyaltyMemberRepository;
    }
    return this._memberRepository;
  }

  /**
   * Calculate points for an order amount
   */
  calculatePointsForOrder(orderAmount: number, pointsPerDollar: number): number {
    // Round down to nearest integer
    return Math.floor(orderAmount * pointsPerDollar);
  }

  /**
   * Award points to a member
   * Idempotent: duplicate calls for the same order return the existing result.
   */
  async awardPoints(
    tenantId: string,
    memberId: string,
    input: AwardPointsInput
  ): Promise<PointsEarnResult> {
    // Fast-path: check if points already awarded for this order
    if (input.orderId) {
      const alreadyAwarded = await this.transactionRepository.hasEarnedForOrder(
        tenantId,
        input.orderId
      );
      if (alreadyAwarded) {
        return this.buildIdempotentResult(tenantId, input.orderId);
      }
    }

    // Get current member balance
    const member = await this.memberRepository.getById(tenantId, memberId);
    if (!member) {
      throw new AppError(ErrorCodes.LOYALTY_MEMBER_NOT_FOUND, undefined, 404);
    }

    // Calculate points
    const pointsEarned = this.calculatePointsForOrder(
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
      const transaction = await prisma.$transaction(async (tx) => {
        const txn = await this.transactionRepository.create(tenantId, {
          memberId,
          merchantId: input.merchantId,
          orderId: input.orderId,
          type: "earn",
          points: pointsEarned,
          balanceBefore,
          balanceAfter,
          description: input.description ?? `Earned ${pointsEarned} points from order`,
        }, tx);

        await this.memberRepository.updatePoints(tenantId, memberId, pointsEarned, tx);

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
        return this.buildIdempotentResult(tenantId, input.orderId);
      }
      throw error;
    }
  }

  /**
   * Award a custom points amount (for special cases like gift card double points)
   * Unlike awardPoints, this accepts a pre-calculated points value.
   * Idempotent: duplicate calls for the same order return the existing result.
   */
  async awardPointsWithCustomAmount(
    tenantId: string,
    memberId: string,
    input: AwardCustomPointsInput
  ): Promise<PointsEarnResult> {
    // Fast-path: check if points already awarded for this order
    if (input.orderId) {
      const alreadyAwarded = await this.transactionRepository.hasEarnedForOrder(
        tenantId,
        input.orderId
      );
      if (alreadyAwarded) {
        return this.buildIdempotentResult(tenantId, input.orderId);
      }
    }

    // Get current member balance
    const member = await this.memberRepository.getById(tenantId, memberId);
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
      const transaction = await prisma.$transaction(async (tx) => {
        const txn = await this.transactionRepository.create(tenantId, {
          memberId,
          merchantId: input.merchantId,
          orderId: input.orderId,
          type: "earn",
          points: pointsEarned,
          balanceBefore,
          balanceAfter,
          description: input.description ?? `Earned ${pointsEarned} points`,
        }, tx);

        await this.memberRepository.updatePoints(tenantId, memberId, pointsEarned, tx);

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
        return this.buildIdempotentResult(tenantId, input.orderId);
      }
      throw error;
    }
  }

  /**
   * Manually adjust points (for admin use)
   */
  async adjustPoints(
    tenantId: string,
    memberId: string,
    points: number,
    description: string
  ): Promise<PointsEarnResult> {
    // Get current member balance
    const member = await this.memberRepository.getById(tenantId, memberId);
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
    const transaction = await this.transactionRepository.create(tenantId, {
      memberId,
      type: "adjust",
      points,
      balanceBefore,
      balanceAfter,
      description,
    });

    // Update member balance
    await this.memberRepository.updatePoints(tenantId, memberId, points);

    return {
      pointsEarned: points,
      newBalance: balanceAfter,
      transactionId: transaction.id,
    };
  }

  /**
   * Get transaction history for a member
   */
  async getTransactionHistory(
    tenantId: string,
    memberId: string,
    options?: {
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedTransactions> {
    const result = await this.transactionRepository.getByMember(
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
  async getTotalPointsEarned(tenantId: string, memberId: string): Promise<number> {
    return this.transactionRepository.getTotalPointsEarned(tenantId, memberId);
  }

  /**
   * Check if points already awarded for an order
   */
  async hasEarnedForOrder(tenantId: string, orderId: string): Promise<boolean> {
    return this.transactionRepository.hasEarnedForOrder(tenantId, orderId);
  }

  /**
   * Build an idempotent result from an existing earn transaction for an order.
   * Used when a duplicate award is detected (either via pre-check or P2002).
   */
  private async buildIdempotentResult(
    tenantId: string,
    orderId: string
  ): Promise<PointsEarnResult> {
    const existing = await this.transactionRepository.getEarnTransactionForOrder(
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
}

export const pointsService = new PointsService();
