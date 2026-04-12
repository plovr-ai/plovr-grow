import type {
  OrderMode,
  OrderStatus,
  FulfillmentStatus,
  OrderItemData,
  DeliveryAddress,
  TaxBreakdownItem,
  SalesChannel,
  PaymentType,
} from "@/types";
import type { FeeBreakdownItem } from "@/lib/pricing";

// Generic order data type that works with both mock and Prisma orders
export interface OrderData {
  id: string;
  tenantId: string;
  merchantId: string | null;
  orderNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string | null;
  orderMode: string;
  salesChannel: string;
  paymentType: string;
  status: string;                    // Payment status
  fulfillmentStatus: string;         // Fulfillment status
  items: OrderItemData[];
  subtotal: number | unknown;
  taxAmount: number | unknown;
  tipAmount: number | unknown;
  deliveryFee: number | unknown;
  discount: number | unknown;
  giftCardPayment: number | unknown;
  cashPayment: number | unknown;
  totalAmount: number | unknown;
  notes: string | null;
  deliveryAddress: DeliveryAddress | unknown | null;
  scheduledAt: Date | null;
  paidAt: Date | null;               // When payment completed
  cancelledAt: Date | null;
  cancelReason: string | null;
  paymentFailedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Base order input fields shared by both merchant and company orders
interface BaseOrderInput {
  loyaltyMemberId?: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail?: string;
  items: OrderItemData[];
  notes?: string;
  giftCardPayment?: number; // Amount paid with gift card
}

// Input for creating a merchant order (regular orders with menu items)
export interface CreateMerchantOrderInput extends BaseOrderInput {
  merchantId: string; // Required for merchant orders
  orderMode: OrderMode;
  salesChannel?: Exclude<SalesChannel, "giftcard">; // Defaults to "online_order"
  paymentType?: PaymentType; // Defaults to "online"
  deliveryAddress?: DeliveryAddress;
  scheduledAt?: Date;
  tipAmount?: number;
  discountCode?: string;
}

// Input for creating a gift card order (virtual products, not tied to a merchant).
// salesChannel is always "giftcard" for now.
export type CreateGiftCardOrderInput = BaseOrderInput;

export interface OrderCalculation {
  subtotal: number;
  taxAmount: number;
  taxBreakdown: TaxBreakdownItem[];
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
  tipAmount: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
}

export interface TenantOrderListOptions {
  merchantId?: string;
  status?: OrderStatus;
  fulfillmentStatus?: FulfillmentStatus;
  orderMode?: OrderMode;
  salesChannel?: SalesChannel;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "createdAt" | "updatedAt" | "totalAmount";
  orderDirection?: "asc" | "desc";
}

// Timeline types for Order Detail page
export type TimelineEventType = "payment" | "fulfillment";

export interface TimelineEvent {
  type: TimelineEventType;
  status: OrderStatus | FulfillmentStatus;
  timestamp: Date;
}

// Order with timeline for Order Detail page (works with both mock and Prisma)
export interface OrderWithTimeline extends OrderData {
  timeline: TimelineEvent[];
  merchant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  } | null;
  pointsEarned?: number; // Points earned from this order (if loyalty member)
}
