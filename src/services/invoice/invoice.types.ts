import type { Invoice, CateringOrder } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

// ==================== Status Types ====================

export const INVOICE_STATUSES = {
  UNPAID: "unpaid",
  PAID: "paid",
  CANCELLED: "cancelled",
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];

// ==================== Data Types ====================

interface InvoiceMerchant {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  currency: string;
  locale: string;
}

interface InvoiceCateringOrder {
  id: string;
  orderNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  eventDate: Date;
  eventTime: string;
  guestCount: number;
  eventType: string | null;
  eventAddress: string | null;
  items: unknown;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  totalAmount: number;
  merchant: InvoiceMerchant;
}

interface InvoiceData {
  id: string;
  tenantId: string;
  cateringOrderId: string;
  invoiceNumber: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: Date;
  paymentLink: string | null;
  sentAt: Date | null;
  openedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceWithCateringOrder extends InvoiceData {
  cateringOrder: InvoiceCateringOrder;
}

// ==================== Input Types ====================

export interface CreateInvoiceInput {
  dueDate: Date;
}

// ==================== Converter Functions ====================

function parseDecimal(value: Decimal | number): number {
  if (typeof value === "number") return value;
  return Number(value);
}

function toInvoiceData(invoice: Invoice): InvoiceData {
  return {
    id: invoice.id,
    tenantId: invoice.tenantId,
    cateringOrderId: invoice.cateringOrderId,
    invoiceNumber: invoice.invoiceNumber,
    amount: parseDecimal(invoice.amount),
    status: invoice.status as InvoiceStatus,
    dueDate: invoice.dueDate,
    paymentLink: invoice.paymentLink,
    sentAt: invoice.sentAt,
    openedAt: invoice.openedAt,
    paidAt: invoice.paidAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function toInvoiceWithCateringOrder(
  invoice: Invoice & {
    cateringOrder: CateringOrder & {
      merchant: InvoiceMerchant;
    };
  }
): InvoiceWithCateringOrder {
  return {
    ...toInvoiceData(invoice),
    cateringOrder: {
      id: invoice.cateringOrder.id,
      orderNumber: invoice.cateringOrder.orderNumber,
      customerFirstName: invoice.cateringOrder.customerFirstName,
      customerLastName: invoice.cateringOrder.customerLastName,
      customerPhone: invoice.cateringOrder.customerPhone,
      customerEmail: invoice.cateringOrder.customerEmail,
      eventDate: invoice.cateringOrder.eventDate,
      eventTime: invoice.cateringOrder.eventTime,
      guestCount: invoice.cateringOrder.guestCount,
      eventType: invoice.cateringOrder.eventType,
      eventAddress: invoice.cateringOrder.eventAddress,
      items: invoice.cateringOrder.items,
      subtotal: parseDecimal(invoice.cateringOrder.subtotal),
      taxAmount: parseDecimal(invoice.cateringOrder.taxAmount),
      serviceCharge: parseDecimal(invoice.cateringOrder.serviceCharge),
      totalAmount: parseDecimal(invoice.cateringOrder.totalAmount),
      merchant: invoice.cateringOrder.merchant,
    },
  };
}
