import {
  giftCardRepository,
  type GiftCardRepository,
} from "@/repositories/giftcard.repository";
import type { DbClient } from "@/lib/db";
import {
  generateGiftCardNumber,
  normalizeGiftCardNumber,
  formatGiftCardNumber,
  isValidGiftCardFormat,
} from "@/lib/giftcard";
import type {
  GiftCardData,
  GiftCardStats,
  GiftCardValidationResult,
  GiftCardRedemptionResult,
  CreateGiftCardInput,
  PaginatedGiftCards,
  GiftCardWithOrder,
} from "./giftcard.types";

export class GiftCardService {
  private _repository: GiftCardRepository | null = null;

  private get repository(): GiftCardRepository {
    if (!this._repository) {
      this._repository = giftCardRepository;
    }
    return this._repository;
  }

  /**
   * Create a new gift card after purchase order is created
   */
  async createGiftCard(
    tenantId: string,
    input: CreateGiftCardInput
  ): Promise<GiftCardData> {
    // Generate a unique card number
    let cardNumber = generateGiftCardNumber();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure uniqueness
    while (await this.repository.cardNumberExists(cardNumber)) {
      cardNumber = generateGiftCardNumber();
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error("Failed to generate unique gift card number");
      }
    }

    // Create the gift card
    const giftCard = await this.repository.create(tenantId, {
      cardNumber,
      initialAmount: input.amount,
      purchaseOrderId: input.purchaseOrderId,
    });

    // Create initial "purchase" transaction
    await this.repository.createTransaction(tenantId, {
      giftCardId: giftCard.id,
      orderId: input.purchaseOrderId,
      type: "purchase",
      amount: input.amount,
      balanceBefore: 0,
      balanceAfter: input.amount,
    });

    return this.toGiftCardData(giftCard);
  }

  /**
   * Validate a gift card by card number
   */
  async validateGiftCard(
    tenantId: string,
    cardNumber: string
  ): Promise<GiftCardValidationResult> {
    // Validate format first
    if (!isValidGiftCardFormat(cardNumber)) {
      return {
        valid: false,
        error: "invalid_format",
      };
    }

    // Normalize and format the card number for lookup
    const normalizedNumber = normalizeGiftCardNumber(cardNumber);
    const formattedNumber = formatGiftCardNumber(normalizedNumber);

    // Look up the gift card
    const giftCard = await this.repository.getByCardNumber(
      tenantId,
      formattedNumber
    );

    if (!giftCard) {
      return {
        valid: false,
        error: "not_found",
      };
    }

    // Check if card has balance
    if (Number(giftCard.currentBalance) <= 0) {
      return {
        valid: false,
        error: "no_balance",
      };
    }

    return {
      valid: true,
      giftCard: this.toGiftCardData(giftCard),
    };
  }

  /**
   * Redeem a gift card for an order
   */
  async redeemGiftCard(
    tenantId: string,
    giftCardId: string,
    orderId: string,
    amount: number,
    tx?: DbClient
  ): Promise<GiftCardRedemptionResult> {
    // Get the gift card
    const giftCard = tx
      ? await this.repository.getByIdForUpdate(tenantId, giftCardId, tx)
      : await this.repository.getById(tenantId, giftCardId);

    if (!giftCard) {
      throw new Error("Gift card not found");
    }

    const currentBalance = Number(giftCard.currentBalance);

    if (currentBalance <= 0) {
      throw new Error("Gift card has no balance");
    }

    // Calculate actual redemption amount (can't redeem more than balance)
    const amountToRedeem = Math.min(amount, currentBalance);
    const newBalance = currentBalance - amountToRedeem;

    // Update balance
    await this.repository.updateBalance(tenantId, giftCardId, newBalance, tx);

    // Create redemption transaction
    const transaction = await this.repository.createTransaction(tenantId, {
      giftCardId,
      orderId,
      type: "redemption",
      amount: amountToRedeem,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    }, tx);

    return {
      success: true,
      amountRedeemed: amountToRedeem,
      remainingBalance: newBalance,
      transactionId: transaction.id,
    };
  }

  /**
   * Get gift card balance by card number
   */
  async getBalance(
    tenantId: string,
    cardNumber: string
  ): Promise<number | null> {
    const normalizedNumber = normalizeGiftCardNumber(cardNumber);
    const formattedNumber = formatGiftCardNumber(normalizedNumber);

    const giftCard = await this.repository.getByCardNumber(
      tenantId,
      formattedNumber
    );

    if (!giftCard) {
      return null;
    }

    return Number(giftCard.currentBalance);
  }

  /**
   * Get gift card by ID
   */
  async getGiftCard(tenantId: string, giftCardId: string): Promise<GiftCardData | null> {
    const giftCard = await this.repository.getById(tenantId, giftCardId);

    if (!giftCard) {
      return null;
    }

    return this.toGiftCardData(giftCard);
  }

  /**
   * Get gift card by purchase order ID
   */
  async getGiftCardByOrderId(
    tenantId: string,
    purchaseOrderId: string
  ): Promise<GiftCardData | null> {
    const giftCard = await this.repository.getByPurchaseOrderId(
      tenantId,
      purchaseOrderId
    );

    if (!giftCard) {
      return null;
    }

    return this.toGiftCardData(giftCard);
  }

  /**
   * Get gift card statistics for Dashboard overview
   */
  async getTenantGiftCardStats(
    tenantId: string,
    options: {
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<GiftCardStats> {
    return this.repository.getStatsByTenant(tenantId, options);
  }

  /**
   * Get gift cards for a company (for Dashboard)
   */
  async getTenantGiftCards(
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<PaginatedGiftCards> {
    const result = await this.repository.getByTenant(tenantId, options);

    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        cardNumber: item.cardNumber,
        initialAmount: Number(item.initialAmount),
        currentBalance: Number(item.currentBalance),
        createdAt: item.createdAt,
        purchaseOrder: {
          id: item.purchaseOrder.id,
          orderNumber: item.purchaseOrder.orderNumber,
          customerFirstName: item.purchaseOrder.customerFirstName,
          customerLastName: item.purchaseOrder.customerLastName,
          customerEmail: item.purchaseOrder.customerEmail,
        },
      })) as GiftCardWithOrder[],
    };
  }

  /**
   * Convert database model to GiftCardData
   */
  private toGiftCardData(giftCard: {
    id: string;
    cardNumber: string;
    initialAmount: unknown;
    currentBalance: unknown;
    createdAt: Date;
  }): GiftCardData {
    return {
      id: giftCard.id,
      cardNumber: giftCard.cardNumber,
      initialAmount: Number(giftCard.initialAmount),
      currentBalance: Number(giftCard.currentBalance),
      createdAt: giftCard.createdAt,
    };
  }
}

export const giftCardService = new GiftCardService();
