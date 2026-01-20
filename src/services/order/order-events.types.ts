import type { OrderStatus, OrderType, OrderItemData } from "@/types";

export type OrderEventType =
  | "order.created"
  | "order.confirmed"
  | "order.preparing"
  | "order.ready"
  | "order.completed"
  | "order.cancelled";

export interface OrderEventPayload {
  orderId: string;
  orderNumber: string;
  merchantId: string;
  tenantId: string;
  status: OrderStatus;
  previousStatus?: OrderStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface OrderCreatedEvent extends OrderEventPayload {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  totalAmount: number;
  items: OrderItemData[];
}

export interface OrderStatusChangedEvent extends OrderEventPayload {
  previousStatus: OrderStatus;
  cancelReason?: string;
}

// Extended event for order completion with customer and amount info
export interface OrderCompletedEvent extends OrderStatusChangedEvent {
  companyId: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  totalAmount: number;
}

export type OrderEventHandler<T extends OrderEventPayload = OrderEventPayload> = (
  event: T
) => void | Promise<void>;
