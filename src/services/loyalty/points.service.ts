import {
  pointTransactionRepository,
  type PointTransactionRepository,
} from "@/repositories/point-transaction.repository";
import {
  loyaltyMemberRepository,
  type LoyaltyMemberRepository,
} from "@/repositories/loyalty-member.repository";
import type {
  AwardPointsInput,
  PointsEarnResult,
  PointTransactionData,
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
   */
  async awardPoints(
    tenantId: string,
    memberId: string,
    input: AwardPointsInput
  ): Promise<PointsEarnResult> {
    // Check if points already awarded for this order
    if (input.orderId) {
      const existing = await this.transactionRepository.hasEarnedForOrder(
        tenantId,
        input.orderId
      );
      if (existing) {
        throw new Error("Points already awarded for this order");
      }
    }

    // Get current member balance
    const member = await this.memberRepository.getById(tenantId, memberId);
    if (!member) {
      throw new Error("Loyalty member not found");
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

    // Create transaction record
    const transaction = await this.transactionRepository.create(tenantId, {
      memberId,
      merchantId: input.merchantId,
      orderId: input.orderId,
      type: "earn",
      points: pointsEarned,
      balanceBefore,
      balanceAfter,
      description: input.description ?? `Earned ${pointsEarned} points from order`,
    });

    // Update member balance
    await this.memberRepository.updatePoints(tenantId, memberId, pointsEarned);

    return {
      pointsEarned,
      newBalance: balanceAfter,
      transactionId: transaction.id,
    };
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
      throw new Error("Loyalty member not found");
    }

    const balanceBefore = member.points;
    const balanceAfter = balanceBefore + points;

    // Prevent negative balance
    if (balanceAfter < 0) {
      throw new Error("Adjustment would result in negative balance");
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
}

export const pointsService = new PointsService();
