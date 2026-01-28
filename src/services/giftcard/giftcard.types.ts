import type { GiftCardStatus, GiftCardTransactionType } from "@/repositories/giftcard.repository";

/**
 * Gift card statistics for Dashboard overview
 */
export interface GiftCardStats {
  /** Total number of gift cards issued */
  totalCards: number;
  /** Total initial value of all gift cards sold */
  totalValueSold: number;
  /** Total amount redeemed across all cards */
  totalRedeemed: number;
  /** Current active balance across all active cards */
  activeBalance: number;
  /** Count of active gift cards */
  activeCards: number;
  /** Count of depleted gift cards */
  depletedCards: number;
  /** Count of disabled gift cards */
  disabledCards: number;
}

/**
 * Gift card data returned from service
 */
export interface GiftCardData {
  id: string;
  cardNumber: string;
  initialAmount: number;
  currentBalance: number;
  status: GiftCardStatus;
  createdAt: Date;
}

/**
 * Gift card with purchase order info
 */
export interface GiftCardWithOrder extends GiftCardData {
  purchaseOrder: {
    id: string;
    orderNumber: string;
    customerFirstName: string;
    customerLastName: string;
    customerEmail: string | null;
  };
}

/**
 * Gift card validation result
 */
export interface GiftCardValidationResult {
  valid: boolean;
  giftCard?: GiftCardData;
  error?: "not_found" | "depleted" | "disabled" | "invalid_format";
}

/**
 * Gift card redemption result
 */
export interface GiftCardRedemptionResult {
  success: boolean;
  amountRedeemed: number;
  remainingBalance: number;
  transactionId: string;
}

/**
 * Gift card transaction data
 */
export interface GiftCardTransactionData {
  id: string;
  giftCardId: string;
  orderId: string | null;
  type: GiftCardTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
  order?: {
    id: string;
    orderNumber: string;
  } | null;
}

/**
 * Create gift card input
 */
export interface CreateGiftCardInput {
  purchaseOrderId: string;
  amount: number;
}

/**
 * Redeem gift card input
 */
export interface RedeemGiftCardInput {
  giftCardId: string;
  orderId: string;
  amount: number;
}

/**
 * Paginated gift cards response
 */
export interface PaginatedGiftCards {
  items: GiftCardWithOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
