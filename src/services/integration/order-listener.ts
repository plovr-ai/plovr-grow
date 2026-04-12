import { orderEventEmitter } from "@/services/order/order-events";
import { integrationRepository } from "@/repositories/integration.repository";
import { posProviderRegistry } from "./pos-provider-registry";
import type {
  OrderPaidEvent,
  FulfillmentStatusChangedEvent,
  OrderCancelledEvent,
} from "@/services/order/order-events.types";
import type { PosOrderPushItem } from "./pos-provider.types";
import type {
  DeliveryAddress,
  OrderItemData,
  OrderMode,
  SalesChannel,
} from "@/types";

let isRegistered = false;

/**
 * Register POS-agnostic order push event handlers.
 * Listens to order events and pushes changes to the active POS provider.
 *
 * - order.paid -> pushOrder (push to POS after payment)
 * - order.fulfillment.* -> updateFulfillment
 * - order.cancelled -> cancelOrder
 */
export function registerOrderEventHandlers(): void {
  if (isRegistered) {
    return;
  }

  orderEventEmitter.on("order.paid", handleOrderPaid);
  orderEventEmitter.on("order.fulfillment.confirmed", handleFulfillmentChanged);
  orderEventEmitter.on("order.fulfillment.preparing", handleFulfillmentChanged);
  orderEventEmitter.on("order.fulfillment.ready", handleFulfillmentChanged);
  orderEventEmitter.on("order.fulfillment.fulfilled", handleFulfillmentChanged);
  orderEventEmitter.on("order.cancelled", handleOrderCancelled);

  isRegistered = true;
  console.log("[POS] Order push event handlers registered");
}

/**
 * Handle order.paid event.
 * Creates the order on the active POS provider when payment is completed.
 */
async function handleOrderPaid(event: OrderPaidEvent): Promise<void> {
  try {
    // Loop prevention: events originating from a Square webhook must not be
    // pushed back to Square, otherwise we'd create an infinite cycle.
    if (event.source === "square_webhook") return;

    // Gift card orders are virtual products with no merchantId — they must
    // never be pushed to a POS (no location, no catalog mapping).
    if (!event.merchantId) {
      return;
    }

    const orderForPush = await getOrderForPush(event.tenantId, event.orderId);
    if (!orderForPush) {
      return;
    }

    if (orderForPush.salesChannel === "giftcard") {
      return;
    }

    // Check if merchant has an active POS connection
    const connection = await findActivePosConnection(
      event.tenantId,
      event.merchantId
    );
    if (!connection) {
      return;
    }

    const provider = posProviderRegistry.getProvider(connection.type);

    const orderItems = orderForPush.items;
    if (orderItems.length === 0) {
      console.log("[POS] Skipping order push - no items found:", {
        orderId: event.orderId,
      });
      return;
    }

    const pushItems: PosOrderPushItem[] = orderItems.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      selectedModifiers: item.selectedModifiers.map((mod) => ({
        modifierId: mod.modifierId,
        modifierName: mod.modifierName,
        price: mod.price,
        quantity: mod.quantity,
      })),
      specialInstructions: item.specialInstructions,
    }));

    const result = await provider.pushOrder(
      event.tenantId,
      event.merchantId,
      {
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        customerFirstName: event.customerFirstName ?? "",
        customerLastName: event.customerLastName ?? "",
        customerPhone: event.customerPhone ?? "",
        customerEmail: event.customerEmail,
        orderMode: orderForPush.orderMode,
        deliveryAddress: orderForPush.deliveryAddress,
        items: pushItems,
        totalAmount: event.totalAmount ?? 0,
        notes: orderForPush.notes ?? undefined,
      }
    );

    console.log("[POS] Order pushed successfully:", {
      orderId: event.orderId,
      externalOrderId: result.externalOrderId,
    });
  } catch (error) {
    console.error("[POS] Failed to push order:", {
      orderId: event.orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Don't throw - we don't want to break the order flow
  }
}

/**
 * Handle fulfillment status change events.
 * Updates the fulfillment state on the active POS provider.
 */
async function handleFulfillmentChanged(
  event: FulfillmentStatusChangedEvent
): Promise<void> {
  try {
    if (event.source === "square_webhook") return;

    const connection = await findActivePosConnection(
      event.tenantId,
      event.merchantId
    );
    if (!connection) {
      return;
    }

    const provider = posProviderRegistry.getProvider(connection.type);

    await provider.updateFulfillment(
      event.tenantId,
      event.merchantId,
      event.orderId,
      event.fulfillmentStatus
    );

    console.log("[POS] Order status updated:", {
      orderId: event.orderId,
      fulfillmentStatus: event.fulfillmentStatus,
    });
  } catch (error) {
    console.error("[POS] Failed to update order status:", {
      orderId: event.orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle order.cancelled event.
 * Cancels the order on the active POS provider.
 */
async function handleOrderCancelled(
  event: OrderCancelledEvent
): Promise<void> {
  try {
    if (event.source === "square_webhook") return;

    const connection = await findActivePosConnection(
      event.tenantId,
      event.merchantId
    );
    if (!connection) {
      return;
    }

    const provider = posProviderRegistry.getProvider(connection.type);

    await provider.cancelOrder(
      event.tenantId,
      event.merchantId,
      event.orderId,
      event.cancelReason
    );

    console.log("[POS] Order cancelled:", {
      orderId: event.orderId,
    });
  } catch (error) {
    console.error("[POS] Failed to cancel order:", {
      orderId: event.orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Find an active POS connection for a merchant (any POS provider).
 */
async function findActivePosConnection(
  tenantId: string,
  merchantId: string
): Promise<{ type: string } | null> {
  try {
    const connection = await integrationRepository.getActivePosConnection(
      tenantId,
      merchantId
    );
    return connection;
  } catch {
    return null;
  }
}

/**
 * Fetch the minimum order context needed to decide whether to push to the POS.
 * Uses dynamic import to avoid circular dependency.
 */
async function getOrderForPush(
  tenantId: string,
  orderId: string
): Promise<{
  items: OrderItemData[];
  salesChannel: SalesChannel;
  orderMode: OrderMode;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
} | null> {
  try {
    const { orderService } = await import("@/services/order/order.service");
    const order = await orderService.getOrder(tenantId, orderId);
    if (!order) return null;
    return {
      items: order.items as unknown as OrderItemData[],
      salesChannel: order.salesChannel as SalesChannel,
      orderMode: order.orderMode as OrderMode,
      deliveryAddress:
        (order.deliveryAddress as unknown as DeliveryAddress | null) ?? null,
      notes: order.notes ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Unregister event handlers (for testing).
 */
export function unregisterOrderEventHandlers(): void {
  isRegistered = false;
}
