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
  /** Current balance across all cards */
  activeBalance: number;
}

/**
 * Gift card data returned from service
 */
export interface GiftCardData {
  id: string;
  cardNumber: string;
  initialAmount: number;
  currentBalance: number;
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
  error?: "not_found" | "no_balance" | "invalid_format";
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
 * Create gift card input
 */
export interface CreateGiftCardInput {
  purchaseOrderId: string;
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
