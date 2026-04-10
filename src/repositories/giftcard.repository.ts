import prisma, { type DbClient } from "@/lib/db";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export const GIFT_CARD_TRANSACTION_TYPES = ["purchase", "redemption", "refund"] as const;
export type GiftCardTransactionType = (typeof GIFT_CARD_TRANSACTION_TYPES)[number];

export class GiftCardRepository {
  /**
   * Create a new gift card
   */
  async create(
    tenantId: string,
    data: {
      cardNumber: string;
      initialAmount: number;
      purchaseOrderId: string;
    }
  ) {
    return prisma.giftCard.create({
      data: {
        id: generateEntityId(),
        tenantId,
        cardNumber: data.cardNumber,
        initialAmount: data.initialAmount,
        currentBalance: data.initialAmount,
        purchaseOrderId: data.purchaseOrderId,
      },
    });
  }

  /**
   * Get gift card by ID
   */
  async getById(tenantId: string, id: string, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.giftCard.findFirst({
      where: {
        id,
        tenantId,
        deleted: false,
      },
    });
  }

  /**
   * Get gift card by ID with row-level lock (FOR UPDATE).
   * Must be called within a prisma.$transaction() context.
   */
  async getByIdForUpdate(tenantId: string, id: string, tx: DbClient) {
    const rows = await (tx as PrismaClient).$queryRaw<
      Array<{ id: string; current_balance: string }>
    >`SELECT id, current_balance FROM gift_cards WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted = false FOR UPDATE`;

    if (rows.length === 0) return null;

    return {
      id: rows[0].id,
      currentBalance: rows[0].current_balance,
    };
  }

  /**
   * Get gift card by card number
   */
  async getByCardNumber(tenantId: string, cardNumber: string) {
    return prisma.giftCard.findFirst({
      where: {
        tenantId,
        cardNumber,
        deleted: false,
      },
    });
  }

  /**
   * Check if a card number already exists (globally unique)
   */
  async cardNumberExists(cardNumber: string): Promise<boolean> {
    const card = await prisma.giftCard.findFirst({
      where: { cardNumber, deleted: false },
    });
    return card !== null;
  }

  /**
   * Update gift card balance
   */
  async updateBalance(tenantId: string, id: string, newBalance: number, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.giftCard.update({
      where: { id },
      data: { currentBalance: newBalance },
    });
  }

  /**
   * Create a gift card transaction
   */
  async createTransaction(
    tenantId: string,
    data: {
      giftCardId: string;
      orderId?: string | null;
      type: GiftCardTransactionType;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
    },
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    return db.giftCardTransaction.create({
      data: {
        id: generateEntityId(),
        tenantId,
        giftCardId: data.giftCardId,
        orderId: data.orderId,
        type: data.type,
        amount: data.amount,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
      },
    });
  }

  /**
   * Get transactions for a gift card
   */
  async getTransactionsByGiftCardId(tenantId: string, giftCardId: string) {
    return prisma.giftCardTransaction.findMany({
      where: {
        tenantId,
        giftCardId,
        deleted: false,
      },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    });
  }

  /**
   * Get gift card statistics for a company
   */
  async getStatsByTenant(
    tenantId: string,
    options: {
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{
    totalCards: number;
    totalValueSold: number;
    totalRedeemed: number;
    activeBalance: number;
  }> {
    const { dateFrom, dateTo } = options;

    const dateFilter =
      dateFrom && dateTo
        ? {
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          }
        : {};

    const giftCardWhere = { tenantId, deleted: false, ...dateFilter };

    const [totals, activeBalanceSum, redemptionTotal] = await Promise.all([
      // Sum initial amounts and count total
      prisma.giftCard.aggregate({
        where: giftCardWhere,
        _sum: { initialAmount: true },
        _count: true,
      }),
      // Sum all current balances
      prisma.giftCard.aggregate({
        where: giftCardWhere,
        _sum: { currentBalance: true },
      }),
      // Sum redemption transactions for gift cards in the date range
      prisma.giftCardTransaction.aggregate({
        where: {
          tenantId,
          deleted: false,
          giftCard: { ...dateFilter },
          type: "redemption",
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalCards: totals._count,
      totalValueSold: Number(totals._sum.initialAmount ?? 0),
      totalRedeemed: Number(redemptionTotal._sum.amount ?? 0),
      activeBalance: Number(activeBalanceSum._sum.currentBalance ?? 0),
    };
  }

  /**
   * Get gift cards for a company with pagination
   */
  async getByTenant(
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ) {
    const { page = 1, pageSize = 20, search, dateFrom, dateTo } = options;

    const where: Prisma.GiftCardWhereInput = {
      tenantId,
      deleted: false,
      ...(search && {
        OR: [
          { cardNumber: { contains: search } },
          { purchaseOrder: { customerEmail: { contains: search } } },
          { purchaseOrder: { customerFirstName: { contains: search } } },
          { purchaseOrder: { customerLastName: { contains: search } } },
        ],
      }),
      ...(dateFrom &&
        dateTo && {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        }),
    };

    const [items, total] = await Promise.all([
      prisma.giftCard.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          purchaseOrder: {
            select: {
              id: true,
              orderNumber: true,
              customerFirstName: true,
              customerLastName: true,
              customerEmail: true,
            },
          },
        },
      }),
      prisma.giftCard.count({ where }),
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
   * Get gift card by purchase order ID
   */
  async getByPurchaseOrderId(tenantId: string, purchaseOrderId: string) {
    return prisma.giftCard.findFirst({
      where: {
        tenantId,
        purchaseOrderId,
        deleted: false,
      },
    });
  }
}

export const giftCardRepository = new GiftCardRepository();
