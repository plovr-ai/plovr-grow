import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { OrderStatus, OrderType } from "@/types";

export class OrderRepository {
  /**
   * Create a new order with merchantId
   */
  async create(
    tenantId: string,
    merchantId: string,
    data: Omit<Prisma.OrderCreateInput, "tenant" | "merchant">
  ) {
    return prisma.order.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        merchant: { connect: { id: merchantId } },
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
      include: {
        customer: true,
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
        customer: true,
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
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
      include: {
        customer: true,
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
      orderType?: OrderType;
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
      orderType,
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
      ...(orderType && { orderType }),
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
   * Update order status
   */
  async updateStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    additionalData?: Partial<{
      confirmedAt: Date;
      completedAt: Date;
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
      status: { not: "cancelled" },
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
      orderType?: string;
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
      orderType,
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
      ...(orderType && { orderType }),
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
          { customerName: { contains: search } },
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
          customer: true,
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
        orderType: true,
      },
    });

    const completedOrders = orders.filter((o) => o.status !== "cancelled");
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

    const ordersByType = completedOrders.reduce(
      (acc, order) => {
        acc[order.orderType] = (acc[order.orderType] || 0) + 1;
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
      ordersByType,
    };
  }

  /**
   * Count pending/active orders for a merchant
   */
  async countPendingOrders(tenantId: string, merchantId: string) {
    return prisma.order.count({
      where: {
        tenantId,
        merchantId,
        status: { in: ["pending", "confirmed", "preparing"] },
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
   * Update order status and return updated order
   */
  async updateStatusAndReturn(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    additionalData?: Partial<{
      confirmedAt: Date;
      completedAt: Date;
      cancelledAt: Date;
      cancelReason: string;
    }>
  ) {
    return prisma.order.update({
      where: {
        id: orderId,
        tenantId,
      },
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
          },
        },
      },
    });
  }
}

export const orderRepository = new OrderRepository();
