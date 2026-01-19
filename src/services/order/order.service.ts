// ==================== Order Service ====================
// Uses OrderRepository (Prisma) for database operations.

import { Prisma } from "@prisma/client";
import { menuService } from "@/services/menu";
import { orderRepository } from "@/repositories/order.repository";
import { generateOrderNumber } from "@/lib/utils";
import { calculateOrderPricing, type PricingItem, type TipInput } from "@/lib/pricing";
import { orderEventEmitter } from "./order-events";
import type {
  CreateOrderInput,
  OrderCalculation,
  UpdateOrderStatusInput,
  MerchantOrderListOptions,
  TimelineEvent,
  OrderWithTimeline,
} from "./order.types";
import type { OrderStatus } from "@/types";

export class OrderService {
  /**
   * Create a new order for a merchant
   */
  async createOrder(tenantId: string, input: CreateOrderInput) {
    const { merchantId } = input;

    // Validate menu items exist and are available
    const itemIds = input.items.map((item) => item.menuItemId);
    const menuItems = await menuService.getMenuItemsByIds(tenantId, merchantId, itemIds);

    if (menuItems.length !== itemIds.length) {
      throw new Error("Some menu items are not available");
    }

    // Calculate order totals
    const calculation = await this.calculateOrderTotals(tenantId, merchantId, input);

    // Generate order number (merchant-specific sequence)
    const sequence = await orderRepository.getNextMerchantOrderSequence(tenantId, merchantId);
    const orderNumber = generateOrderNumber(sequence);

    // Create the order in database
    const order = await orderRepository.create(tenantId, merchantId, {
      orderNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      orderType: input.orderType,
      status: "pending",
      items: input.items as unknown as Prisma.InputJsonValue,
      subtotal: calculation.subtotal,
      taxAmount: calculation.taxAmount,
      tipAmount: calculation.tipAmount,
      deliveryFee: calculation.deliveryFee,
      discount: calculation.discount,
      totalAmount: calculation.totalAmount,
      notes: input.notes ?? null,
      deliveryAddress: input.deliveryAddress
        ? (input.deliveryAddress as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      scheduledAt: input.scheduledAt ?? null,
    });

    // Emit order created event
    orderEventEmitter.emit("order.created", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      merchantId,
      tenantId,
      status: "pending",
      timestamp: new Date(),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      orderType: input.orderType,
      totalAmount: calculation.totalAmount,
      items: input.items,
    });

    return order;
  }

  /**
   * Calculate order totals with per-item tax calculation
   * Uses unified pricing module for consistency with client-side calculation
   */
  async calculateOrderTotals(
    _tenantId: string,
    merchantId: string,
    input: Pick<CreateOrderInput, "items" | "orderType" | "tipAmount" | "discountCode">
  ): Promise<OrderCalculation> {
    // Convert to PricingItem using taxes from cart items directly
    // Frontend already passes complete tax info (rate, roundingMethod)
    const pricingItems: PricingItem[] = input.items.map((item) => ({
      itemId: item.menuItemId,
      unitPrice: item.totalPrice / item.quantity,
      quantity: item.quantity,
      taxes: (item.taxes || []).map((t) => ({
        rate: t.rate,
        roundingMethod: t.roundingMethod,
      })),
    }));

    // Convert tipAmount to TipInput (fixed amount)
    const tip: TipInput | null = input.tipAmount
      ? { type: "fixed", amount: input.tipAmount }
      : null;

    // Calculate pricing using unified module
    const pricing = calculateOrderPricing(pricingItems, tip);

    // Calculate delivery fee (TODO: get from merchant settings)
    // merchantId can be used to fetch merchant-specific delivery fee configuration
    void merchantId; // Reserved for future merchant-specific fee configuration
    const deliveryFee = input.orderType === "delivery" ? 3.99 : 0;

    // Calculate discount (TODO: implement discount service)
    // When implemented, discountCode will be validated and discount calculated
    const discount = 0;
    void input.discountCode; // Reserved for future discount code implementation

    const totalAmount = pricing.totalAmount + deliveryFee - discount;

    return {
      subtotal: pricing.subtotal,
      taxAmount: pricing.taxAmount,
      taxBreakdown: [], // Simplified, no breakdown needed for now
      feesAmount: pricing.feesAmount,
      feesBreakdown: pricing.feesBreakdown,
      tipAmount: pricing.tipAmount,
      deliveryFee: Math.round(deliveryFee * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  /**
   * Get order by ID with merchant info
   */
  async getOrder(tenantId: string, orderId: string) {
    return orderRepository.getByIdWithMerchant(tenantId, orderId);
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(tenantId: string, orderNumber: string) {
    return orderRepository.getByOrderNumber(tenantId, orderNumber);
  }

  /**
   * Get order with timeline for Order Detail page
   */
  async getOrderWithTimeline(
    tenantId: string,
    orderId: string
  ): Promise<OrderWithTimeline | null> {
    const order = await orderRepository.getByIdWithMerchant(tenantId, orderId);
    if (!order) return null;

    const timeline = this.buildTimeline(order);
    return { ...order, timeline };
  }

  /**
   * Build timeline from order timestamp fields
   */
  private buildTimeline(order: {
    status: string;
    createdAt: Date;
    confirmedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
  }): TimelineEvent[] {
    const events: TimelineEvent[] = [
      { status: "pending", timestamp: order.createdAt },
    ];

    if (order.confirmedAt) {
      events.push({ status: "confirmed", timestamp: order.confirmedAt });
    }

    // For preparing and ready, we infer from current status since we don't track timestamps
    // In a real system, you would add preparingAt and readyAt fields to the database
    const status = order.status as OrderStatus;
    if (["preparing", "ready", "completed"].includes(status) && order.confirmedAt) {
      // Preparing started after confirmation
      events.push({ status: "preparing", timestamp: order.confirmedAt });
    }

    if (["ready", "completed"].includes(status) && order.confirmedAt) {
      // Ready after preparing
      events.push({ status: "ready", timestamp: order.confirmedAt });
    }

    if (order.completedAt) {
      events.push({ status: "completed", timestamp: order.completedAt });
    }

    if (order.cancelledAt) {
      events.push({ status: "cancelled", timestamp: order.cancelledAt });
    }

    return events;
  }

  // ==================== Merchant Order Management ====================

  /**
   * Get orders for a specific merchant (for Dashboard)
   */
  async getMerchantOrders(
    tenantId: string,
    merchantId: string,
    options: MerchantOrderListOptions = {}
  ) {
    return orderRepository.getMerchantOrders(tenantId, merchantId, options);
  }

  /**
   * Get today's orders for a merchant
   */
  async getMerchantTodayOrders(tenantId: string, merchantId: string) {
    return orderRepository.getMerchantTodayOrders(tenantId, merchantId);
  }

  /**
   * Get merchant order statistics
   */
  async getMerchantOrderStats(
    tenantId: string,
    merchantId: string,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    return orderRepository.getMerchantStats(tenantId, merchantId, dateFrom, dateTo);
  }

  /**
   * Count pending orders for a merchant (for Dashboard badge)
   */
  async countMerchantPendingOrders(tenantId: string, merchantId: string) {
    return orderRepository.countPendingOrders(tenantId, merchantId);
  }

  /**
   * Update order status with validation and event emission
   */
  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    input: UpdateOrderStatusInput
  ) {
    // Get current order to validate transition and get merchantId
    const currentOrder = await this.getOrder(tenantId, orderId);
    if (!currentOrder) {
      throw new Error("Order not found");
    }

    const previousStatus = currentOrder.status as OrderStatus;

    // Validate status transition
    const isValid = this.validateStatusTransition(previousStatus, input.status);
    if (!isValid) {
      throw new Error(
        `Invalid status transition from ${previousStatus} to ${input.status}`
      );
    }

    const additionalData: Partial<{
      confirmedAt: Date;
      completedAt: Date;
      cancelledAt: Date;
      cancelReason: string;
    }> = {};

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

    // Update order status in database
    const updatedOrder = await orderRepository.updateStatusAndReturn(
      tenantId,
      orderId,
      input.status,
      additionalData
    );

    // Emit status change event (only for valid status transitions)
    if (currentOrder.merchantId && input.status !== "pending") {
      const eventType = `order.${input.status}` as
        | "order.confirmed"
        | "order.preparing"
        | "order.ready"
        | "order.completed"
        | "order.cancelled";
      orderEventEmitter.emit(eventType, {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        merchantId: currentOrder.merchantId,
        tenantId,
        status: input.status,
        previousStatus,
        timestamp: new Date(),
        ...(input.cancelReason && { cancelReason: input.cancelReason }),
      });
    }

    return updatedOrder;
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
