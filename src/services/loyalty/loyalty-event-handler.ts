import { orderEventEmitter } from "@/services/order/order-events";
import { loyaltyService } from "./loyalty.service";
import type { OrderCompletedEvent } from "@/services/order/order-events.types";

let isRegistered = false;

/**
 * Register loyalty event handlers for order events
 */
export function registerLoyaltyEventHandlers(): void {
  if (isRegistered) {
    return;
  }

  // Listen to order.completed events
  orderEventEmitter.on("order.completed", handleOrderCompleted);

  isRegistered = true;
  console.log("[Loyalty] Event handlers registered");
}

/**
 * Handle order completion event
 */
async function handleOrderCompleted(event: OrderCompletedEvent): Promise<void> {
  try {
    console.log("[Loyalty] Processing order completion:", {
      orderId: event.orderId,
      orderNumber: event.orderNumber,
      customerPhone: event.customerPhone,
      totalAmount: event.totalAmount,
    });

    const result = await loyaltyService.processOrderCompletion(
      event.tenantId,
      event.companyId,
      event.orderId,
      {
        merchantId: event.merchantId,
        customerPhone: event.customerPhone,
        customerFirstName: event.customerFirstName,
        customerLastName: event.customerLastName,
        customerEmail: event.customerEmail,
        totalAmount: event.totalAmount,
      }
    );

    if (result) {
      console.log("[Loyalty] Points awarded:", {
        orderId: event.orderId,
        pointsEarned: result.pointsEarned,
        newBalance: result.newBalance,
      });
    } else {
      console.log("[Loyalty] No points awarded (loyalty disabled or already processed):", {
        orderId: event.orderId,
      });
    }
  } catch (error) {
    console.error("[Loyalty] Failed to process order completion:", error);
    // Don't throw - we don't want to break the order flow
  }
}

/**
 * Unregister event handlers (for testing)
 */
export function unregisterLoyaltyEventHandlers(): void {
  // Note: The current orderEventEmitter doesn't support removing specific handlers
  // This is a placeholder for future implementation
  isRegistered = false;
}
