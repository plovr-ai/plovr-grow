import {
  cateringOrderRepository,
  type CateringOrderStatus,
} from "@/repositories/catering-order.repository";
import { cateringRepository } from "@/repositories/catering.repository";
import { sequenceRepository } from "@/repositories/sequence.repository";
import { merchantService } from "@/services/merchant";
import { generateCateringOrderNumber } from "@/lib/utils";
import { getTodayInTimezone } from "@/lib/timezone";
import type {
  CreateCateringOrderInput,
  UpdateCateringOrderInput,
  CateringOrderListOptions,
  CateringOrderWithRelations,
  CateringOrderInvoice,
} from "./catering-order.types";
import {
  toCateringOrderData,
  toCateringOrderWithRelations,
} from "./catering-order.types";

/**
 * Create a new catering order
 */
async function createOrder(
  tenantId: string,
  merchantId: string,
  input: CreateCateringOrderInput
): Promise<CateringOrderWithRelations> {
  // Get merchant timezone for accurate date-based sequencing
  const merchant = await merchantService.getMerchantById(merchantId);
  const timezone = merchant?.timezone;

  // Get current date in merchant's timezone (format: "2026-01-27")
  const dateStr = timezone
    ? getTodayInTimezone(timezone)
    : new Date().toISOString().slice(0, 10);

  // Generate order number using atomic sequence (no retry needed)
  const sequence = await sequenceRepository.getNextCateringOrderSequence(
    tenantId,
    merchantId,
    dateStr
  );
  const orderNumber = generateCateringOrderNumber(sequence, timezone);

  const order = await cateringOrderRepository.create(tenantId, merchantId, {
    customerFirstName: input.customerFirstName,
    customerLastName: input.customerLastName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    eventDate: input.eventDate,
    eventTime: input.eventTime,
    guestCount: input.guestCount,
    eventType: input.eventType,
    eventAddress: input.eventAddress,
    specialRequests: input.specialRequests,
    orderNumber,
    items: JSON.parse(JSON.stringify(input.items)),
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    serviceCharge: input.serviceCharge ?? 0,
    totalAmount: input.totalAmount,
    notes: input.notes,
    leadId: input.leadId,
  });

  // If created from a lead, update lead status to completed
  if (input.leadId) {
    await cateringRepository.updateStatus(tenantId, input.leadId, "completed");
  }

  return toCateringOrderWithRelations(order);
}

/**
 * Get catering order by ID
 */
async function getOrder(
  tenantId: string,
  orderId: string
): Promise<CateringOrderWithRelations | null> {
  const order = await cateringOrderRepository.getById(tenantId, orderId);
  if (!order) return null;
  return toCateringOrderWithRelations(order);
}

/**
 * Get catering orders for a specific merchant
 */
async function getMerchantOrders(
  tenantId: string,
  merchantId: string,
  options: CateringOrderListOptions = {}
) {
  const result = await cateringOrderRepository.getByMerchant(
    tenantId,
    merchantId,
    {
      page: options.page,
      pageSize: options.pageSize,
      search: options.search,
      status: options.status as CateringOrderStatus | "all",
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
    }
  );

  return {
    items: result.items.map((order) => toCateringOrderData(order)),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

/**
 * Get catering orders for a tenant (all merchants)
 */
async function getTenantOrders(
  tenantId: string,
  options: CateringOrderListOptions = {}
) {
  const result = await cateringOrderRepository.getByTenant(tenantId, {
    page: options.page,
    pageSize: options.pageSize,
    search: options.search,
    status: options.status as CateringOrderStatus | "all",
    merchantId: options.merchantId,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
  });

  return {
    items: result.items.map((order) => ({
      ...toCateringOrderData(order),
      merchant: order.merchant,
      invoice: order.invoice as CateringOrderInvoice | null,
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

/**
 * Update catering order
 */
async function updateOrder(
  tenantId: string,
  orderId: string,
  input: UpdateCateringOrderInput
): Promise<CateringOrderWithRelations> {
  const order = await cateringOrderRepository.update(tenantId, orderId, {
    customerFirstName: input.customerFirstName,
    customerLastName: input.customerLastName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    eventDate: input.eventDate,
    eventTime: input.eventTime,
    guestCount: input.guestCount,
    eventType: input.eventType,
    eventAddress: input.eventAddress,
    specialRequests: input.specialRequests,
    items: input.items ? JSON.parse(JSON.stringify(input.items)) : undefined,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    serviceCharge: input.serviceCharge,
    totalAmount: input.totalAmount,
    notes: input.notes,
  });

  return toCateringOrderWithRelations(order);
}

/**
 * Update catering order status
 */
async function updateOrderStatus(
  tenantId: string,
  orderId: string,
  status: CateringOrderStatus
) {
  const additionalData: Partial<{ sentAt: Date; paidAt: Date }> = {};

  if (status === "sent") {
    additionalData.sentAt = new Date();
  } else if (status === "paid") {
    additionalData.paidAt = new Date();
  }

  return cateringOrderRepository.updateStatus(
    tenantId,
    orderId,
    status,
    additionalData
  );
}

/**
 * Delete catering order (only if draft)
 */
async function deleteOrder(tenantId: string, orderId: string) {
  return cateringOrderRepository.delete(tenantId, orderId);
}

/**
 * Convert a lead to a catering order
 */
async function convertLeadToOrder(
  tenantId: string,
  merchantId: string,
  leadId: string,
  input: Omit<CreateCateringOrderInput, "leadId" | "customerFirstName" | "customerLastName" | "customerPhone" | "customerEmail"> & {
    customerFirstName?: string;
    customerLastName?: string;
    customerPhone?: string;
    customerEmail?: string;
  }
): Promise<CateringOrderWithRelations> {
  // TODO: lookup specific lead to pre-fill customer info
  // For now, we'll require all customer info to be passed
  const orderInput: CreateCateringOrderInput = {
    customerFirstName: input.customerFirstName ?? "",
    customerLastName: input.customerLastName ?? "",
    customerPhone: input.customerPhone ?? "",
    customerEmail: input.customerEmail ?? "",
    eventDate: input.eventDate,
    eventTime: input.eventTime,
    guestCount: input.guestCount,
    eventType: input.eventType,
    eventAddress: input.eventAddress,
    specialRequests: input.specialRequests,
    items: input.items,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    serviceCharge: input.serviceCharge,
    totalAmount: input.totalAmount,
    notes: input.notes,
    leadId,
  };

  return createOrder(tenantId, merchantId, orderInput);
}

export const cateringOrderService = {
  createOrder,
  getOrder,
  getMerchantOrders,
  getTenantOrders,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  convertLeadToOrder,
};
