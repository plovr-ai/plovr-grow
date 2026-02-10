import type {
  OrderEventType,
  OrderCreatedEvent,
  PaymentStatusChangedEvent,
  FulfillmentStatusChangedEvent,
  OrderPaidEvent,
  OrderCancelledEvent,
  OrderEventHandler,
  OrderEventPayload,
} from "./order-events.types";

type EventMap = {
  // Payment events
  "order.created": OrderCreatedEvent;
  "order.paid": OrderPaidEvent;
  "order.partial_paid": PaymentStatusChangedEvent;
  "order.cancelled": OrderCancelledEvent;
  // Fulfillment events
  "order.fulfillment.confirmed": FulfillmentStatusChangedEvent;
  "order.fulfillment.preparing": FulfillmentStatusChangedEvent;
  "order.fulfillment.ready": FulfillmentStatusChangedEvent;
  "order.fulfillment.fulfilled": FulfillmentStatusChangedEvent;
};

/**
 * Simple in-process event emitter for order events
 *
 * This provides a foundation for real-time notifications.
 * Can be extended to:
 * - Server-Sent Events (SSE) for Dashboard
 * - WebSocket for bi-directional communication
 * - External message queue (Redis Pub/Sub, AWS SNS) for scaling
 */
class OrderEventEmitter {
  private handlers: Map<OrderEventType, Set<OrderEventHandler>> = new Map();

  /**
   * Subscribe to an order event
   */
  on<T extends OrderEventType>(
    event: T,
    handler: (payload: EventMap[T]) => void | Promise<void>
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as OrderEventHandler);

    return () => {
      this.handlers.get(event)?.delete(handler as OrderEventHandler);
    };
  }

  /**
   * Subscribe to all order events
   */
  onAny(handler: OrderEventHandler): () => void {
    const events: OrderEventType[] = [
      // Payment events
      "order.created",
      "order.paid",
      "order.partial_paid",
      "order.cancelled",
      // Fulfillment events
      "order.fulfillment.confirmed",
      "order.fulfillment.preparing",
      "order.fulfillment.ready",
      "order.fulfillment.fulfilled",
    ];

    const unsubscribers = events.map((event) => this.on(event, handler));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Emit an order event
   */
  emit<T extends OrderEventType>(event: T, payload: EventMap[T]): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    handlers.forEach((handler) => {
      // Use setTimeout to ensure async execution and error isolation
      setTimeout(() => {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error(`Error in order event handler for ${event}:`, error);
            });
          }
        } catch (error) {
          console.error(`Error in order event handler for ${event}:`, error);
        }
      }, 0);
    });
  }

  /**
   * Get subscriber count for an event
   */
  listenerCount(event: OrderEventType): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

export const orderEventEmitter = new OrderEventEmitter();

if (process.env.NODE_ENV === "development") {
  orderEventEmitter.onAny((event: OrderEventPayload) => {
    console.log(`[OrderEvent]`, {
      orderId: event.orderId,
      orderNumber: event.orderNumber,
      merchantId: event.merchantId,
    });
  });
}

// Register loyalty event handlers to process order completions
// Use dynamic import to avoid circular dependency
import("@/services/loyalty/loyalty-event-handler").then(({ registerLoyaltyEventHandlers }) => {
  registerLoyaltyEventHandlers();
});
