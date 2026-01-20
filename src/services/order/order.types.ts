import type { Order } from "@prisma/client";
import type {
  OrderType,
  OrderStatus,
  OrderItemData,
  DeliveryAddress,
  TaxBreakdownItem,
} from "@/types";
import type { FeeBreakdownItem } from "@/lib/pricing";

// Generic order data type that works with both mock and Prisma orders
export interface OrderData {
  id: string;
  tenantId: string;
  merchantId: string | null;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  orderType: string;
  status: string;
  items: OrderItemData[] | unknown;
  subtotal: number | unknown;
  taxAmount: number | unknown;
  tipAmount: number | unknown;
  deliveryFee: number | unknown;
  discount: number | unknown;
  totalAmount: number | unknown;
  notes: string | null;
  deliveryAddress: DeliveryAddress | unknown | null;
  scheduledAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  merchantId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: OrderType;
  items: OrderItemData[];
  notes?: string;
  deliveryAddress?: DeliveryAddress;
  scheduledAt?: Date;
  tipAmount?: number;
  discountCode?: string;
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

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  cancelReason?: string;
}

export interface OrderListOptions {
  merchantId?: string;
  status?: OrderStatus;
  orderType?: OrderType;
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
  orderType?: OrderType;
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
  orderType?: OrderType;
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
  ordersByType: Partial<Record<OrderType, number>>;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Timeline types for Order Detail page
export interface TimelineEvent {
  status: OrderStatus;
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
}
