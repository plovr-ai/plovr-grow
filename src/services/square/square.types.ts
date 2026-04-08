export interface SquareTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  merchantId: string;
}

export interface SquareLocation {
  id: string;
  name: string;
  address?: {
    addressLine1?: string;
    locality?: string;
    administrativeDistrictLevel1?: string;
    postalCode?: string;
    country?: string;
  };
  status: string;
}

export interface OAuthState {
  tenantId: string;
  merchantId: string;
  returnUrl: string;
}

export interface SquareConnectionStatus {
  connected: boolean;
  externalAccountId?: string;
  externalLocationId?: string;
  tokenExpiresAt?: Date;
}

// ==================== Order Push Types ====================

/**
 * Input for pushing an order to Square.
 * Contains the internal order data needed to build a Square order.
 */
export interface SquareOrderPushInput {
  orderId: string;
  orderNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail?: string;
  orderMode: string;
  items: SquareOrderPushItem[];
  totalAmount: number;
  notes?: string;
}

export interface SquareOrderPushItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: SquareOrderPushModifier[];
  specialInstructions?: string;
}

export interface SquareOrderPushModifier {
  modifierId: string;
  modifierName: string;
  price: number;
  quantity: number;
}

/**
 * Result of pushing an order to Square.
 */
export interface SquareOrderPushResult {
  squareOrderId: string;
  squareVersion: number;
}

/**
 * Fulfillment status mapping from internal status to Square FulfillmentState.
 */
export const FULFILLMENT_STATUS_MAP: Record<string, string> = {
  pending: "PROPOSED",
  confirmed: "PROPOSED",
  preparing: "RESERVED",
  ready: "PREPARED",
  fulfilled: "COMPLETED",
} as const;

/**
 * Square order sync record type identifier.
 */
export const SQUARE_ORDER_SYNC_TYPE = "ORDER_PUSH" as const;
