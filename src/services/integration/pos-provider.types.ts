import type { OrderMode, DeliveryAddress, FulfillmentStatus, ItemTaxInfo } from "@/types";

/**
 * POS Provider interface — abstraction for multi-POS extensibility.
 *
 * Each concrete provider (Square, Toast, Clover, …) implements this
 * interface and registers itself via PosProviderRegistry at startup.
 */
export interface PosProvider {
  /** Provider type identifier, e.g. "POS_SQUARE", "POS_TOAST". */
  readonly type: string;

  /** Pull catalog from the POS system and sync it locally. */
  syncCatalog(
    tenantId: string,
    merchantId: string
  ): Promise<CatalogSyncResult>;

  /** Push a new order to the POS system. */
  pushOrder(
    tenantId: string,
    merchantId: string,
    input: PosOrderPushInput
  ): Promise<PosOrderPushResult>;

  /** Update the fulfillment status of an existing order on the POS. */
  updateFulfillment(
    tenantId: string,
    merchantId: string,
    orderId: string,
    status: string
  ): Promise<void>;

  /** Cancel an existing order on the POS. */
  cancelOrder(
    tenantId: string,
    merchantId: string,
    orderId: string,
    reason?: string
  ): Promise<void>;

  /**
   * Map an external POS fulfillment status to the internal FulfillmentStatus.
   * Returns `null` when the external status has no meaningful internal equivalent.
   */
  mapToInternalStatus(externalStatus: string): FulfillmentStatus | null;

  /**
   * Map an internal FulfillmentStatus to the external POS status string.
   * Returns `null` when there is no external equivalent.
   */
  mapToExternalStatus(internalStatus: FulfillmentStatus): string | null;
}

// ==================== Catalog Sync ====================

export interface CatalogSyncResult {
  objectsSynced: number;
  objectsMapped: number;
}

// ==================== Order Push ====================

export interface PosOrderPushInput {
  orderId: string;
  orderNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail?: string;
  orderMode: OrderMode;
  deliveryAddress?: DeliveryAddress | null;
  items: PosOrderPushItem[];
  totalAmount: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  discount: number;
  notes?: string;
}

export interface PosOrderPushItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: PosOrderPushModifier[];
  specialInstructions?: string;
  taxes?: ItemTaxInfo[];
}

export interface PosOrderPushModifier {
  modifierId: string;
  groupName: string;
  modifierName: string;
  price: number;
  quantity: number;
}

export interface PosOrderPushResult {
  externalOrderId: string;
  externalVersion?: number;
}
