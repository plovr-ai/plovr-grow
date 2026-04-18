import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";
import { giftCardRepository } from "@/repositories/giftcard.repository";
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

/**
 * Convert database model to GiftCardData
 */
function toGiftCardData(giftCard: {
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

/**
 * Create a new gift card after purchase order is created
 */
async function createGiftCard(
  tenantId: string,
  input: CreateGiftCardInput
): Promise<GiftCardData> {
  // Generate a unique card number
  let cardNumber = generateGiftCardNumber();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure uniqueness
  while (await giftCardRepository.cardNumberExists(cardNumber)) {
    cardNumber = generateGiftCardNumber();
    attempts++;
    if (attempts >= maxAttempts) {
      throw new AppError(ErrorCodes.GIFTCARD_GENERATION_FAILED, undefined, 500);
    }
  }

  // Create the gift card
  const giftCard = await giftCardRepository.create(tenantId, {
    cardNumber,
    initialAmount: input.amount,
    purchaseOrderId: input.purchaseOrderId,
  });

  // Create initial "purchase" transaction
  await giftCardRepository.createTransaction(tenantId, {
    giftCardId: giftCard.id,
    orderId: input.purchaseOrderId,
    type: "purchase",
    amount: input.amount,
    balanceBefore: 0,
    balanceAfter: input.amount,
  });

  return toGiftCardData(giftCard);
}

/**
 * Validate a gift card by card number
 */
async function validateGiftCard(
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
  const giftCard = await giftCardRepository.getByCardNumber(
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
    giftCard: toGiftCardData(giftCard),
  };
}

/**
 * Redeem a gift card for an order
 */
async function redeemGiftCard(
  tenantId: string,
  giftCardId: string,
  orderId: string,
  amount: number,
  tx?: DbClient
): Promise<GiftCardRedemptionResult> {
  // Get the gift card
  const giftCard = tx
    ? await giftCardRepository.getByIdForUpdate(tenantId, giftCardId, tx)
    : await giftCardRepository.getById(tenantId, giftCardId);

  if (!giftCard) {
    throw new AppError(ErrorCodes.GIFTCARD_NOT_FOUND, undefined, 404);
  }

  const currentBalance = Number(giftCard.currentBalance);

  if (currentBalance <= 0) {
    throw new AppError(ErrorCodes.GIFTCARD_NO_BALANCE, undefined, 400);
  }

  // Calculate actual redemption amount (can't redeem more than balance)
  const amountToRedeem = Math.min(amount, currentBalance);
  const newBalance = currentBalance - amountToRedeem;

  // Update balance
  await giftCardRepository.updateBalance(tenantId, giftCardId, newBalance, tx);

  // Create redemption transaction
  const transaction = await giftCardRepository.createTransaction(tenantId, {
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
async function getBalance(
  tenantId: string,
  cardNumber: string
): Promise<number | null> {
  const normalizedNumber = normalizeGiftCardNumber(cardNumber);
  const formattedNumber = formatGiftCardNumber(normalizedNumber);

  const giftCard = await giftCardRepository.getByCardNumber(
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
async function getGiftCard(tenantId: string, giftCardId: string): Promise<GiftCardData | null> {
  const giftCard = await giftCardRepository.getById(tenantId, giftCardId);

  if (!giftCard) {
    return null;
  }

  return toGiftCardData(giftCard);
}

/**
 * Get gift card by purchase order ID
 */
async function getGiftCardByOrderId(
  tenantId: string,
  purchaseOrderId: string
): Promise<GiftCardData | null> {
  const giftCard = await giftCardRepository.getByPurchaseOrderId(
    tenantId,
    purchaseOrderId
  );

  if (!giftCard) {
    return null;
  }

  return toGiftCardData(giftCard);
}

/**
 * Get gift card statistics for Dashboard overview
 */
async function getTenantGiftCardStats(
  tenantId: string,
  options: {
    dateFrom?: Date;
    dateTo?: Date;
  } = {}
): Promise<GiftCardStats> {
  return giftCardRepository.getStatsByTenant(tenantId, options);
}

/**
 * Get gift cards for a company (for Dashboard)
 */
async function getTenantGiftCards(
  tenantId: string,
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}
): Promise<PaginatedGiftCards> {
  const result = await giftCardRepository.getByTenant(tenantId, options);

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

export const giftCardService = {
  createGiftCard,
  validateGiftCard,
  redeemGiftCard,
  getBalance,
  getGiftCard,
  getGiftCardByOrderId,
  getTenantGiftCardStats,
  getTenantGiftCards,
};
