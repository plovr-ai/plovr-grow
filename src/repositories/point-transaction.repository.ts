import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export const POINT_TRANSACTION_TYPES = ["earn", "redeem", "adjust", "expire"] as const;
export type PointTransactionType = (typeof POINT_TRANSACTION_TYPES)[number];

export class PointTransactionRepository {
  /**
   * Get transaction by ID
   */
  async getById(tenantId: string, id: string) {
    return prisma.pointTransaction.findFirst({
      where: {
        id,
        tenantId,
        deleted: false,
      },
    });
  }

  /**
   * Create a new point transaction
   */
  async create(
    tenantId: string,
    data: {
      memberId: string;
      merchantId?: string | null;
      orderId?: string | null;
      type: PointTransactionType;
      points: number;
      balanceBefore: number;
      balanceAfter: number;
      description?: string | null;
    },
    tx?: DbClient
  ) {
    const client = tx ?? prisma;
    return client.pointTransaction.create({
      data: {
        id: generateEntityId(),
        tenantId,
        memberId: data.memberId,
        merchantId: data.merchantId,
        orderId: data.orderId,
        type: data.type,
        points: data.points,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        description: data.description,
      },
    });
  }

  /**
   * Get transaction history for a member with pagination
   */
  async getByMember(
    tenantId: string,
    memberId: string,
    options: {
      page?: number;
      pageSize?: number;
      type?: PointTransactionType;
    } = {}
  ) {
    const { page = 1, pageSize = 20, type } = options;

    const where: Prisma.PointTransactionWhereInput = {
      tenantId,
      memberId,
      deleted: false,
    };

    if (type) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      prisma.pointTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      }),
      prisma.pointTransaction.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get transaction by order ID
   */
  async getByOrderId(tenantId: string, orderId: string) {
    return prisma.pointTransaction.findFirst({
      where: {
        tenantId,
        orderId,
        deleted: false,
      },
    });
  }

  /**
   * Get earn transaction for an order (used for idempotent returns)
   */
  async getEarnTransactionForOrder(tenantId: string, orderId: string) {
    return prisma.pointTransaction.findFirst({
      where: {
        tenantId,
        orderId,
        type: "earn",
        deleted: false,
      },
    });
  }

  /**
   * Check if points already awarded for an order
   */
  async hasEarnedForOrder(tenantId: string, orderId: string): Promise<boolean> {
    const transaction = await prisma.pointTransaction.findFirst({
      where: {
        tenantId,
        orderId,
        type: "earn",
        deleted: false,
      },
    });
    return transaction !== null;
  }

  /**
   * Get total points earned by a member
   */
  async getTotalPointsEarned(tenantId: string, memberId: string): Promise<number> {
    const result = await prisma.pointTransaction.aggregate({
      where: {
        tenantId,
        memberId,
        type: "earn",
        deleted: false,
      },
      _sum: {
        points: true,
      },
    });
    return result._sum.points ?? 0;
  }

  /**
   * Get transaction stats for a company
   */
  async getCompanyStats(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    const where: Prisma.PointTransactionWhereInput = {
      tenantId,
      deleted: false,
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [earnedResult, redeemedResult, transactionCount] = await Promise.all([
      prisma.pointTransaction.aggregate({
        where: { ...where, type: "earn" },
        _sum: { points: true },
      }),
      prisma.pointTransaction.aggregate({
        where: { ...where, type: "redeem" },
        _sum: { points: true },
      }),
      prisma.pointTransaction.count({ where }),
    ]);

    return {
      totalPointsEarned: earnedResult._sum.points ?? 0,
      totalPointsRedeemed: Math.abs(redeemedResult._sum.points ?? 0),
      transactionCount,
    };
  }
}

export const pointTransactionRepository = new PointTransactionRepository();
