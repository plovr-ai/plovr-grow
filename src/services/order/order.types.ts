import type { Order } from "@prisma/client";
import type {
  OrderMode,
  OrderStatus,
  FulfillmentStatus,
  OrderItemData,
  DeliveryAddress,
  TaxBreakdownItem,
  SalesChannel,
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
  status: string;                    // Payment status
  fulfillmentStatus: string;         // Fulfillment status
  items: OrderItemData[] | unknown;
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
  confirmedAt: Date | null;          // When merchant confirmed
  preparingAt: Date | null;          // When started preparing
  readyAt: Date | null;              // When ready for pickup/delivery
  fulfilledAt: Date | null;          // When fulfilled
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  companyId: string;
  merchantId?: string; // Optional for Company-level orders (e.g., giftcards)
  loyaltyMemberId?: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail?: string;
  orderMode: OrderMode;
  salesChannel?: SalesChannel;
  items: OrderItemData[];
  notes?: string;
  deliveryAddress?: DeliveryAddress;
  scheduledAt?: Date;
  tipAmount?: number;
  discountCode?: string;
  giftCardPayment?: number; // Amount paid with gift card
}

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

export interface OrderWithCalculation extends Order {
  calculation: OrderCalculation;
}

// Update payment status (user behavior)
export interface UpdateOrderStatusInput {
  status: OrderStatus;
  cancelReason?: string;
}

// Update fulfillment status (merchant behavior)
export interface UpdateFulfillmentStatusInput {
  fulfillmentStatus: FulfillmentStatus;
}

export interface OrderListOptions {
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

export interface MerchantOrderListOptions {
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

export interface CompanyOrderListOptions {
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

export interface OrderWithMerchant extends Order {
  merchant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  } | null;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  ordersByFulfillmentStatus: Partial<Record<FulfillmentStatus, number>>;
  ordersByMode: Partial<Record<OrderMode, number>>;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
