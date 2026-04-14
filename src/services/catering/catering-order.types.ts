import type { CateringOrder, Invoice, CateringLead } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

// ==================== Status Types ====================

export const CATERING_ORDER_STATUSES = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type CateringOrderStatus =
  (typeof CATERING_ORDER_STATUSES)[keyof typeof CATERING_ORDER_STATUSES];

// ==================== Data Types ====================

export interface CateringOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface CateringOrderMerchant {
  id: string;
  name: string;
  slug: string;
  timezone?: string;
  currency?: string;
  locale?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

export interface CateringOrderInvoice {
  id: string;
  status: string;
  sentAt: Date | null;
  paidAt: Date | null;
}

export interface CateringOrderData {
  id: string;
  tenantId: string;
  merchantId: string;
  leadId: string | null;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  eventDate: Date;
  eventTime: string;
  guestCount: number;
  eventType: string | null;
  eventAddress: string | null;
  specialRequests: string | null;
  orderNumber: string;
  items: CateringOrderItem[];
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  totalAmount: number;
  status: CateringOrderStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  paidAt: Date | null;
}

export interface CateringOrderWithRelations extends CateringOrderData {
  merchant: CateringOrderMerchant;
  lead?: CateringLead | null;
  invoice?: CateringOrderInvoice | null;
}

// ==================== Input Types ====================

export interface CreateCateringOrderInput {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  eventDate: Date;
  eventTime: string;
  guestCount: number;
  eventType?: string;
  eventAddress?: string;
  specialRequests?: string;
  items: CateringOrderItem[];
  subtotal: number;
  taxAmount: number;
  serviceCharge?: number;
  totalAmount: number;
  notes?: string;
  leadId?: string;
}

export interface UpdateCateringOrderInput {
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  customerEmail?: string;
  eventDate?: Date;
  eventTime?: string;
  guestCount?: number;
  eventType?: string | null;
  eventAddress?: string | null;
  specialRequests?: string | null;
  items?: CateringOrderItem[];
  subtotal?: number;
  taxAmount?: number;
  serviceCharge?: number;
  totalAmount?: number;
  notes?: string | null;
}

// ==================== Paginated Types ====================

// ==================== Filter Options ====================

export interface CateringOrderListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CateringOrderStatus | "all";
  merchantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ==================== Converter Functions ====================

function parseDecimal(value: Decimal | number): number {
  if (typeof value === "number") return value;
  return Number(value);
}

export function toCateringOrderData(
  order: CateringOrder & { invoice?: { id: string; status: string; sentAt: Date | null; paidAt: Date | null } | null }
): CateringOrderData & { invoice?: CateringOrderInvoice | null } {
  return {
    id: order.id,
    tenantId: order.tenantId,
    merchantId: order.merchantId,
    leadId: order.leadId,
    customerFirstName: order.customerFirstName,
    customerLastName: order.customerLastName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    eventDate: order.eventDate,
    eventTime: order.eventTime,
    guestCount: order.guestCount,
    eventType: order.eventType,
    eventAddress: order.eventAddress,
    specialRequests: order.specialRequests,
    orderNumber: order.orderNumber,
    items: order.items as unknown as CateringOrderItem[],
    subtotal: parseDecimal(order.subtotal),
    taxAmount: parseDecimal(order.taxAmount),
    serviceCharge: parseDecimal(order.serviceCharge),
    totalAmount: parseDecimal(order.totalAmount),
    status: order.status as CateringOrderStatus,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    sentAt: order.sentAt,
    paidAt: order.paidAt,
    invoice: order.invoice ?? null,
  };
}

export function toCateringOrderWithRelations(
  order: CateringOrder & {
    merchant: CateringOrderMerchant;
    lead?: CateringLead | null;
    invoice?: Invoice | null;
  }
): CateringOrderWithRelations {
  return {
    ...toCateringOrderData(order),
    merchant: order.merchant,
    lead: order.lead ?? null,
    invoice: order.invoice
      ? {
          id: order.invoice.id,
          status: order.invoice.status,
          sentAt: order.invoice.sentAt,
          paidAt: order.invoice.paidAt,
        }
      : null,
  };
}
