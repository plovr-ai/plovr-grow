import { orderEventEmitter } from "@/services/order/order-events";
import { loyaltyService } from "./loyalty.service";
import type { OrderPaidEvent } from "@/services/order/order-events.types";

let isRegistered = false;

/**
 * Register loyalty event handlers for order events
 */
export function registerLoyaltyEventHandlers(): void {
  if (isRegistered) {
    return;
  }

  // Listen to order.paid events (when order payment is completed)
  orderEventEmitter.on("order.paid", handleOrderPaid);

  isRegistered = true;
  console.log("[Loyalty] Event handlers registered");
}

/**
 * Handle order paid event - awards loyalty points when payment is completed
 */
async function handleOrderPaid(event: OrderPaidEvent): Promise<void> {
  try {
    console.log("[Loyalty] Processing order paid event:", {
      orderId: event.orderId,
      orderNumber: event.orderNumber,
      customerPhone: event.customerPhone,
      totalAmount: event.totalAmount,
    });

    // Skip if required fields are missing
    if (!event.customerPhone || event.totalAmount === undefined) {
      console.log("[Loyalty] Skipping - missing required fields (customerPhone or totalAmount)");
      return;
    }

    const result = await loyaltyService.processOrderCompletion(
      event.tenantId,
      event.orderId,
      {
        merchantId: event.merchantId,
        customerPhone: event.customerPhone,
        customerFirstName: event.customerFirstName,
        customerLastName: event.customerLastName,
        customerEmail: event.customerEmail,
        totalAmount: event.totalAmount,
        giftCardPayment: event.giftCardPayment,
        loyaltyMemberId: event.loyaltyMemberId,
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
