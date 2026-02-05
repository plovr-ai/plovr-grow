import type { OrderStatus, OrderMode, OrderItemData, SalesChannel } from "@/types";

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
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  orderMode: OrderMode;
  salesChannel: SalesChannel;
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
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  totalAmount: number;
}

export type OrderEventHandler<T extends OrderEventPayload = OrderEventPayload> = (
  event: T
) => void | Promise<void>;
