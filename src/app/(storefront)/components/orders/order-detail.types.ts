import type { OrderStatus, OrderType, OrderItemData, DeliveryAddress } from "@/types";

export interface TimelineEvent {
  status: OrderStatus;
  timestamp: Date | string;
}

export interface OrderDetailData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  items: OrderItemData[];
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
  completedAt: Date | string | null;
  cancelledAt: Date | string | null;
  cancelReason: string | null;
  timeline: TimelineEvent[];
  merchant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  pointsEarned?: number; // Points earned from this order (if loyalty member)
}
