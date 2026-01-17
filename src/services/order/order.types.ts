import type { Order } from "@prisma/client";
import type {
  OrderType,
  OrderStatus,
  OrderItemData,
  DeliveryAddress,
  TaxBreakdownItem,
} from "@/types";
import type { FeeBreakdownItem } from "@/lib/pricing";

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: OrderType;
  items: OrderItemData[];
  notes?: string;
  deliveryAddress?: DeliveryAddress;
  scheduledAt?: Date;
  tipAmount?: number;
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
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
  orderBy?: "createdAt" | "updatedAt";
  orderDirection?: "asc" | "desc";
}
