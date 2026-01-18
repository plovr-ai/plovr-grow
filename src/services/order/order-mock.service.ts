import { getMockOrders } from "@/data/mock/orders";
import type { Order } from "@prisma/client";
import type { OrderListOptions } from "./order.types";

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class OrderMockService {
  /**
   * Get orders with filtering, sorting, and pagination
   */
  getOrders(
    tenantId: string,
    options: OrderListOptions = {}
  ): PaginatedResponse<Omit<Order, "tenant">> {
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

    // Get all mock orders
    let items = getMockOrders(tenantId);

    // Apply filters
    if (status) {
      items = items.filter((order) => order.status === status);
    }

    if (merchantId) {
      items = items.filter((order) => order.merchantId === merchantId);
    }

    if (orderType) {
      items = items.filter((order) => order.orderType === orderType);
    }

    if (dateFrom && dateTo) {
      items = items.filter((order) => {
        const createdAt = new Date(order.createdAt);
        return createdAt >= dateFrom && createdAt <= dateTo;
      });
    }

    // Sort
    items.sort((a, b) => {
      const aVal = a[orderBy];
      const bVal = b[orderBy];

      // Handle Date objects
      if (aVal instanceof Date && bVal instanceof Date) {
        const comparison = aVal.getTime() - bVal.getTime();
        return orderDirection === "asc" ? comparison : -comparison;
      }

      // Handle other types
      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return orderDirection === "asc" ? comparison : -comparison;
    });

    // Paginate
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get order by ID
   */
  getById(
    tenantId: string,
    orderId: string
  ): Omit<Order, "tenant"> | null {
    const orders = getMockOrders(tenantId);
    return orders.find((order) => order.id === orderId) || null;
  }

  /**
   * Get order by order number
   */
  getByOrderNumber(
    tenantId: string,
    orderNumber: string
  ): Omit<Order, "tenant"> | null {
    const orders = getMockOrders(tenantId);
    return orders.find((order) => order.orderNumber === orderNumber) || null;
  }

  /**
   * Get today's orders
   */
  getTodayOrders(tenantId: string): Omit<Order, "tenant">[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = getMockOrders(tenantId);
    return orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
  }
}

export const orderMockService = new OrderMockService();
