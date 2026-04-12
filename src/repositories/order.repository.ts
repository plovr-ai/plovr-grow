import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { OrderStatus, FulfillmentStatus, OrderMode, SalesChannel, OrderItemData } from "@/types";
import { generateEntityId } from "@/lib/id";

/** OrderItem with nested modifiers, as returned by repository queries */
export interface OrderItemWithModifiers {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  totalPrice: Prisma.Decimal;
  notes: string | null;
  imageUrl: string | null;
  taxes: Prisma.JsonValue;
  sortOrder: number;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  modifiers: {
    id: string;
    orderItemId: string;
    modifierGroupId: string;
    modifierOptionId: string;
    groupName: string;
    name: string;
    price: Prisma.Decimal;
    quantity: number;
    deleted: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

export class OrderRepository {
  /**
   * Create a new order with optional merchantId (for Company-level orders like giftcards)
   */
  async create(
    tenantId: string,
    merchantId: string | null,
    data: Omit<Prisma.OrderCreateInput, "tenant" | "merchant" | "loyaltyMember" | "id" | "orderItems">,
    loyaltyMemberId?: string,
    tx?: DbClient,
    orderItems?: OrderItemData[]
  ) {
    const db = tx ?? prisma;
    return db.order.create({
      data: {
        id: generateEntityId(),
        ...data,
        tenant: { connect: { id: tenantId } },
        ...(merchantId && { merchant: { connect: { id: merchantId } } }),
        ...(loyaltyMemberId && {
          loyaltyMember: { connect: { id: loyaltyMemberId } },
        }),
        ...(orderItems && orderItems.length > 0 && {
          orderItems: {
            create: orderItems.map((item, index) => ({
              id: generateEntityId(),
              menuItemId: item.menuItemId,
              name: item.name,
              unitPrice: item.price,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
              notes: item.specialInstructions ?? null,
              imageUrl: item.imageUrl ?? null,
              taxes: item.taxes ? (item.taxes as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              sortOrder: index,
              ...(item.selectedModifiers.length > 0 && {
                modifiers: {
                  create: item.selectedModifiers.map((mod) => ({
                    id: generateEntityId(),
                    modifierGroupId: mod.groupId,
                    modifierOptionId: mod.modifierId,
                    groupName: mod.groupName,
                    name: mod.modifierName,
                    price: mod.price,
                    quantity: mod.quantity,
                  })),
                },
              }),
            })),
          },
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
        orderItems: {
          where: { deleted: false },
          orderBy: { sortOrder: "asc" },
          include: {
            modifiers: {
              where: { deleted: false },
            },
          },
        },
      },
    });
  }

  /**
   * Get orders for a tenant (all merchants under the tenant)
   */
  async getTenantOrders(
    tenantId: string,
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
  /**
   * Get structured order items with modifiers for an order
   */
  async getOrderItems(orderId: string): Promise<OrderItemWithModifiers[]> {
    return prisma.orderItem.findMany({
      where: {
        orderId,
        deleted: false,
      },
      orderBy: { sortOrder: "asc" },
      include: {
        modifiers: {
          where: { deleted: false },
        },
      },
    });
  }

  /**
   * Get aggregated sales data for a specific menu item
   */
  async getItemSalesByMenuItemId(
    tenantId: string,
    menuItemId: string,
    options?: { dateFrom?: Date; dateTo?: Date }
  ): Promise<{ totalQuantity: number; totalRevenue: Prisma.Decimal }> {
    const result = await prisma.orderItem.aggregate({
      where: {
        menuItemId,
        deleted: false,
        order: {
          tenantId,
          deleted: false,
          status: { not: "canceled" },
          ...(options?.dateFrom && options?.dateTo
            ? {
                createdAt: {
                  gte: options.dateFrom,
                  lte: options.dateTo,
                },
              }
            : {}),
        },
      },
      _sum: {
        quantity: true,
        totalPrice: true,
      },
    });

    return {
      totalQuantity: result._sum.quantity ?? 0,
      totalRevenue: result._sum.totalPrice ?? new Prisma.Decimal(0),
    };
  }
}

export const orderRepository = new OrderRepository();
