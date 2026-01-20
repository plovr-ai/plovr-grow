// ==================== Mock Data for Order Service ====================
// In-memory storage for development without database

import type { OrderStatus, OrderType, OrderItemData, DeliveryAddress } from "@/types";

// ==================== Mock Order Type ====================

export interface MockOrder {
  id: string;
  tenantId: string;
  merchantId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  orderType: OrderType;
  status: OrderStatus;
  items: OrderItemData[];
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
  notes: string | null;
  deliveryAddress: DeliveryAddress | null;
  scheduledAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  merchant: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

// ==================== In-Memory Storage ====================
// Use global to persist across hot reloads in development

declare global {
  var __orderStore: Map<string, MockOrder> | undefined;
  var __merchantOrderSequence: Map<string, number> | undefined;
}

const orderStore: Map<string, MockOrder> =
  global.__orderStore ?? (global.__orderStore = new Map());
const merchantOrderSequence: Map<string, number> =
  global.__merchantOrderSequence ?? (global.__merchantOrderSequence = new Map());

// ==================== Helper Functions ====================

function generateOrderId(): string {
  return `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getMerchantSequenceKey(tenantId: string, merchantId: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `${tenantId}-${merchantId}-${today}`;
}

// ==================== Mock Repository Functions ====================

export function mockCreateOrder(
  tenantId: string,
  merchantId: string,
  data: Omit<MockOrder, "id" | "tenantId" | "merchantId" | "createdAt" | "updatedAt" | "merchant">,
  merchantInfo?: { id: string; name: string; slug: string }
): MockOrder {
  const now = new Date();
  const order: MockOrder = {
    id: generateOrderId(),
    tenantId,
    merchantId,
    ...data,
    createdAt: now,
    updatedAt: now,
    merchant: merchantInfo ?? null,
  };

  orderStore.set(order.id, order);
  return order;
}

export function mockGetOrderById(tenantId: string, orderId: string): MockOrder | null {
  const order = orderStore.get(orderId);
  if (!order || order.tenantId !== tenantId) return null;
  return order;
}

export function mockGetOrderByIdWithMerchant(tenantId: string, orderId: string): MockOrder | null {
  return mockGetOrderById(tenantId, orderId);
}

export function mockGetOrderByNumber(tenantId: string, orderNumber: string): MockOrder | null {
  for (const order of orderStore.values()) {
    if (order.tenantId === tenantId && order.orderNumber === orderNumber) {
      return order;
    }
  }
  return null;
}

export function mockGetNextMerchantOrderSequence(tenantId: string, merchantId: string): number {
  const key = getMerchantSequenceKey(tenantId, merchantId);
  const current = merchantOrderSequence.get(key) ?? 0;
  const next = current + 1;
  merchantOrderSequence.set(key, next);
  return next;
}

export function mockUpdateOrderStatus(
  tenantId: string,
  orderId: string,
  status: OrderStatus,
  additionalData?: Partial<{
    confirmedAt: Date;
    completedAt: Date;
    cancelledAt: Date;
    cancelReason: string;
  }>
): MockOrder | null {
  const order = orderStore.get(orderId);
  if (!order || order.tenantId !== tenantId) return null;

  order.status = status;
  order.updatedAt = new Date();

  if (additionalData) {
    if (additionalData.confirmedAt) order.confirmedAt = additionalData.confirmedAt;
    if (additionalData.completedAt) order.completedAt = additionalData.completedAt;
    if (additionalData.cancelledAt) order.cancelledAt = additionalData.cancelledAt;
    if (additionalData.cancelReason) order.cancelReason = additionalData.cancelReason;
  }

  orderStore.set(orderId, order);
  return order;
}

export function mockGetMerchantOrders(
  tenantId: string,
  merchantId: string,
  options: {
    status?: OrderStatus;
    page?: number;
    pageSize?: number;
  } = {}
): { items: MockOrder[]; total: number; page: number; pageSize: number; totalPages: number } {
  const { status, page = 1, pageSize = 20 } = options;

  let orders = Array.from(orderStore.values()).filter(
    (order) => order.tenantId === tenantId && order.merchantId === merchantId
  );

  if (status) {
    orders = orders.filter((order) => order.status === status);
  }

  // Sort by createdAt descending
  orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = orders.length;
  const start = (page - 1) * pageSize;
  const items = orders.slice(start, start + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function mockGetMerchantTodayOrders(tenantId: string, merchantId: string): MockOrder[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from(orderStore.values())
    .filter(
      (order) =>
        order.tenantId === tenantId &&
        order.merchantId === merchantId &&
        order.createdAt >= today
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function mockCountPendingOrders(tenantId: string, merchantId: string): number {
  return Array.from(orderStore.values()).filter(
    (order) =>
      order.tenantId === tenantId &&
      order.merchantId === merchantId &&
      ["pending", "confirmed", "preparing"].includes(order.status)
  ).length;
}

export function mockGetMerchantStats(
  tenantId: string,
  merchantId: string,
  dateFrom?: Date,
  dateTo?: Date
): {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByType: Record<string, number>;
} {
  let orders = Array.from(orderStore.values()).filter(
    (order) => order.tenantId === tenantId && order.merchantId === merchantId
  );

  if (dateFrom && dateTo) {
    orders = orders.filter(
      (order) => order.createdAt >= dateFrom && order.createdAt <= dateTo
    );
  }

  const completedOrders = orders.filter((o) => o.status !== "cancelled");
  const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  const ordersByStatus: Record<string, number> = {};
  const ordersByType: Record<string, number> = {};

  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
  }

  for (const order of completedOrders) {
    ordersByType[order.orderType] = (ordersByType[order.orderType] || 0) + 1;
  }

  return {
    totalOrders: completedOrders.length,
    totalRevenue,
    averageOrderValue: completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
    ordersByStatus,
    ordersByType,
  };
}

// ==================== Debug Helpers ====================

export function mockGetAllOrders(): MockOrder[] {
  return Array.from(orderStore.values());
}

export function mockClearOrders(): void {
  orderStore.clear();
  merchantOrderSequence.clear();
}
