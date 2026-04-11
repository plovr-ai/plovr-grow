import { orderEventEmitter } from "@/services/order/order-events";
import { integrationRepository } from "@/repositories/integration.repository";
import { squareOrderService } from "./square-order.service";
import type { OrderPaidEvent, FulfillmentStatusChangedEvent, OrderCancelledEvent } from "@/services/order/order-events.types";
import type { SquareOrderPushItem } from "./square.types";
import type {
  DeliveryAddress,
  OrderItemData,
  OrderMode,
  SalesChannel,
} from "@/types";

const INTEGRATION_TYPE = "POS_SQUARE";

let isRegistered = false;

/**
 * Register Square order push event handlers.
 * Listens to order events and pushes changes to Square POS.
 *
 * - order.paid -> createOrder (push to Square after payment)
 * - order.fulfillment.* -> updateOrderStatus
 * - order.cancelled -> cancelOrder
 */
export function registerSquareOrderEventHandlers(): void {
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
  console.log("[Square] Order push event handlers registered");
}

/**
 * Handle order.paid event.
 * Creates the order on Square POS when payment is completed.
 */
async function handleOrderPaid(event: OrderPaidEvent): Promise<void> {
  try {
    // Gift card orders are virtual products with no merchantId — they must
    // never be pushed to Square POS (no location, no catalog mapping).
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

    // Check if merchant has an active Square connection
    const hasConnection = await checkSquareConnection(
      event.tenantId,
      event.merchantId
    );
    if (!hasConnection) {
      return;
    }

    const orderItems = orderForPush.items;
    if (orderItems.length === 0) {
      console.log("[Square] Skipping order push - no items found:", {
        orderId: event.orderId,
      });
      return;
    }

    const pushItems: SquareOrderPushItem[] = orderItems.map((item) => ({
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

    const result = await squareOrderService.createOrder(
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
      }
    );

    console.log("[Square] Order pushed successfully:", {
      orderId: event.orderId,
      squareOrderId: result.squareOrderId,
    });
  } catch (error) {
    console.error("[Square] Failed to push order:", {
      orderId: event.orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Don't throw - we don't want to break the order flow
  }
}

/**
 * Handle fulfillment status change events.
 * Updates the fulfillment state on Square.
 */
async function handleFulfillmentChanged(
  event: FulfillmentStatusChangedEvent
): Promise<void> {
  try {
    const hasConnection = await checkSquareConnection(
      event.tenantId,
      event.merchantId
    );
    if (!hasConnection) {
      return;
    }

    await squareOrderService.updateOrderStatus(
      event.tenantId,
      event.merchantId,
      event.orderId,
      event.fulfillmentStatus
    );

    console.log("[Square] Order status updated:", {
      orderId: event.orderId,
      fulfillmentStatus: event.fulfillmentStatus,
    });
  } catch (error) {
    console.error("[Square] Failed to update order status:", {
      orderId: event.orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle order.cancelled event.
 * Cancels the order on Square.
 */
async function handleOrderCancelled(
  event: OrderCancelledEvent
): Promise<void> {
  try {
    const hasConnection = await checkSquareConnection(
      event.tenantId,
      event.merchantId
    );
    if (!hasConnection) {
      return;
    }

    await squareOrderService.cancelOrder(
      event.tenantId,
      event.merchantId,
      event.orderId,
      event.cancelReason
    );

    console.log("[Square] Order cancelled:", {
      orderId: event.orderId,
    });
  } catch (error) {
    console.error("[Square] Failed to cancel order:", {
      orderId: event.orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Check if a merchant has an active Square connection.
 */
async function checkSquareConnection(
  tenantId: string,
  merchantId: string
): Promise<boolean> {
  try {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );
    return connection !== null && connection.status === "active";
  } catch {
    return false;
  }
}

/**
 * Fetch the minimum order context needed to decide whether to push to Square.
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
    };
  } catch {
    return null;
  }
}

/**
 * Unregister event handlers (for testing).
 */
export function unregisterSquareOrderEventHandlers(): void {
  isRegistered = false;
}
