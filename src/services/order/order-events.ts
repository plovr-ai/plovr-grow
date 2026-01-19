// ==================== Order Events ====================
// Simple event emitter for order lifecycle events.
// Can be extended to integrate with external services (webhooks, notifications, etc.)

import type { OrderItemData, OrderType, OrderStatus } from "@/types";

export interface OrderCreatedEvent {
  orderId: string;
  orderNumber: string;
  merchantId: string;
  tenantId: string;
  status: "pending";
  timestamp: Date;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  totalAmount: number;
  items: OrderItemData[];
}

export interface OrderStatusChangedEvent {
  orderId: string;
  orderNumber: string;
  merchantId: string;
  tenantId: string;
  status: OrderStatus;
  previousStatus: OrderStatus;
  timestamp: Date;
  cancelReason?: string;
}

type OrderEventMap = {
  "order.created": OrderCreatedEvent;
  "order.confirmed": OrderStatusChangedEvent;
  "order.preparing": OrderStatusChangedEvent;
  "order.ready": OrderStatusChangedEvent;
  "order.completed": OrderStatusChangedEvent;
  "order.cancelled": OrderStatusChangedEvent;
};

type EventListener<T> = (event: T) => void;

class OrderEventEmitter {
  private listeners: Map<string, Set<EventListener<unknown>>> = new Map();

  on<K extends keyof OrderEventMap>(
    event: K,
    listener: EventListener<OrderEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener<unknown>);

    // Return unsubscribe function
    return () => {
      this.off(event, listener);
    };
  }

  off<K extends keyof OrderEventMap>(
    event: K,
    listener: EventListener<OrderEventMap[K]>
  ): void {
    this.listeners.get(event)?.delete(listener as EventListener<unknown>);
  }

  emit<K extends keyof OrderEventMap>(event: K, data: OrderEventMap[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener(data));
    }

    // Log event for debugging (can be removed in production)
    if (process.env.NODE_ENV === "development") {
      console.log(`[OrderEvent] ${event}:`, {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        status: data.status,
      });
    }
  }
}

export const orderEventEmitter = new OrderEventEmitter();
