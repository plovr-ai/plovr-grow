import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export const GIFT_CARD_STATUSES = ["active", "depleted", "disabled"] as const;
export type GiftCardStatus = (typeof GIFT_CARD_STATUSES)[number];

export const GIFT_CARD_TRANSACTION_TYPES = ["purchase", "redemption", "refund"] as const;
export type GiftCardTransactionType = (typeof GIFT_CARD_TRANSACTION_TYPES)[number];

export class GiftCardRepository {
  /**
   * Create a new gift card
   */
  async create(
    tenantId: string,
    companyId: string,
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
        companyId,
        cardNumber: data.cardNumber,
        initialAmount: data.initialAmount,
        currentBalance: data.initialAmount,
        purchaseOrderId: data.purchaseOrderId,
        status: "active",
      },
    });
  }

  /**
   * Get gift card by ID
   */
  async getById(tenantId: string, id: string) {
    return prisma.giftCard.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  }

  /**
   * Get gift card by card number
   */
  async getByCardNumber(tenantId: string, companyId: string, cardNumber: string) {
    return prisma.giftCard.findFirst({
      where: {
        tenantId,
        companyId,
        cardNumber,
      },
    });
  }

  /**
   * Check if a card number already exists (globally unique)
   */
  async cardNumberExists(cardNumber: string): Promise<boolean> {
    const card = await prisma.giftCard.findUnique({
      where: { cardNumber },
    });
    return card !== null;
  }

  /**
   * Update gift card balance
   */
  async updateBalance(
    tenantId: string,
    id: string,
    newBalance: number,
    status?: GiftCardStatus
  ) {
    const updateData: Prisma.GiftCardUpdateInput = {
      currentBalance: newBalance,
    };

    if (status) {
      updateData.status = status;
    } else if (newBalance <= 0) {
      updateData.status = "depleted";
    }

    return prisma.giftCard.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Disable a gift card
   */
  async disable(tenantId: string, id: string) {
    return prisma.giftCard.update({
      where: { id },
      data: { status: "disabled" },
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
    }
  ) {
    return prisma.giftCardTransaction.create({
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
   * Get gift cards for a company with pagination
   */
  async getByCompany(
    tenantId: string,
    companyId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: GiftCardStatus;
    } = {}
  ) {
    const { page = 1, pageSize = 20, status } = options;

    const where: Prisma.GiftCardWhereInput = {
      tenantId,
      companyId,
    };

    if (status) {
      where.status = status;
    }

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
      },
    });
  }
}

export const giftCardRepository = new GiftCardRepository();
