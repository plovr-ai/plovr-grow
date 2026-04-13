import type { OrderStatus, FulfillmentStatus, OrderMode, OrderItemData, DeliveryAddress } from "@/types";
import type { FeeBreakdownItem } from "@/lib/pricing";

export type TimelineEventType = "payment" | "fulfillment";

export interface TimelineEvent {
  type?: TimelineEventType;
  status: OrderStatus | FulfillmentStatus;
  timestamp: Date | string;
}

export interface OrderDetailData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  orderMode: OrderMode;
  items: OrderItemData[];
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
  discount: number;
  totalAmount: number;
  createdAt: Date | string;
  paidAt: Date | string | null;
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
