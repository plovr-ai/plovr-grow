import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { OrderStatus, OrderType } from "@/types";

export class OrderRepository {
  /**
   * Create a new order
   */
  async create(
    tenantId: string,
    data: Omit<Prisma.OrderCreateInput, "tenant">
  ) {
    return prisma.order.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
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
}

export const orderRepository = new OrderRepository();
