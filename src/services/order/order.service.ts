// ==================== Order Service ====================
// Uses OrderRepository (Prisma) for database operations.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import { menuService } from "@/services/menu";
import { giftCardService } from "@/services/giftcard";
import { paymentService } from "@/services/payment";
import { merchantService } from "@/services/merchant";
import { orderRepository } from "@/repositories/order.repository";
import { sequenceRepository } from "@/repositories/sequence.repository";
import { pointTransactionRepository } from "@/repositories/point-transaction.repository";
import { generateOrderNumber, generateGiftcardOrderNumber } from "@/lib/utils";
import { getTodayInTimezone } from "@/lib/timezone";
import { calculateOrderPricing, type PricingItem, type TipInput } from "@/lib/pricing";
import { taxConfigRepository } from "@/repositories/tax-config.repository";
import type { RoundingMethod } from "@/services/menu/tax-config.types";
import { orderEventEmitter } from "./order-events";
import type { OrderEventSource } from "./order-events.types";
import type { FulfillmentStatus, OrderStatus } from "@/types";
import { AppError, ErrorCodes } from "@/lib/errors";
import type {
  CreateMerchantOrderInput,
  CreateGiftCardOrderInput,
  OrderCalculation,
  TenantOrderListOptions,
  TimelineEvent,
  OrderWithTimeline,
} from "./order.types";
import type { OrderItemWithModifiers } from "@/repositories/order.repository";
import type { OrderItemData, SelectedModifier, ItemTaxInfo } from "@/types";

export interface StatusUpdateOptions {
  source?: OrderEventSource;
  squareOrderVersion?: number;
}

/**
 * Convert a Prisma OrderItem (with modifiers) to the application-level OrderItemData.
 * Handles Decimal → number conversion and field name mapping.
 */
export function mapOrderItemToData(item: OrderItemWithModifiers): OrderItemData {
  const selectedModifiers: SelectedModifier[] = item.modifiers.map((mod) => ({
    groupId: mod.modifierGroupId,
    groupName: mod.groupName,
    modifierId: mod.modifierOptionId,
    modifierName: mod.name,
    price: Number(mod.price),
    quantity: mod.quantity,
  }));

  return {
    menuItemId: item.menuItemId,
    name: item.name,
    price: Number(item.unitPrice),
    quantity: item.quantity,
    selectedModifiers,
    specialInstructions: item.notes ?? undefined,
    totalPrice: Number(item.totalPrice),
    taxes: (item.taxes as ItemTaxInfo[] | null) ?? undefined,
    imageUrl: item.imageUrl,
  };
}

export class OrderService {
  /**
   * Create a merchant order (regular orders with menu items)
   * Uses atomic sequence generation to prevent race conditions
   */
  async createMerchantOrder(tenantId: string, input: CreateMerchantOrderInput, tx?: DbClient) {
    const { merchantId } = input;

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
    const sequence = await sequenceRepository.getNextOrderSequence(tenantId, merchantId, dateStr, tx);
    const orderNumber = generateOrderNumber(sequence, timezone);

    const salesChannel = input.salesChannel ?? "online_order";

    // Create the order in database (dual-write: JSON snapshot + structured OrderItem rows)
    const order = await orderRepository.create(
      tenantId,
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
      input.loyaltyMemberId,
      tx,
      input.items
    );

    // Emit order created event (only when not inside a transaction —
    // callers using transactions should emit after commit)
    if (!tx) {
      this.emitOrderCreatedEvent(tenantId, order, input, calculation.totalAmount);
    }

    return order;
  }

  /**
   * Create a merchant order atomically with gift card redemption and payment record.
   * Wraps order creation, gift card deduction, and payment record in a single transaction.
   * Loyalty points are NOT included — they stay outside the transaction.
   */
  async createMerchantOrderAtomic(
    tenantId: string,
    input: CreateMerchantOrderInput,
    options?: {
      giftCard?: { id: string; amount: number };
      payment?: {
        stripePaymentIntentId: string;
        amount: number;
        currency: string;
        stripeCustomerId?: string;
      };
    }
  ) {
    const order = await prisma.$transaction(async (tx) => {
      // 1. Create order
      const createdOrder = await this.createMerchantOrder(tenantId, input, tx);

      // 2. Redeem gift card if applicable
      if (options?.giftCard) {
        await giftCardService.redeemGiftCard(
          tenantId,
          options.giftCard.id,
          createdOrder.id,
          options.giftCard.amount,
          tx
        );
      }

      // 3. Create payment record if applicable
      if (options?.payment) {
        await paymentService.createPaymentRecord(
          {
            tenantId,
            orderId: createdOrder.id,
            stripePaymentIntentId: options.payment.stripePaymentIntentId,
            stripeCustomerId: options.payment.stripeCustomerId,
            amount: options.payment.amount,
            currency: options.payment.currency,
          },
          tx
        );
      }

      return createdOrder;
    });

    // Emit event AFTER transaction commits successfully
    this.emitOrderCreatedEvent(tenantId, order, input, Number(order.totalAmount));

    return order;
  }

  /**
   * Emit order.created event
   */
  private emitOrderCreatedEvent(
    tenantId: string,
    order: { id: string; orderNumber: string },
    input: CreateMerchantOrderInput,
    totalAmount: number
  ) {
    const salesChannel = input.salesChannel ?? "online_order";
    orderEventEmitter.emit("order.created", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      merchantId: input.merchantId,
      tenantId,
      status: "created",
      fulfillmentStatus: "pending",
      timestamp: new Date(),
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      customerPhone: input.customerPhone,
      orderMode: input.orderMode,
      salesChannel,
      totalAmount,
      items: input.items,
    });
  }

  /**
   * Create a gift card order (virtual product, not associated with a specific merchant)
   */
  async createGiftCardOrder(tenantId: string, input: CreateGiftCardOrderInput) {
    // Calculate order totals (simple sum, no tax/tip/delivery for gift card orders)
    const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalAmount = Math.round(subtotal * 100) / 100;

    // Calculate payment breakdown
    const giftCardPayment = input.giftCardPayment ?? 0;
    const cashPayment = Math.max(0, totalAmount - giftCardPayment);

    // Get current date for sequencing (use UTC since no merchant timezone)
    const dateStr = new Date().toISOString().slice(0, 10);

    // Generate order number using atomic sequence
    const sequence = await sequenceRepository.getNextGiftCardOrderSequence(tenantId, dateStr);
    const orderNumber = generateGiftcardOrderNumber(sequence);

    // Create the order in database (dual-write: JSON snapshot + structured OrderItem rows)
    const order = await orderRepository.create(
      tenantId,
      null, // No merchant for gift card orders
      {
        orderNumber,
        customerFirstName: input.customerFirstName,
        customerLastName: input.customerLastName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        orderMode: "pickup", // Default for gift card orders
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
      input.loyaltyMemberId,
      undefined, // no transaction
      input.items
    );

    return order;
  }

  /**
   * Calculate order totals with per-item tax calculation
   * Uses unified pricing module for consistency with client-side calculation
   */
  async calculateOrderTotals(
    tenantId: string,
    merchantId: string,
    input: Pick<CreateMerchantOrderInput, "items" | "orderMode" | "tipAmount" | "discountCode">
  ): Promise<OrderCalculation> {
    // Query tax data from DB instead of trusting frontend-provided rates
    const itemIds = input.items.map((item) => item.menuItemId);
    const itemTaxMap = await taxConfigRepository.getMenuItemsTaxConfigIds(itemIds);
    const allTaxConfigIds = [...new Set([...itemTaxMap.values()].flat())];
    const [taxConfigs, merchantTaxRateMap] = await Promise.all([
      taxConfigRepository.getTaxConfigsByIds(tenantId, allTaxConfigIds),
      taxConfigRepository.getMerchantTaxRateMap(merchantId),
    ]);
    const taxConfigMap = new Map(taxConfigs.map((c) => [c.id, c]));

    // Convert to PricingItem using DB-sourced tax data
    const pricingItems: PricingItem[] = input.items.map((item) => {
      const taxConfigIds = itemTaxMap.get(item.menuItemId) || [];
      const taxes = taxConfigIds
        .map((taxId) => {
          const config = taxConfigMap.get(taxId);
          if (!config) return null;
          return {
            rate: merchantTaxRateMap.get(taxId) || 0,
            roundingMethod: config.roundingMethod as RoundingMethod,
            inclusionType: config.inclusionType,
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);
      return {
        itemId: item.menuItemId,
        unitPrice: item.totalPrice / item.quantity,
        quantity: item.quantity,
        taxes,
      };
    });

    // Convert tipAmount to TipInput (fixed amount)
    const tip: TipInput | null = input.tipAmount
      ? { type: "fixed", amount: input.tipAmount }
      : null;

    // Calculate pricing using unified module
    const pricing = calculateOrderPricing(pricingItems, tip);

    // Calculate delivery fee (TODO: get from merchant settings)
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

    // Map structured OrderItem rows to OrderItemData[]
    const items: OrderItemData[] = (order.orderItems ?? []).map(mapOrderItemToData);

    // Fetch points earned for this order (if any)
    const pointTransaction = await pointTransactionRepository.getByOrderId(tenantId, orderId);
    const pointsEarned =
      pointTransaction && pointTransaction.type === "earn" ? pointTransaction.points : undefined;

    return { ...order, items, timeline, pointsEarned };
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
    paymentFailedAt: Date | null;
  }): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Payment events
    events.push({ type: "payment", status: "created", timestamp: order.createdAt });

    if (order.paidAt) {
      events.push({ type: "payment", status: "completed", timestamp: order.paidAt });
    }

    if (order.paymentFailedAt) {
      events.push({ type: "payment", status: "payment_failed", timestamp: order.paymentFailedAt });
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

  // ==================== Status Update Methods ====================
  // Used by webhook handlers and internal callers to update order status
  // while emitting the appropriate events.

  private static readonly FULFILLMENT_TIMESTAMP_FIELD: Record<string, string> = {
    confirmed: "confirmedAt",
    preparing: "preparingAt",
    ready: "readyAt",
    fulfilled: "fulfilledAt",
  };

  private static readonly FULFILLMENT_EVENT_MAP: Record<
    string,
    "order.fulfillment.confirmed" | "order.fulfillment.preparing" | "order.fulfillment.ready" | "order.fulfillment.fulfilled"
  > = {
    confirmed: "order.fulfillment.confirmed",
    preparing: "order.fulfillment.preparing",
    ready: "order.fulfillment.ready",
    fulfilled: "order.fulfillment.fulfilled",
  };

  /**
   * Update fulfillment status and emit the corresponding fulfillment event.
   */
  async updateFulfillmentStatus(
    tenantId: string,
    orderId: string,
    fulfillmentStatus: FulfillmentStatus,
    options?: StatusUpdateOptions
  ): Promise<void> {
    const order = await orderRepository.getByIdWithMerchant(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCodes.ORDER_NOT_FOUND, { orderId });
    }

    const timestampField = OrderService.FULFILLMENT_TIMESTAMP_FIELD[fulfillmentStatus];
    const updateData: Record<string, unknown> = {
      fulfillmentStatus,
    };
    if (timestampField) {
      updateData[timestampField] = new Date();
    }
    if (options?.squareOrderVersion !== undefined) {
      updateData.squareOrderVersion = options.squareOrderVersion;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    const eventType = OrderService.FULFILLMENT_EVENT_MAP[fulfillmentStatus];
    if (eventType) {
      orderEventEmitter.emit(eventType, {
        orderId,
        orderNumber: order.orderNumber,
        merchantId: order.merchantId ?? "",
        tenantId,
        timestamp: new Date(),
        fulfillmentStatus,
        previousFulfillmentStatus: order.fulfillmentStatus as FulfillmentStatus,
        source: options?.source,
      });
    }
  }

  /**
   * Update payment status (completed or payment_failed) and emit events.
   */
  async updatePaymentStatus(
    tenantId: string,
    orderId: string,
    status: Extract<OrderStatus, "completed" | "payment_failed">,
    options?: StatusUpdateOptions
  ): Promise<void> {
    const order = await orderRepository.getByIdWithMerchant(tenantId, orderId);

    // For payment_failed, treat missing/terminal orders as a no-op — stale
    // ExternalIdMapping records should not cause webhook retry loops.
    if (!order) {
      if (status === "payment_failed") return;
      throw new AppError(ErrorCodes.ORDER_NOT_FOUND, { orderId });
    }

    if (status === "completed") {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "completed", paidAt: new Date() },
      });

      orderEventEmitter.emit("order.paid", {
        orderId,
        orderNumber: order.orderNumber,
        merchantId: order.merchantId ?? "",
        tenantId,
        timestamp: new Date(),
        status: "completed",
        previousStatus: order.status as OrderStatus,
        source: options?.source,
      });
      return;
    }

    // payment_failed: guard against terminal states
    if (
      order.status === "completed" ||
      order.status === "canceled" ||
      order.status === "payment_failed"
    ) {
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "payment_failed", paymentFailedAt: new Date() },
    });
  }

  /**
   * Cancel an order and emit the order.cancelled event.
   */
  async cancelOrder(
    tenantId: string,
    orderId: string,
    reason?: string,
    options?: StatusUpdateOptions
  ): Promise<void> {
    const order = await orderRepository.getByIdWithMerchant(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCodes.ORDER_NOT_FOUND, { orderId });
    }

    const updateData: Record<string, unknown> = {
      status: "canceled",
      cancelledAt: new Date(),
      cancelReason: reason,
    };
    if (options?.squareOrderVersion !== undefined) {
      updateData.squareOrderVersion = options.squareOrderVersion;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    orderEventEmitter.emit("order.cancelled", {
      orderId,
      orderNumber: order.orderNumber,
      merchantId: order.merchantId ?? "",
      tenantId,
      timestamp: new Date(),
      status: "canceled",
      cancelReason: reason,
      source: options?.source,
    });
  }

  // ==================== Tenant Order Management ====================

  /**
   * Get orders for a tenant (all merchants under the tenant, for Dashboard)
   */
  async getTenantOrders(
    tenantId: string,
    options: TenantOrderListOptions = {}
  ) {
    return orderRepository.getTenantOrders(tenantId, options);
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
