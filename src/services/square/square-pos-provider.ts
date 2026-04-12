import type { FulfillmentStatus } from "@/types";
import type {
  PosProvider,
  PosOrderPushInput,
  PosOrderPushResult,
  CatalogSyncResult,
} from "@/services/integration/pos-provider.types";
import { squareService } from "./square.service";
import { squareOrderService } from "./square-order.service";
import type { SquareOrderPushItem } from "./square.types";
import {
  FULFILLMENT_STATUS_MAP,
  REVERSE_FULFILLMENT_STATUS_MAP,
} from "./square.types";

/**
 * Square POS provider — thin adapter that delegates to the existing
 * Square services without modifying them internally.
 */
class SquarePosProvider implements PosProvider {
  readonly type = "POS_SQUARE";

  async syncCatalog(
    tenantId: string,
    merchantId: string
  ): Promise<CatalogSyncResult> {
    return squareService.syncCatalog(tenantId, merchantId);
  }

  async pushOrder(
    tenantId: string,
    merchantId: string,
    input: PosOrderPushInput
  ): Promise<PosOrderPushResult> {
    const squareItems: SquareOrderPushItem[] = input.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      selectedModifiers: item.selectedModifiers.map((mod) => ({
        modifierId: mod.modifierId,
        groupName: mod.groupName,
        modifierName: mod.modifierName,
        price: mod.price,
        quantity: mod.quantity,
      })),
      specialInstructions: item.specialInstructions,
      taxes: item.taxes,
    }));

    const result = await squareOrderService.createOrder(tenantId, merchantId, {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      orderMode: input.orderMode,
      deliveryAddress: input.deliveryAddress,
      items: squareItems,
      totalAmount: input.totalAmount,
      taxAmount: input.taxAmount,
      tipAmount: input.tipAmount,
      deliveryFee: input.deliveryFee,
      discount: input.discount,
      notes: input.notes,
      scheduledAt: input.scheduledAt,
    });

    return {
      externalOrderId: result.squareOrderId,
      externalVersion: result.squareVersion,
    };
  }

  async updateFulfillment(
    tenantId: string,
    merchantId: string,
    orderId: string,
    status: string
  ): Promise<void> {
    await squareOrderService.updateOrderStatus(
      tenantId,
      merchantId,
      orderId,
      status
    );
  }

  async cancelOrder(
    tenantId: string,
    merchantId: string,
    orderId: string,
    reason?: string
  ): Promise<void> {
    await squareOrderService.cancelOrder(
      tenantId,
      merchantId,
      orderId,
      reason
    );
  }

  mapToInternalStatus(externalStatus: string): FulfillmentStatus | null {
    if (externalStatus === "CANCELED" || externalStatus === "FAILED") {
      return "canceled";
    }
    return (REVERSE_FULFILLMENT_STATUS_MAP[externalStatus] as FulfillmentStatus) ?? null;
  }

  mapToExternalStatus(internalStatus: FulfillmentStatus): string | null {
    if (internalStatus === "canceled") {
      return "CANCELED";
    }
    return FULFILLMENT_STATUS_MAP[internalStatus] ?? null;
  }
}

export const squarePosProvider = new SquarePosProvider();
