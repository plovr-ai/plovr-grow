// ==================== Order Service ====================
// Currently uses mock data. Will be replaced with Repository layer later.

import { menuService, taxConfigService } from "@/services/menu";
import { merchantService } from "@/services/merchant";
import { generateOrderNumber } from "@/lib/utils";
import { calculateOrderPricing, type PricingItem, type TipInput } from "@/lib/pricing";
import { orderEventEmitter } from "./order-events";
import {
  mockCreateOrder,
  mockGetOrderByIdWithMerchant,
  mockGetOrderByNumber,
  mockGetNextMerchantOrderSequence,
  mockUpdateOrderStatus,
  mockGetMerchantOrders,
  mockGetMerchantTodayOrders,
  mockCountPendingOrders,
  mockGetMerchantStats,
} from "./order.mock";
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
    const menuItems = await menuService.getMenuItemsByIds(tenantId, itemIds);

    if (menuItems.length !== itemIds.length) {
      throw new Error("Some menu items are not available");
    }

    // Get merchant info for the order
    const merchant = await merchantService.getMerchant(merchantId);
    const merchantInfo = merchant
      ? { id: merchant.id, name: merchant.name, slug: merchant.slug }
      : undefined;

    // Calculate order totals
    const calculation = await this.calculateOrderTotals(tenantId, merchantId, input);

    // Generate order number (merchant-specific sequence)
    // TODO: Replace with orderRepository.getNextMerchantOrderSequence
    const sequence = mockGetNextMerchantOrderSequence(tenantId, merchantId);
    const orderNumber = generateOrderNumber(sequence);

    // Create the order with merchantId
    // TODO: Replace with orderRepository.create
    const order = mockCreateOrder(
      tenantId,
      merchantId,
      {
        orderNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        orderType: input.orderType,
        status: "pending",
        items: input.items,
        subtotal: calculation.subtotal,
        taxAmount: calculation.taxAmount,
        tipAmount: calculation.tipAmount,
        deliveryFee: calculation.deliveryFee,
        discount: calculation.discount,
        totalAmount: calculation.totalAmount,
        notes: input.notes ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        scheduledAt: input.scheduledAt ?? null,
        confirmedAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
      merchantInfo
    );

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
    tenantId: string,
    merchantId: string,
    input: Pick<CreateOrderInput, "items" | "orderType" | "tipAmount" | "discountCode">
  ): Promise<OrderCalculation> {
    // Collect all unique tax config IDs from items
    const taxConfigIds = input.items
      .map((item) => item.taxConfigId)
      .filter((id): id is string => id != null);

    // Get tax configs for calculation
    const taxConfigMap = await taxConfigService.getTaxConfigsMap(
      tenantId,
      taxConfigIds
    );

    // Convert to PricingItem with embedded tax config values
    const pricingItems: PricingItem[] = input.items.map((item) => {
      const taxConfig = item.taxConfigId
        ? taxConfigMap.get(item.taxConfigId)
        : null;

      return {
        itemId: item.menuItemId,
        unitPrice: item.totalPrice / item.quantity,
        quantity: item.quantity,
        tax: taxConfig
          ? { rate: Number(taxConfig.rate), roundingMethod: taxConfig.roundingMethod }
          : null,
      };
    });

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
    // TODO: Replace with orderRepository.getByIdWithMerchant
    return mockGetOrderByIdWithMerchant(tenantId, orderId);
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(tenantId: string, orderNumber: string) {
    // TODO: Replace with orderRepository.getByOrderNumber
    return mockGetOrderByNumber(tenantId, orderNumber);
  }

  /**
   * Get order with timeline for Order Detail page
   */
  async getOrderWithTimeline(
    tenantId: string,
    orderId: string
  ): Promise<OrderWithTimeline | null> {
    // TODO: Replace with orderRepository.getByIdWithMerchant
    const order = mockGetOrderByIdWithMerchant(tenantId, orderId);
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
    // TODO: Replace with orderRepository.getMerchantOrders
    return mockGetMerchantOrders(tenantId, merchantId, options);
  }

  /**
   * Get today's orders for a merchant
   */
  async getMerchantTodayOrders(tenantId: string, merchantId: string) {
    // TODO: Replace with orderRepository.getMerchantTodayOrders
    return mockGetMerchantTodayOrders(tenantId, merchantId);
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
    // TODO: Replace with orderRepository.getMerchantStats
    return mockGetMerchantStats(tenantId, merchantId, dateFrom, dateTo);
  }

  /**
   * Count pending orders for a merchant (for Dashboard badge)
   */
  async countMerchantPendingOrders(tenantId: string, merchantId: string) {
    // TODO: Replace with orderRepository.countPendingOrders
    return mockCountPendingOrders(tenantId, merchantId);
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

    // TODO: Replace with orderRepository.updateStatusAndReturn
    const updatedOrder = mockUpdateOrderStatus(
      tenantId,
      orderId,
      input.status,
      additionalData
    );

    if (!updatedOrder) {
      throw new Error("Failed to update order status");
    }

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
