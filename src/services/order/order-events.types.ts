import type { OrderStatus, FulfillmentStatus, OrderMode, OrderItemData, SalesChannel } from "@/types";

// Payment events (user behavior)
export type PaymentEventType =
  | "order.created"
  | "order.paid"
  | "order.partial_paid"
  | "order.cancelled";

// Fulfillment events (merchant behavior)
export type FulfillmentEventType =
  | "order.fulfillment.confirmed"
  | "order.fulfillment.preparing"
  | "order.fulfillment.ready"
  | "order.fulfillment.fulfilled";

export type OrderEventType = PaymentEventType | FulfillmentEventType;

/** Where the status change originated */
export type OrderEventSource = "internal" | "square_webhook";

// Base event payload
export interface OrderEventPayload {
  orderId: string;
  orderNumber: string;
  merchantId: string;
  tenantId: string;
  timestamp: Date;
  source?: OrderEventSource;
  metadata?: Record<string, unknown>;
}

// Payment status change event
export interface PaymentStatusChangedEvent extends OrderEventPayload {
  status: OrderStatus;
  previousStatus?: OrderStatus;
  cancelReason?: string;
}

// Fulfillment status change event
export interface FulfillmentStatusChangedEvent extends OrderEventPayload {
  fulfillmentStatus: FulfillmentStatus;
  previousFulfillmentStatus?: FulfillmentStatus;
}

// Order created event
export interface OrderCreatedEvent extends OrderEventPayload {
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  orderMode: OrderMode;
  salesChannel: SalesChannel;
  totalAmount: number;
  items: OrderItemData[];
}

// Order paid event (for loyalty points, etc.)
export interface OrderPaidEvent extends PaymentStatusChangedEvent {
  customerPhone?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  totalAmount?: number;
}

// Order cancelled event
export interface OrderCancelledEvent extends PaymentStatusChangedEvent {
  cancelReason?: string;
}

export type OrderEventHandler<T extends OrderEventPayload = OrderEventPayload> = (
  event: T
) => void | Promise<void>;

// Legacy types for backward compatibility
/** @deprecated Use PaymentStatusChangedEvent instead */
export type OrderStatusChangedEvent = PaymentStatusChangedEvent;

/** @deprecated Use OrderPaidEvent instead */
export type OrderCompletedEvent = OrderPaidEvent;
