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
  CreateMerchantOrderInput,
  CreateCompanyOrderInput,
  OrderCalculation,
  CompanyOrderListOptions,
  TimelineEvent,
  OrderWithTimeline,
} from "./order.types";

export class OrderService {
  /**
   * Create a merchant order (regular orders with menu items)
   * Uses atomic sequence generation to prevent race conditions
   */
  async createMerchantOrder(tenantId: string, input: CreateMerchantOrderInput) {
    const { companyId, merchantId } = input;

    // Validate menu items exist and are available
    const itemIds = input.items.map((item) => item.menuItemId);
    const menuItems = await menuService.getMenuItemsByIds(tenantId, merchantId, itemIds);

    if (menuItems.length !== itemIds.length) {
      throw new Error("Some menu items are not available");
    }

    // Calculate order totals
    const calculation = await this.calculateOrderTotals(tenantId, merchantId, input);

    // Calculate payment breakdown
    const giftCardPayment = input.giftCardPayment ?? 0;
    const cashPayment = Math.max(0, calculation.totalAmount - giftCardPayment);

    // Get merchant timezone for accurate date-based sequencing
    const merchant = await merchantService.getMerchantById(merchantId);
    const timezone = merchant?.timezone;

    // Get current date in merchant's timezone (format: "2026-01-27")
    const dateStr = timezone
      ? getTodayInTimezone(timezone)
      : new Date().toISOString().slice(0, 10);

    // Generate order number using atomic sequence
    const sequence = await sequenceRepository.getNextOrderSequence(tenantId, merchantId, dateStr);
    const orderNumber = generateOrderNumber(sequence, timezone);

    const salesChannel = input.salesChannel ?? "online_order";

    // Create the order in database
    const order = await orderRepository.create(
      tenantId,
      companyId,
      merchantId,
      {
        orderNumber,
        customerFirstName: input.customerFirstName,
        customerLastName: input.customerLastName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        orderMode: input.orderMode,
        salesChannel,
        status: "created",
        fulfillmentStatus: "pending",
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

    // Emit order created event
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
      salesChannel,
      totalAmount: calculation.totalAmount,
      items: input.items,
    });

    return order;
  }

  /**
   * Create a company order (e.g., giftcards, virtual products)
   * These orders are not associated with a specific merchant
   */
  async createCompanyOrder(tenantId: string, input: CreateCompanyOrderInput) {
    const { companyId } = input;

    // Calculate order totals (simple sum, no tax/tip/delivery for company orders)
    const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalAmount = Math.round(subtotal * 100) / 100;

    // Calculate payment breakdown
    const giftCardPayment = input.giftCardPayment ?? 0;
    const cashPayment = Math.max(0, totalAmount - giftCardPayment);

    // Get current date for sequencing (use UTC since no merchant timezone)
    const dateStr = new Date().toISOString().slice(0, 10);

    // Generate order number using atomic sequence
    const sequence = await sequenceRepository.getNextCompanyOrderSequence(tenantId, companyId, dateStr);
    const orderNumber = generateGiftcardOrderNumber(sequence);

    // Create the order in database
    const order = await orderRepository.create(
      tenantId,
      companyId,
      null, // No merchant for company orders
      {
        orderNumber,
        customerFirstName: input.customerFirstName,
        customerLastName: input.customerLastName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        orderMode: "pickup", // Default for company orders
        salesChannel: "giftcard",
        status: "created",
        fulfillmentStatus: "pending",
        items: input.items as unknown as Prisma.InputJsonValue,
        subtotal: totalAmount,
        taxAmount: 0,
        tipAmount: 0,
        deliveryFee: 0,
        discount: 0,
        giftCardPayment: Math.round(giftCardPayment * 100) / 100,
        cashPayment: Math.round(cashPayment * 100) / 100,
        totalAmount,
        notes: input.notes ?? null,
        deliveryAddress: Prisma.JsonNull,
        scheduledAt: null,
      },
      input.loyaltyMemberId
    );

    return order;
  }

  /**
   * Calculate order totals with per-item tax calculation
   * Uses unified pricing module for consistency with client-side calculation
   */
  async calculateOrderTotals(
    _tenantId: string,
    merchantId: string,
    input: Pick<CreateMerchantOrderInput, "items" | "orderMode" | "tipAmount" | "discountCode">
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
