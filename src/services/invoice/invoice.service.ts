import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";
import { invoiceRepository } from "@/repositories/invoice.repository";
import { cateringOrderRepository } from "@/repositories/catering-order.repository";
import { sequenceRepository } from "@/repositories/sequence.repository";
import { generateInvoiceNumber } from "@/lib/utils";
import { stripeService } from "@/services/stripe";
import { emailService } from "@/services/email";
import type {
  InvoiceWithCateringOrder,
  CreateInvoiceInput,
} from "./invoice.types";
import { toInvoiceWithCateringOrder } from "./invoice.types";

/**
 * Create an invoice for a catering order
 */
async function createInvoice(
  tenantId: string,
  cateringOrderId: string,
  input: CreateInvoiceInput
): Promise<InvoiceWithCateringOrder> {
  // Get the catering order
  const order = await cateringOrderRepository.getById(tenantId, cateringOrderId);
  if (!order) {
    throw new AppError(ErrorCodes.CATERING_ORDER_NOT_FOUND, { cateringOrderId }, 404);
  }

  // Check if invoice already exists
  const existingInvoice = await invoiceRepository.getByCateringOrderId(
    tenantId,
    cateringOrderId
  );
  if (existingInvoice) {
    throw new AppError(ErrorCodes.INVOICE_ALREADY_EXISTS, undefined, 409);
  }

  // Generate invoice number using atomic sequence (tenant-level, never resets)
  const sequence = await sequenceRepository.getNextInvoiceSequence(tenantId);
  const invoiceNumber = generateInvoiceNumber(sequence);

  // Create Stripe payment link
  const paymentLink = await stripeService.createPaymentLink({
    amount: Number(order.totalAmount),
    currency: order.merchant.currency || "USD",
    description: `Catering Order ${order.orderNumber}`,
    metadata: {
      tenantId,
      cateringOrderId,
      invoiceNumber,
    },
  });

  // Create the invoice
  const invoice = await invoiceRepository.create(tenantId, {
    cateringOrderId,
    invoiceNumber,
    amount: Number(order.totalAmount),
    dueDate: input.dueDate,
    paymentLink: paymentLink.url,
  });

  // Update catering order status to 'sent'
  await cateringOrderRepository.updateStatus(tenantId, cateringOrderId, "sent", {
    sentAt: new Date(),
  });

  return toInvoiceWithCateringOrder(invoice);
}

/**
 * Get invoice by ID
 */
async function getInvoice(
  tenantId: string,
  invoiceId: string
): Promise<InvoiceWithCateringOrder | null> {
  const invoice = await invoiceRepository.getById(tenantId, invoiceId);
  if (!invoice) return null;
  return toInvoiceWithCateringOrder(invoice);
}

/**
 * Get invoice by catering order ID
 */
async function getInvoiceByCateringOrderId(
  tenantId: string,
  cateringOrderId: string
): Promise<InvoiceWithCateringOrder | null> {
  const invoice = await invoiceRepository.getByCateringOrderId(
    tenantId,
    cateringOrderId
  );
  if (!invoice) return null;
  return toInvoiceWithCateringOrder(invoice);
}

/**
 * Send invoice email to customer
 */
async function sendInvoice(tenantId: string, invoiceId: string): Promise<void> {
  const invoice = await invoiceRepository.getById(tenantId, invoiceId);
  if (!invoice) {
    throw new AppError(ErrorCodes.INVOICE_NOT_FOUND, { invoiceId }, 404);
  }

  // Send email
  await emailService.sendInvoiceEmail({
    to: invoice.cateringOrder.customerEmail,
    customerName: `${invoice.cateringOrder.customerFirstName} ${invoice.cateringOrder.customerLastName}`,
    invoiceNumber: invoice.invoiceNumber,
    orderNumber: invoice.cateringOrder.orderNumber,
    eventDate: invoice.cateringOrder.eventDate,
    eventTime: invoice.cateringOrder.eventTime,
    totalAmount: Number(invoice.amount),
    dueDate: invoice.dueDate,
    paymentLink: invoice.paymentLink || "",
    merchantName: invoice.cateringOrder.merchant.name,
    currency: invoice.cateringOrder.merchant.currency,
    locale: invoice.cateringOrder.merchant.locale,
  });

  // Mark invoice as sent
  await invoiceRepository.markAsSent(tenantId, invoiceId);
}

/**
 * Mark invoice as paid (called by Stripe webhook)
 */
async function markAsPaid(tenantId: string, invoiceId: string): Promise<void> {
  await invoiceRepository.markAsPaid(tenantId, invoiceId);
}

/**
 * Handle Stripe webhook for payment completion
 */
async function handlePaymentCompleted(invoiceNumber: string): Promise<void> {
  const invoice = await invoiceRepository.getByInvoiceNumber(invoiceNumber);
  if (!invoice) {
    console.error(`Invoice not found for payment: ${invoiceNumber}`);
    return;
  }

  await invoiceRepository.markAsPaid(invoice.tenantId, invoice.id);
}

/**
 * Cancel invoice
 */
async function cancelInvoice(tenantId: string, invoiceId: string): Promise<void> {
  await invoiceRepository.updateStatus(tenantId, invoiceId, "cancelled");
}

export const invoiceService = {
  createInvoice,
  getInvoice,
  getInvoiceByCateringOrderId,
  sendInvoice,
  markAsPaid,
  handlePaymentCompleted,
  cancelInvoice,
};
