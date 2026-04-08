import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
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
    loyaltyMemberId?: string,
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    return db.order.create({
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
   * Get order by ID with merchant info
   */
  async getByIdWithMerchant(tenantId: string, orderId: string) {
    return prisma.order.findFirst({
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
          },
        },
      },
    });
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
      deleted: false,
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
   * Link order to loyalty member (for post-order registration)
   */
  async updateLoyaltyMemberId(
    tenantId: string,
    orderId: string,
    loyaltyMemberId: string
  ) {
    // First verify the order belongs to the tenant
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId, deleted: false },
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
      deleted: false,
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
