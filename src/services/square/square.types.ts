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
 *
 * Internal `confirmed` maps to Square `RESERVED` (not `PROPOSED`) so that
 * when Square echoes the state back via webhook the reverse map does not
 * collapse it into `pending`.
 */
export const FULFILLMENT_STATUS_MAP: Record<string, string> = {
  pending: "PROPOSED",
  confirmed: "RESERVED",
  preparing: "RESERVED",
  ready: "PREPARED",
  fulfilled: "COMPLETED",
} as const;

/**
 * Monotonic rank for internal fulfillment statuses. Used when applying
 * reverse-mapped Square webhook states so stale/coarse events cannot walk an
 * order back to an earlier stage.
 */
export const FULFILLMENT_STATUS_RANK: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  fulfilled: 4,
} as const;

/**
 * Square order sync record type identifier.
 */
export const SQUARE_ORDER_SYNC_TYPE = "ORDER_PUSH" as const;

// ==================== Webhook Types ====================

/**
 * Square webhook event payload (raw from Square API).
 */
export interface SquareWebhookPayload {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object?: Record<string, unknown>;
  };
}

/**
 * Webhook event status values.
 */
export const WEBHOOK_EVENT_STATUS = {
  RECEIVED: "received",
  PROCESSING: "processing",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

/**
 * Reverse fulfillment status mapping: Square FulfillmentState → internal status.
 * Used when receiving order updates from Square via webhook.
 */
export const REVERSE_FULFILLMENT_STATUS_MAP: Record<string, string> = {
  PROPOSED: "pending",
  // Square `RESERVED` covers both `confirmed` and `preparing` internally
  // because the forward map collapses them. Reverse to the narrower
  // (`confirmed`) state — the monotonic guard in handleOrderUpdate keeps a
  // real `preparing` order from being walked back, and a `confirmed` order
  // won't be spuriously advanced to `preparing` by Square's own echo.
  RESERVED: "confirmed",
  PREPARED: "ready",
  COMPLETED: "fulfilled",
} as const;

/**
 * Square webhook sync type for sync records.
 */
export const SQUARE_WEBHOOK_SYNC_TYPE = "WEBHOOK_EVENT" as const;
