import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export type InvoiceStatus = "unpaid" | "paid" | "cancelled";

export interface CreateInvoiceData {
  cateringOrderId: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  paymentLink?: string | null;
}

export class InvoiceRepository {
  /**
   * Create a new invoice
   */
  async create(tenantId: string, data: CreateInvoiceData) {
    return prisma.invoice.create({
      data: {
        id: generateEntityId(),
        tenantId,
        cateringOrderId: data.cateringOrderId,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        dueDate: data.dueDate,
        paymentLink: data.paymentLink ?? null,
        status: "unpaid",
      },
      include: {
        cateringOrder: {
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
                slug: true,
                phone: true,
                email: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                currency: true,
                locale: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get invoice by ID
   */
  async getById(tenantId: string, invoiceId: string) {
    return prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
      },
      include: {
        cateringOrder: {
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
                slug: true,
                phone: true,
                email: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                currency: true,
                locale: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get invoice by catering order ID
   */
  async getByCateringOrderId(tenantId: string, cateringOrderId: string) {
    return prisma.invoice.findFirst({
      where: {
        cateringOrderId,
        tenantId,
      },
      include: {
        cateringOrder: {
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
                slug: true,
                phone: true,
                email: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                currency: true,
                locale: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get invoice by invoice number
   */
  async getByInvoiceNumber(invoiceNumber: string) {
    return prisma.invoice.findUnique({
      where: {
        invoiceNumber,
      },
      include: {
        cateringOrder: {
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
                slug: true,
                phone: true,
                email: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                currency: true,
                locale: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update invoice status
   */
  async updateStatus(
    tenantId: string,
    invoiceId: string,
    status: InvoiceStatus,
    additionalData?: Partial<{
      sentAt: Date;
      openedAt: Date;
      paidAt: Date;
    }>
  ) {
    // First verify the invoice belongs to the tenant
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { id: true },
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Update payment link
   */
  async updatePaymentLink(tenantId: string, invoiceId: string, paymentLink: string) {
    // First verify the invoice belongs to the tenant
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { id: true },
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { paymentLink },
    });
  }

  /**
   * Mark invoice as sent
   */
  async markAsSent(tenantId: string, invoiceId: string) {
    // First verify the invoice belongs to the tenant
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { id: true },
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { sentAt: new Date() },
    });
  }

  /**
   * Mark invoice as paid (and update catering order status)
   */
  async markAsPaid(tenantId: string, invoiceId: string) {
    // First verify the invoice belongs to the tenant
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { id: true, cateringOrderId: true },
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Use a transaction to update both invoice and catering order
    return prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "paid",
          paidAt: new Date(),
        },
      });

      // Update catering order status to paid
      await tx.cateringOrder.update({
        where: { id: invoice.cateringOrderId },
        data: {
          status: "paid",
          paidAt: new Date(),
        },
      });

      return updatedInvoice;
    });
  }

  /**
   * Get next invoice number sequence
   */
  async getNextInvoiceSequence(tenantId: string): Promise<number> {
    const count = await prisma.invoice.count({
      where: { tenantId },
    });

    return count + 1;
  }
}

export const invoiceRepository = new InvoiceRepository();
