import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export type CateringOrderStatus = "draft" | "sent" | "paid" | "completed" | "cancelled";

export interface CreateCateringOrderData {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  eventDate: Date;
  eventTime: string;
  guestCount: number;
  eventType?: string | null;
  eventAddress?: string | null;
  specialRequests?: string | null;
  orderNumber: string;
  items: Prisma.InputJsonValue;
  subtotal: number;
  taxAmount: number;
  serviceCharge?: number;
  totalAmount: number;
  notes?: string | null;
  leadId?: string | null;
}

export interface UpdateCateringOrderData {
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
  items?: Prisma.InputJsonValue;
  subtotal?: number;
  taxAmount?: number;
  serviceCharge?: number;
  totalAmount?: number;
  notes?: string | null;
}

export class CateringOrderRepository {
  /**
   * Create a new catering order
   */
  async create(tenantId: string, merchantId: string, data: CreateCateringOrderData) {
    return prisma.cateringOrder.create({
      data: {
        id: generateEntityId(),
        tenantId,
        merchantId,
        leadId: data.leadId ?? null,
        customerFirstName: data.customerFirstName,
        customerLastName: data.customerLastName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        guestCount: data.guestCount,
        eventType: data.eventType ?? null,
        eventAddress: data.eventAddress ?? null,
        specialRequests: data.specialRequests ?? null,
        orderNumber: data.orderNumber,
        items: data.items,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        serviceCharge: data.serviceCharge ?? 0,
        totalAmount: data.totalAmount,
        notes: data.notes ?? null,
        status: "draft",
      },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            currency: true,
            locale: true,
          },
        },
        lead: true,
      },
    });
  }

  /**
   * Get catering order by ID
   */
  async getById(tenantId: string, orderId: string) {
    return prisma.cateringOrder.findFirst({
      where: {
        id: orderId,
        tenantId,
        deleted: false,
      },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            currency: true,
            locale: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
          },
        },
        lead: true,
        invoice: true,
      },
    });
  }

  /**
   * Get catering orders for a specific merchant with pagination
   */
  async getByMerchant(
    tenantId: string,
    merchantId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: CateringOrderStatus | "all";
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ) {
    const { page = 1, pageSize = 20, search, status, dateFrom, dateTo } = options;

    const where: Prisma.CateringOrderWhereInput = {
      tenantId,
      merchantId,
      deleted: false,
    };

    if (status && status !== "all") {
      where.status = status;
    }

    if (dateFrom && dateTo) {
      where.eventDate = {
        gte: dateFrom,
        lte: dateTo,
      };
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerFirstName: { contains: search } },
        { customerLastName: { contains: search } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.cateringOrder.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              status: true,
              sentAt: true,
              paidAt: true,
            },
          },
        },
        orderBy: { eventDate: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cateringOrder.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get catering orders for all merchants in a company (for dashboard)
   */
  async getByTenant(
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: CateringOrderStatus | "all";
      merchantId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ) {
    const { page = 1, pageSize = 20, search, status, merchantId, dateFrom, dateTo } = options;

    const where: Prisma.CateringOrderWhereInput = {
      tenantId,
      deleted: false,
    };

    if (merchantId) {
      where.merchantId = merchantId;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (dateFrom && dateTo) {
      where.eventDate = {
        gte: dateFrom,
        lte: dateTo,
      };
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerFirstName: { contains: search } },
        { customerLastName: { contains: search } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.cateringOrder.findMany({
        where,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          invoice: {
            select: {
              id: true,
              status: true,
              sentAt: true,
              paidAt: true,
            },
          },
        },
        orderBy: { eventDate: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cateringOrder.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update catering order
   */
  async update(tenantId: string, orderId: string, data: UpdateCateringOrderData) {
    // First verify the order belongs to the tenant
    const order = await prisma.cateringOrder.findFirst({
      where: { id: orderId, tenantId, deleted: false },
      select: { id: true },
    });

    if (!order) {
      throw new Error(`Catering order not found: ${orderId}`);
    }

    return prisma.cateringOrder.update({
      where: { id: orderId },
      data,
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            currency: true,
            locale: true,
          },
        },
        lead: true,
        invoice: true,
      },
    });
  }

  /**
   * Update catering order status
   */
  async updateStatus(
    tenantId: string,
    orderId: string,
    status: CateringOrderStatus,
    additionalData?: Partial<{
      sentAt: Date;
      paidAt: Date;
    }>
  ) {
    // First verify the order belongs to the tenant
    const order = await prisma.cateringOrder.findFirst({
      where: { id: orderId, tenantId, deleted: false },
      select: { id: true },
    });

    if (!order) {
      throw new Error(`Catering order not found: ${orderId}`);
    }

    return prisma.cateringOrder.update({
      where: { id: orderId },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Get next order number sequence for today
   */
  async getNextOrderSequence(tenantId: string, merchantId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.cateringOrder.count({
      where: {
        tenantId,
        merchantId,
        deleted: false,
        createdAt: {
          gte: today,
        },
      },
    });

    return count + 1;
  }

  /**
   * Delete catering order (only if status is draft)
   */
  async delete(tenantId: string, orderId: string) {
    // First verify the order belongs to the tenant and is a draft
    const order = await prisma.cateringOrder.findFirst({
      where: { id: orderId, tenantId, deleted: false },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new Error(`Catering order not found: ${orderId}`);
    }

    if (order.status !== "draft") {
      throw new Error(`Cannot delete catering order with status: ${order.status}`);
    }

    return prisma.cateringOrder.update({
      where: { id: orderId },
      data: { deleted: true, updatedAt: new Date() },
    });
  }
}

export const cateringOrderRepository = new CateringOrderRepository();
