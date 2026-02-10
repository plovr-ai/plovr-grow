import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { OrderStatus, FulfillmentStatus, OrderMode, SalesChannel } from "@/types";
import { generateEntityId } from "@/lib/id";

export class OrderRepository {
  /**
   * Create a new order with optional merchantId (for Company-level orders like giftcards)
   */
  async create(
    tenantId: string,
    companyId: string,
    merchantId: string | null,
    data: Omit<Prisma.OrderCreateInput, "tenant" | "company" | "merchant" | "loyaltyMember" | "id">,
    loyaltyMemberId?: string
  ) {
    return prisma.order.create({
      data: {
        id: generateEntityId(),
        ...data,
        tenant: { connect: { id: tenantId } },
        company: { connect: { id: companyId } },
        ...(merchantId && { merchant: { connect: { id: merchantId } } }),
        ...(loyaltyMemberId && {
          loyaltyMember: { connect: { id: loyaltyMemberId } },
        }),
      },
    });
  }

  /**
   * Get order by ID
   */
  async getById(tenantId: string, orderId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
    });
  }

  /**
   * Get order by ID with merchant info
   */
  async getByIdWithMerchant(tenantId: string, orderId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
          },
        },
      },
    });
  }

  /**
   * Get order by order number
   */
  async getByOrderNumber(tenantId: string, orderNumber: string) {
    return prisma.order.findFirst({
      where: {
        orderNumber,
        tenantId,
      },
    });
  }

  /**
   * Get orders for a tenant with pagination
   */
  async getOrders(
    tenantId: string,
    options: {
      status?: OrderStatus;
      merchantId?: string;
      orderMode?: OrderMode;
      salesChannel?: SalesChannel;
      dateFrom?: Date;
      dateTo?: Date;
      page?: number;
      pageSize?: number;
      orderBy?: "createdAt" | "updatedAt";
      orderDirection?: "asc" | "desc";
    } = {}
  ) {
    const {
      status,
      merchantId,
      orderMode,
      salesChannel,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 20,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(merchantId && { merchantId }),
      ...(orderMode && { orderMode }),
      ...(salesChannel && { salesChannel }),
      ...(dateFrom && dateTo && {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
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
   * Get today's orders for a tenant
   */
  async getTodayOrders(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: today,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Update payment status
   */
  async updateStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    additionalData?: Partial<{
      paidAt: Date;
      cancelledAt: Date;
      cancelReason: string;
    }>
  ) {
    return prisma.order.updateMany({
      where: {
        id: orderId,
        tenantId,
      },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Update fulfillment status
   */
  async updateFulfillmentStatus(
    tenantId: string,
    orderId: string,
    fulfillmentStatus: FulfillmentStatus,
    additionalData?: Partial<{
      confirmedAt: Date;
      preparingAt: Date;
      readyAt: Date;
      fulfilledAt: Date;
    }>
  ) {
    return prisma.order.updateMany({
      where: {
        id: orderId,
        tenantId,
      },
      data: {
        fulfillmentStatus,
        ...additionalData,
      },
    });
  }

  /**
   * Get next order number sequence for today
   */
  async getNextOrderSequence(tenantId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.order.count({
      where: {
        tenantId,
        createdAt: {
          gte: today,
        },
      },
    });

    return count + 1;
  }

  /**
   * Get order statistics for a tenant
   */
  async getStats(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const where: Prisma.OrderWhereInput = {
      tenantId,
      status: { not: "canceled" },
      ...(dateFrom && dateTo && {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      }),
    };

    const orders = await prisma.order.findMany({
      where,
      select: {
        totalAmount: true,
        status: true,
      },
    });

    const totalRevenue = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0
    );

    return {
      totalOrders: orders.length,
      totalRevenue,
      averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    };
  }

  /**
   * Get orders for a specific merchant with pagination
   */
  async getMerchantOrders(
    tenantId: string,
    merchantId: string,
    options: {
      status?: OrderStatus;
      fulfillmentStatus?: FulfillmentStatus;
      orderMode?: string;
      salesChannel?: SalesChannel;
      dateFrom?: Date;
      dateTo?: Date;
      search?: string;
      page?: number;
      pageSize?: number;
      orderBy?: "createdAt" | "updatedAt" | "totalAmount";
      orderDirection?: "asc" | "desc";
    } = {}
  ) {
    const {
      status,
      fulfillmentStatus,
      orderMode,
      salesChannel,
      dateFrom,
      dateTo,
      search,
      page = 1,
      pageSize = 20,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      merchantId,
      ...(status && { status }),
      ...(fulfillmentStatus && { fulfillmentStatus }),
      ...(orderMode && { orderMode }),
      ...(salesChannel && { salesChannel }),
      ...(dateFrom &&
        dateTo && {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search } },
          { customerFirstName: { contains: search } },
          { customerLastName: { contains: search } },
          { customerPhone: { contains: search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
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
   * Get today's orders for a merchant
   */
  async getMerchantTodayOrders(tenantId: string, merchantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.order.findMany({
      where: {
        tenantId,
        merchantId,
        createdAt: {
          gte: today,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Get merchant order statistics
   */
  async getMerchantStats(
    tenantId: string,
    merchantId: string,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    const where: Prisma.OrderWhereInput = {
      tenantId,
      merchantId,
      ...(dateFrom &&
        dateTo && {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        }),
    };

    const orders = await prisma.order.findMany({
      where,
      select: {
        totalAmount: true,
        status: true,
        fulfillmentStatus: true,
        orderMode: true,
      },
    });

    const completedOrders = orders.filter((o) => o.status !== "canceled");
    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0
    );

    const ordersByStatus = orders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const ordersByFulfillmentStatus = orders.reduce(
      (acc, order) => {
        acc[order.fulfillmentStatus] = (acc[order.fulfillmentStatus] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const ordersByType = completedOrders.reduce(
      (acc, order) => {
        acc[order.orderMode] = (acc[order.orderMode] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalOrders: completedOrders.length,
      totalRevenue,
      averageOrderValue:
        completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
      ordersByStatus,
      ordersByFulfillmentStatus,
      ordersByType,
    };
  }

  /**
   * Count active orders for a merchant (paid but not yet fulfilled)
   */
  async countActiveOrders(tenantId: string, merchantId: string) {
    return prisma.order.count({
      where: {
        tenantId,
        merchantId,
        status: "completed", // Only paid orders
        fulfillmentStatus: { in: ["pending", "confirmed", "preparing", "ready"] },
      },
    });
  }

  /**
   * Get next order number sequence for a merchant
   */
  async getNextMerchantOrderSequence(
    tenantId: string,
    merchantId: string
  ): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.order.count({
      where: {
        tenantId,
        merchantId,
        createdAt: {
          gte: today,
        },
      },
    });

    return count + 1;
  }

  /**
   * Get next order number sequence for Company-level orders (e.g., giftcards)
   * Uses companyId instead of merchantId to avoid conflicts
   */
  async getNextCompanyOrderSequence(
    tenantId: string,
    companyId: string
  ): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.order.count({
      where: {
        tenantId,
        companyId,
        merchantId: null, // Company-level orders have null merchantId
        createdAt: {
          gte: today,
        },
      },
    });

    return count + 1;
  }

  /**
   * Get orders for a company (all merchants under the company)
   */
  async getCompanyOrders(
    tenantId: string,
    companyId: string,
    options: {
      status?: OrderStatus;
      fulfillmentStatus?: FulfillmentStatus;
      merchantId?: string;
      orderMode?: OrderMode;
      salesChannel?: SalesChannel;
      dateFrom?: Date;
      dateTo?: Date;
      search?: string;
      page?: number;
      pageSize?: number;
      orderBy?: "createdAt" | "updatedAt" | "totalAmount";
      orderDirection?: "asc" | "desc";
    } = {}
  ) {
    const {
      status,
      fulfillmentStatus,
      merchantId,
      orderMode,
      salesChannel,
      dateFrom,
      dateTo,
      search,
      page = 1,
      pageSize = 20,
      orderBy = "createdAt",
      orderDirection = "desc",
    } = options;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      companyId,
      ...(merchantId && { merchantId }),
      ...(status && { status }),
      ...(fulfillmentStatus && { fulfillmentStatus }),
      ...(orderMode && { orderMode }),
      ...(salesChannel && { salesChannel }),
      ...(dateFrom &&
        dateTo && {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search } },
          { customerFirstName: { contains: search } },
          { customerLastName: { contains: search } },
          { customerPhone: { contains: search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
              timezone: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
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
   * Update payment status and return updated order
   */
  async updateStatusAndReturn(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    additionalData?: Partial<{
      paidAt: Date;
      cancelledAt: Date;
      cancelReason: string;
    }>
  ) {
    // First verify the order belongs to the tenant
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...additionalData,
      },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
          },
        },
      },
    });
  }

  /**
   * Update fulfillment status and return updated order
   */
  async updateFulfillmentStatusAndReturn(
    tenantId: string,
    orderId: string,
    fulfillmentStatus: FulfillmentStatus,
    additionalData?: Partial<{
      confirmedAt: Date;
      preparingAt: Date;
      readyAt: Date;
      fulfilledAt: Date;
    }>
  ) {
    // First verify the order belongs to the tenant
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus,
        ...additionalData,
      },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
          },
        },
      },
    });
  }

  /**
   * Link order to loyalty member (for post-order registration)
   */
  async updateLoyaltyMemberId(
    tenantId: string,
    orderId: string,
    loyaltyMemberId: string
  ) {
    // First verify the order belongs to the tenant
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: {
        loyaltyMember: { connect: { id: loyaltyMemberId } },
      },
    });
  }

  /**
   * Get orders for a loyalty member with pagination
   */
  async getOrdersByLoyaltyMember(
    tenantId: string,
    loyaltyMemberId: string,
    options: {
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const { page = 1, pageSize = 10 } = options;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      loyaltyMemberId,
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
              timezone: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const orderRepository = new OrderRepository();
