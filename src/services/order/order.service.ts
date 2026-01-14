import { orderRepository } from "@/repositories/order.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import { menuService } from "@/services/menu";
import { generateOrderNumber, calculateTax } from "@/lib/utils";
import type {
  CreateOrderInput,
  OrderCalculation,
  UpdateOrderStatusInput,
  OrderListOptions,
} from "./order.types";
import type { OrderStatus } from "@/types";

export class OrderService {
  /**
   * Create a new order
   */
  async createOrder(tenantId: string, input: CreateOrderInput) {
    // Validate menu items exist and are available
    const itemIds = input.items.map((item) => item.menuItemId);
    const menuItems = await menuService.getMenuItemsByIds(tenantId, itemIds);

    if (menuItems.length !== itemIds.length) {
      throw new Error("Some menu items are not available");
    }

    // Calculate order totals
    const calculation = await this.calculateOrderTotals(tenantId, input);

    // Generate order number
    const sequence = await orderRepository.getNextOrderSequence(tenantId);
    const orderNumber = generateOrderNumber(sequence);

    // Create the order
    const order = await orderRepository.create(tenantId, {
      orderNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      orderType: input.orderType,
      status: "pending",
      items: JSON.parse(JSON.stringify(input.items)),
      subtotal: calculation.subtotal,
      taxAmount: calculation.taxAmount,
      tipAmount: calculation.tipAmount,
      deliveryFee: calculation.deliveryFee,
      discount: calculation.discount,
      totalAmount: calculation.totalAmount,
      notes: input.notes,
      deliveryAddress: input.deliveryAddress
        ? JSON.parse(JSON.stringify(input.deliveryAddress))
        : null,
      scheduledAt: input.scheduledAt,
    });

    return order;
  }

  /**
   * Calculate order totals
   */
  async calculateOrderTotals(
    tenantId: string,
    input: Pick<CreateOrderInput, "items" | "orderType" | "tipAmount">
  ): Promise<OrderCalculation> {
    // Calculate subtotal from items
    const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);

    // Get tax rate from merchant
    const taxRate = await merchantRepository.getTaxRate(tenantId);
    const taxAmount = calculateTax(subtotal, taxRate);

    // Calculate delivery fee (if applicable)
    const deliveryFee = input.orderType === "delivery" ? 3.99 : 0; // TODO: Make configurable

    const tipAmount = input.tipAmount || 0;
    const discount = 0; // TODO: Implement discount/coupon system

    const totalAmount = subtotal + taxAmount + tipAmount + deliveryFee - discount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      tipAmount: Math.round(tipAmount * 100) / 100,
      deliveryFee: Math.round(deliveryFee * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  /**
   * Get order by ID
   */
  async getOrder(tenantId: string, orderId: string) {
    return orderRepository.getById(tenantId, orderId);
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(tenantId: string, orderNumber: string) {
    return orderRepository.getByOrderNumber(tenantId, orderNumber);
  }

  /**
   * Get orders list with pagination
   */
  async getOrders(tenantId: string, options: OrderListOptions = {}) {
    return orderRepository.getOrders(tenantId, options);
  }

  /**
   * Get today's orders
   */
  async getTodayOrders(tenantId: string) {
    return orderRepository.getTodayOrders(tenantId);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    input: UpdateOrderStatusInput
  ) {
    const additionalData: Record<string, Date | string> = {};

    switch (input.status) {
      case "confirmed":
        additionalData.confirmedAt = new Date();
        break;
      case "completed":
        additionalData.completedAt = new Date();
        break;
      case "cancelled":
        additionalData.cancelledAt = new Date();
        if (input.cancelReason) {
          additionalData.cancelReason = input.cancelReason;
        }
        break;
    }

    return orderRepository.updateStatus(
      tenantId,
      orderId,
      input.status,
      additionalData
    );
  }

  /**
   * Get order statistics
   */
  async getOrderStats(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    return orderRepository.getStats(tenantId, dateFrom, dateTo);
  }

  /**
   * Validate order status transition
   */
  validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
  ): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }
}

export const orderService = new OrderService();
