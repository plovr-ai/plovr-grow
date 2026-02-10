// ==================== Order Service ====================
// Uses OrderRepository (Prisma) for database operations.

import { Prisma } from "@prisma/client";
import { menuService } from "@/services/menu";
import { merchantService } from "@/services/merchant";
import { orderRepository } from "@/repositories/order.repository";
import { sequenceRepository } from "@/repositories/sequence.repository";
import { pointTransactionRepository } from "@/repositories/point-transaction.repository";
import { generateOrderNumber, generateGiftcardOrderNumber } from "@/lib/utils";
import { getTodayInTimezone } from "@/lib/timezone";
import { calculateOrderPricing, type PricingItem, type TipInput } from "@/lib/pricing";
import { orderEventEmitter } from "./order-events";
import type {
  CreateOrderInput,
  OrderCalculation,
  CompanyOrderListOptions,
  TimelineEvent,
  OrderWithTimeline,
} from "./order.types";

export class OrderService {
  /**
   * Create a new order for a merchant or Company (giftcards)
   * Uses atomic sequence generation to prevent race conditions
   */
  async createOrder(tenantId: string, input: CreateOrderInput) {
    const { companyId, merchantId } = input;

    // Skip menu item validation for giftcards (virtual items)
    if (input.salesChannel !== "giftcard") {
      if (!merchantId) {
        throw new Error("merchantId is required for non-giftcard orders");
      }

      // Validate menu items exist and are available
      const itemIds = input.items.map((item) => item.menuItemId);
      const menuItems = await menuService.getMenuItemsByIds(tenantId, merchantId, itemIds);

      if (menuItems.length !== itemIds.length) {
        throw new Error("Some menu items are not available");
      }
    }

    // Calculate order totals
    const calculation = await this.calculateOrderTotals(tenantId, merchantId, input);

    // Calculate payment breakdown
    const giftCardPayment = input.giftCardPayment ?? 0;
    const cashPayment = Math.max(0, calculation.totalAmount - giftCardPayment);

    // Get merchant timezone for accurate date-based sequencing
    let timezone: string | undefined;
    if (merchantId) {
      const merchant = await merchantService.getMerchantById(merchantId);
      timezone = merchant?.timezone;
    }

    // Get current date in merchant's timezone (format: "2026-01-27")
    const dateStr = timezone
      ? getTodayInTimezone(timezone)
      : new Date().toISOString().slice(0, 10);

    // Generate order number using atomic sequence (no retry needed)
    const sequence = merchantId
      ? await sequenceRepository.getNextOrderSequence(tenantId, merchantId, dateStr)
      : await sequenceRepository.getNextCompanyOrderSequence(tenantId, companyId, dateStr);

    const orderNumber = merchantId
      ? generateOrderNumber(sequence, timezone)
      : generateGiftcardOrderNumber(sequence, timezone);

    // Create the order in database
    const order = await orderRepository.create(
      tenantId,
      companyId,
      merchantId ?? null,
      {
        orderNumber,
        customerFirstName: input.customerFirstName,
        customerLastName: input.customerLastName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        orderMode: input.orderMode,
        salesChannel: input.salesChannel ?? "online_order",
        status: "created",              // Payment status: order created, not yet paid
        fulfillmentStatus: "pending",   // Fulfillment status: waiting to start
        items: input.items as unknown as Prisma.InputJsonValue,
        subtotal: calculation.subtotal,
        taxAmount: calculation.taxAmount,
        tipAmount: calculation.tipAmount,
        deliveryFee: calculation.deliveryFee,
        discount: calculation.discount,
        giftCardPayment: Math.round(giftCardPayment * 100) / 100,
        cashPayment: Math.round(cashPayment * 100) / 100,
        totalAmount: calculation.totalAmount,
        notes: input.notes ?? null,
        deliveryAddress: input.deliveryAddress
          ? (input.deliveryAddress as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        scheduledAt: input.scheduledAt ?? null,
      },
      input.loyaltyMemberId
    );

    // Emit order created event (only for merchant orders for now)
    if (merchantId) {
      orderEventEmitter.emit("order.created", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        merchantId,
        tenantId,
        status: "created",
        fulfillmentStatus: "pending",
        timestamp: new Date(),
        customerFirstName: input.customerFirstName,
        customerLastName: input.customerLastName,
        customerPhone: input.customerPhone,
        orderMode: input.orderMode,
        salesChannel: input.salesChannel ?? "online_order",
        totalAmount: calculation.totalAmount,
        items: input.items,
      });
    }

    return order;
  }

  /**
   * Calculate order totals with per-item tax calculation
   * Uses unified pricing module for consistency with client-side calculation
   */
  async calculateOrderTotals(
    _tenantId: string,
    merchantId: string | undefined,
    input: Pick<CreateOrderInput, "items" | "orderMode" | "tipAmount" | "discountCode">
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
    const deliveryFee = input.orderMode === "delivery" ? 3.99 : 0;

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
   * Get order with timeline for Order Detail page
   */
  async getOrderWithTimeline(
    tenantId: string,
    orderId: string
  ): Promise<OrderWithTimeline | null> {
    const order = await orderRepository.getByIdWithMerchant(tenantId, orderId);
    if (!order) return null;

    const timeline = this.buildTimeline(order);

    // Fetch points earned for this order (if any)
    const pointTransaction = await pointTransactionRepository.getByOrderId(tenantId, orderId);
    const pointsEarned =
      pointTransaction && pointTransaction.type === "earn" ? pointTransaction.points : undefined;

    return { ...order, timeline, pointsEarned };
  }

  /**
   * Build timeline from order timestamp fields
   * Includes both payment events and fulfillment events
   */
  private buildTimeline(order: {
    status: string;
    fulfillmentStatus: string;
    createdAt: Date;
    paidAt: Date | null;
    confirmedAt: Date | null;
    preparingAt: Date | null;
    readyAt: Date | null;
    fulfilledAt: Date | null;
    cancelledAt: Date | null;
  }): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Payment events
    events.push({ type: "payment", status: "created", timestamp: order.createdAt });

    if (order.paidAt) {
      events.push({ type: "payment", status: "completed", timestamp: order.paidAt });
    }

    // Fulfillment events
    if (order.confirmedAt) {
      events.push({ type: "fulfillment", status: "confirmed", timestamp: order.confirmedAt });
    }

    if (order.preparingAt) {
      events.push({ type: "fulfillment", status: "preparing", timestamp: order.preparingAt });
    }

    if (order.readyAt) {
      events.push({ type: "fulfillment", status: "ready", timestamp: order.readyAt });
    }

    if (order.fulfilledAt) {
      events.push({ type: "fulfillment", status: "fulfilled", timestamp: order.fulfilledAt });
    }

    // Cancellation (payment event)
    if (order.cancelledAt) {
      events.push({ type: "payment", status: "canceled", timestamp: order.cancelledAt });
    }

    // Sort by timestamp
    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // ==================== Company Order Management ====================

  /**
   * Get orders for a company (all merchants under the company, for Dashboard)
   */
  async getCompanyOrders(
    tenantId: string,
    companyId: string,
    options: CompanyOrderListOptions = {}
  ) {
    return orderRepository.getCompanyOrders(tenantId, companyId, options);
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
   * Count active orders for a merchant (for Dashboard badge)
   * Active = paid but not yet fulfilled
   */
  async countMerchantActiveOrders(tenantId: string, merchantId: string) {
    return orderRepository.countActiveOrders(tenantId, merchantId);
  }

  /**
   * Update payment status with validation and event emission
   */
  async updatePaymentStatus(
    tenantId: string,
    orderId: string,
    input: UpdateOrderStatusInput
  ) {
    // Get current order to validate transition and get merchantId
    const currentOrder = await this.getOrder(tenantId, orderId);
    if (!currentOrder) {
      throw new AppError(ErrorCodes.ORDER_NOT_FOUND, undefined, 404);
    }

    const previousStatus = currentOrder.status as OrderStatus;

    // Validate payment status transition
    const isValid = this.validatePaymentStatusTransition(previousStatus, input.status);
    if (!isValid) {
      throw new AppError(
        ErrorCodes.INVALID_PAYMENT_STATUS_TRANSITION,
        { from: previousStatus, to: input.status },
        400
      );
    }

    const additionalData: Partial<{
      paidAt: Date;
      cancelledAt: Date;
      cancelReason: string;
    }> = {};

    switch (input.status) {
      case "completed":
        additionalData.paidAt = new Date();
        break;
      case "canceled":
        additionalData.cancelledAt = new Date();
        if (input.cancelReason) {
          additionalData.cancelReason = input.cancelReason;
        }
        break;
    }

    // Update payment status in database
    const updatedOrder = await orderRepository.updateStatusAndReturn(
      tenantId,
      orderId,
      input.status,
      additionalData
    );

    // Emit payment status change event
    if (currentOrder.merchantId) {
      if (input.status === "completed") {
        orderEventEmitter.emit("order.paid", {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          merchantId: currentOrder.merchantId,
          tenantId,
          status: input.status,
          previousStatus,
          timestamp: new Date(),
        });
      } else if (input.status === "canceled") {
        orderEventEmitter.emit("order.cancelled", {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          merchantId: currentOrder.merchantId,
          tenantId,
          status: input.status,
          previousStatus,
          timestamp: new Date(),
          cancelReason: input.cancelReason,
        });
      }
    }

    return updatedOrder;
  }

  /**
   * Update fulfillment status with validation and event emission
   * BUSINESS RULE: Only allowed when payment status = "completed"
   */
  async updateFulfillmentStatus(
    tenantId: string,
    orderId: string,
    input: UpdateFulfillmentStatusInput
  ) {
    // Get current order to validate transition and get merchantId
    const currentOrder = await this.getOrder(tenantId, orderId);
    if (!currentOrder) {
      throw new AppError(ErrorCodes.ORDER_NOT_FOUND, undefined, 404);
    }

    // Business rule: Only paid orders can have fulfillment status changed
    if (currentOrder.status !== "completed") {
      throw new AppError(ErrorCodes.FULFILLMENT_REQUIRES_PAYMENT, undefined, 400);
    }

    const previousFulfillmentStatus = currentOrder.fulfillmentStatus as FulfillmentStatus;

    // Validate fulfillment status transition
    const isValid = this.validateFulfillmentStatusTransition(
      previousFulfillmentStatus,
      input.fulfillmentStatus
    );
    if (!isValid) {
      throw new AppError(
        ErrorCodes.INVALID_FULFILLMENT_STATUS_TRANSITION,
        { from: previousFulfillmentStatus, to: input.fulfillmentStatus },
        400
      );
    }

    const additionalData: Partial<{
      confirmedAt: Date;
      preparingAt: Date;
      readyAt: Date;
      fulfilledAt: Date;
    }> = {};

    switch (input.fulfillmentStatus) {
      case "confirmed":
        additionalData.confirmedAt = new Date();
        break;
      case "preparing":
        additionalData.preparingAt = new Date();
        break;
      case "ready":
        additionalData.readyAt = new Date();
        break;
      case "fulfilled":
        additionalData.fulfilledAt = new Date();
        break;
    }

    // Update fulfillment status in database
    const updatedOrder = await orderRepository.updateFulfillmentStatusAndReturn(
      tenantId,
      orderId,
      input.fulfillmentStatus,
      additionalData
    );

    // Emit fulfillment status change event
    if (currentOrder.merchantId) {
      const eventType = `order.fulfillment.${input.fulfillmentStatus}` as
        | "order.fulfillment.confirmed"
        | "order.fulfillment.preparing"
        | "order.fulfillment.ready"
        | "order.fulfillment.fulfilled";
      orderEventEmitter.emit(eventType, {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        merchantId: currentOrder.merchantId,
        tenantId,
        fulfillmentStatus: input.fulfillmentStatus,
        previousFulfillmentStatus,
        timestamp: new Date(),
      });
    }

    return updatedOrder;
  }

  /**
   * Validate payment status transition
   */
  validatePaymentStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
  ): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      created: ["partial_paid", "completed", "canceled"],
      partial_paid: ["completed", "canceled"],
      completed: [],
      canceled: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  /**
   * Validate fulfillment status transition
   */
  validateFulfillmentStatusTransition(
    currentStatus: FulfillmentStatus,
    newStatus: FulfillmentStatus
  ): boolean {
    const validTransitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
      pending: ["confirmed"],
      confirmed: ["preparing"],
      preparing: ["ready"],
      ready: ["fulfilled"],
      fulfilled: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  /**
   * @deprecated Use updatePaymentStatus instead
   */
  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    input: UpdateOrderStatusInput
  ) {
    return this.updatePaymentStatus(tenantId, orderId, input);
  }

  /**
   * @deprecated Use validatePaymentStatusTransition instead
   */
  validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
  ): boolean {
    return this.validatePaymentStatusTransition(currentStatus, newStatus);
  }

  /**
   * Link an existing order to a loyalty member
   * Used when a guest registers after placing an order
   */
  async linkLoyaltyMember(
    tenantId: string,
    orderId: string,
    loyaltyMemberId: string
  ) {
    return orderRepository.updateLoyaltyMemberId(tenantId, orderId, loyaltyMemberId);
  }

  /**
   * Get orders for a loyalty member with pagination
   */
  async getMemberOrders(
    tenantId: string,
    loyaltyMemberId: string,
    options?: {
      page?: number;
      pageSize?: number;
    }
  ) {
    return orderRepository.getOrdersByLoyaltyMember(tenantId, loyaltyMemberId, options);
  }
}

export const orderService = new OrderService();
