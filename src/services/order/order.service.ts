// ==================== Order Service ====================
// Uses OrderRepository (Prisma) for database operations.

import { Prisma } from "@prisma/client";
import type { DbClient } from "@/lib/db";
import { runInTransaction } from "@/lib/transaction";
import { menuService } from "@/services/menu";
import { giftCardService } from "@/services/giftcard";
import { paymentService } from "@/services/payment";
import type { PaymentProvider } from "@/repositories/payment.repository";
import { merchantService } from "@/services/merchant";
import { orderRepository } from "@/repositories/order.repository";
import { fulfillmentRepository } from "@/repositories/fulfillment.repository";
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
  MarkCashOrderPaidInput,
  OrderCalculation,
  TenantOrderListOptions,
  TimelineEvent,
  OrderWithTimeline,
} from "./order.types";
import type { OrderItemWithModifiers } from "@/repositories/order.repository";
import type { OrderItemData, SelectedModifier, ItemTaxInfo } from "@/types";

export interface StatusUpdateOptions {
  source?: OrderEventSource;
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

/**
 * Create a merchant order (regular orders with menu items)
 * Uses atomic sequence generation to prevent race conditions
 */
async function createMerchantOrder(tenantId: string, input: CreateMerchantOrderInput, tx?: DbClient) {
  const { merchantId } = input;

  // Validate menu items exist and are available
  const itemIds = input.items.map((item) => item.menuItemId);
  const menuItems = await menuService.getMenuItemsByIds(tenantId, merchantId, itemIds);

  if (menuItems.length !== itemIds.length) {
    throw new AppError(ErrorCodes.MENU_ITEMS_UNAVAILABLE, undefined, 400);
  }

  // Calculate order totals
  const calculation = await calculateOrderTotals(tenantId, merchantId, input);

  // Calculate payment breakdown
  const giftCardPayment = input.giftCardPayment ?? 0;
  const balanceDue = Math.max(0, calculation.totalAmount - giftCardPayment);

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
  const paymentType = input.paymentType ?? "online";

  // Create the order + fulfillment in database with structured OrderItem rows
  const createOrderAndFulfillment = async (dbClient?: DbClient) => {
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
        paymentType,
        status: "created",
        fulfillmentStatus: "pending",
        subtotal: calculation.subtotal,
        taxAmount: calculation.taxAmount,
        tipAmount: calculation.tipAmount,
        deliveryFee: calculation.deliveryFee,
        feesAmount: calculation.feesAmount,
        feesBreakdown: calculation.feesBreakdown.length > 0
          ? (calculation.feesBreakdown as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        discount: calculation.discount,
        giftCardPayment: Math.round(giftCardPayment * 100) / 100,
        balanceDue: Math.round(balanceDue * 100) / 100,
        totalAmount: calculation.totalAmount,
        notes: input.notes ?? null,
        deliveryAddress: input.deliveryAddress
          ? (input.deliveryAddress as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        scheduledAt: input.scheduledAt ?? null,
      },
      input.loyaltyMemberId,
      dbClient,
      input.items
    );

    // Create fulfillment record alongside the order
    await fulfillmentRepository.create(
      tenantId,
      { orderId: order.id, merchantId },
      dbClient
    );

    return order;
  };

  // If caller provided a tx, use it; otherwise wrap in a transaction
  const order = tx
    ? await createOrderAndFulfillment(tx)
    : await runInTransaction(async (txClient) => createOrderAndFulfillment(txClient));

  // Emit order created event (only when not inside a caller-provided transaction)
  if (!tx) {
    emitOrderCreatedEvent(tenantId, order, input, calculation.totalAmount);
  }

  return order;
}

/**
 * Create a merchant order atomically with gift card redemption and payment record.
 * Wraps order creation, gift card deduction, and payment record in a single transaction.
 * Loyalty points are NOT included — they stay outside the transaction.
 */
async function createMerchantOrderAtomic(
  tenantId: string,
  input: CreateMerchantOrderInput,
  options?: {
    giftCard?: { id: string; amount: number };
    payment?: {
      provider: PaymentProvider;
      providerPaymentId?: string | null;
      amount: number;
      currency: string;
      stripeAccountId?: string;
      stripeCustomerId?: string;
    };
  }
) {
  // Retry on P2034 (transaction conflict / deadlock) which occurs under
  // concurrent order creation due to the sequence upsert gap-lock.
  const MAX_RETRIES = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await _createMerchantOrderAtomicInner(tenantId, input, options);
    } catch (error) {
      lastError = error;
      // Retriable Prisma errors under concurrent order creation:
      // P2002 = unique constraint on sequence upsert (concurrent create race)
      // P2034 = transaction conflict / write conflict
      // P2028 = transaction API error (deadlock detected by MySQL)
      const isRetriable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034" || error.code === "P2028");
      const isDeadlock =
        error instanceof Error && error.message.includes("Deadlock");
      if ((!isRetriable && !isDeadlock) || attempt === MAX_RETRIES - 1) {
        throw error;
      }
      // Brief backoff before retry
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }

  throw lastError;
}

/** Inner implementation of createMerchantOrderAtomic — separated for retry. */
async function _createMerchantOrderAtomicInner(
  tenantId: string,
  input: CreateMerchantOrderInput,
  options?: {
    giftCard?: { id: string; amount: number };
    payment?: {
      provider: PaymentProvider;
      providerPaymentId?: string | null;
      amount: number;
      currency: string;
      stripeAccountId?: string;
      stripeCustomerId?: string;
    };
  }
) {
  const order = await runInTransaction(async (tx) => {
    // 1. Create order
    const createdOrder = await createMerchantOrder(tenantId, input, tx);

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
          provider: options.payment.provider,
          providerPaymentId: options.payment.providerPaymentId,
          stripeAccountId: options.payment.stripeAccountId,
          stripeCustomerId: options.payment.stripeCustomerId,
          amount: options.payment.amount,
          currency: options.payment.currency,
        },
        tx
      );
    }

    // 4. Determine if order is immediately paid:
    //    - Card payment exists (always pre-verified before this method)
    //    - OR gift card covers full amount (no card payment needed)
    const orderTotal = Number(createdOrder.totalAmount);
    const giftCardCoversAll =
      !!options?.giftCard && !options.payment && options.giftCard.amount >= orderTotal;
    const isImmediatelyPaid = !!options?.payment || giftCardCoversAll;

    if (isImmediatelyPaid) {
      await orderRepository.atomicComplete(
        tenantId,
        createdOrder.id,
        { paidAt: new Date() },
        tx
      );
    }

    return { ...createdOrder, _isImmediatelyPaid: isImmediatelyPaid };
  });

  // Emit events AFTER transaction commits successfully
  emitOrderCreatedEvent(tenantId, order, input, Number(order.totalAmount));

  if (order._isImmediatelyPaid) {
    orderEventEmitter.emit("order.paid", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      merchantId: input.merchantId,
      tenantId,
      timestamp: new Date(),
      status: "completed",
      previousStatus: "created",
      customerPhone: input.customerPhone,
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      customerEmail: input.customerEmail,
      totalAmount: Number(order.totalAmount),
      giftCardPayment: Number(order.giftCardPayment) || 0,
      loyaltyMemberId: input.loyaltyMemberId ?? undefined,
    });
  }

  return order;
}

/**
 * Emit order.created event
 */
function emitOrderCreatedEvent(
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
async function createGiftCardOrder(tenantId: string, input: CreateGiftCardOrderInput) {
  // Calculate order totals (simple sum, no tax/tip/delivery for gift card orders)
  const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalAmount = Math.round(subtotal * 100) / 100;

  // Calculate payment breakdown
  const giftCardPayment = input.giftCardPayment ?? 0;
  const balanceDue = Math.max(0, totalAmount - giftCardPayment);

  // Get current date for sequencing (use UTC since no merchant timezone)
  const dateStr = new Date().toISOString().slice(0, 10);

  // Generate order number using atomic sequence
  const sequence = await sequenceRepository.getNextGiftCardOrderSequence(tenantId, dateStr);
  const orderNumber = generateGiftcardOrderNumber(sequence);

  // Create the order in database with structured OrderItem rows
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
      subtotal: totalAmount,
      taxAmount: 0,
      tipAmount: 0,
      deliveryFee: 0,
      feesAmount: 0,
      feesBreakdown: Prisma.JsonNull,
      discount: 0,
      giftCardPayment: Math.round(giftCardPayment * 100) / 100,
      balanceDue: Math.round(balanceDue * 100) / 100,
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
async function calculateOrderTotals(
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
async function getOrder(tenantId: string, orderId: string) {
  return orderRepository.getByIdWithMerchant(tenantId, orderId);
}

/**
 * Get order with timeline for Order Detail page.
 * Timeline is built from FulfillmentStatusLog + payment timestamp fields.
 */
async function getOrderWithTimeline(
  tenantId: string,
  orderId: string
): Promise<OrderWithTimeline | null> {
  const order = await orderRepository.getByIdWithMerchant(tenantId, orderId);
  if (!order) return null;

  const timeline = await buildTimeline(tenantId, orderId, order);

  // Map structured OrderItem rows to OrderItemData[]
  const items: OrderItemData[] = (order.orderItems ?? []).map(mapOrderItemToData);

  // Fetch points earned for this order (if any)
  const pointTransaction = await pointTransactionRepository.getByOrderId(tenantId, orderId);
  const pointsEarned =
    pointTransaction && pointTransaction.type === "earn" ? pointTransaction.points : undefined;

  return { ...order, items, timeline, pointsEarned };
}

/**
 * Build timeline from FulfillmentStatusLog + order payment timestamps.
 */
async function buildTimeline(
  tenantId: string,
  orderId: string,
  order: {
    createdAt: Date;
    paidAt: Date | null;
    cancelledAt: Date | null;
    paymentFailedAt: Date | null;
  }
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  // Payment events from Order timestamps
  events.push({ type: "payment", status: "created", timestamp: order.createdAt });

  if (order.paidAt) {
    events.push({ type: "payment", status: "completed", timestamp: order.paidAt });
  }

  if (order.paymentFailedAt) {
    events.push({ type: "payment", status: "payment_failed", timestamp: order.paymentFailedAt });
  }

  if (order.cancelledAt) {
    events.push({ type: "payment", status: "canceled", timestamp: order.cancelledAt });
  }

  // Fulfillment events from FulfillmentStatusLog
  const fulfillment = await fulfillmentRepository.getByOrderId(tenantId, orderId);
  if (fulfillment) {
    const statusLogs = await fulfillmentRepository.getStatusHistory(tenantId, fulfillment.id);
    for (const log of statusLogs) {
      events.push({
        type: "fulfillment",
        status: log.toStatus as FulfillmentStatus,
        timestamp: log.createdAt,
      });
    }
  }

  // Sort by timestamp
  return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

// ==================== Status Update Methods ====================
// Fulfillment status updates are handled by FulfillmentService.
// Only payment-related status updates remain here.

/**
 * Update payment status (completed or payment_failed) and emit events.
 */
async function updatePaymentStatus(
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
    // CAS: skip if already completed (idempotent for webhook retries)
    if (order.status === "completed") {
      return;
    }

    // Atomic CAS: only update if status hasn't changed since our read.
    // Prevents duplicate order.paid events when concurrent webhooks
    // (e.g. Stripe + Square) both try to mark the same order completed.
    const count = await orderRepository.atomicComplete(
      tenantId,
      orderId,
      { paidAt: new Date() }
    );
    if (count === 0) {
      // Another request already marked it completed — safe to skip
      return;
    }

    orderEventEmitter.emit("order.paid", {
      orderId,
      orderNumber: order.orderNumber,
      merchantId: order.merchantId ?? "",
      tenantId,
      timestamp: new Date(),
      status: "completed",
      previousStatus: order.status as OrderStatus,
      source: options?.source,
      customerPhone: order.customerPhone,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerEmail: order.customerEmail ?? undefined,
      totalAmount: Number(order.totalAmount),
      giftCardPayment: Number(order.giftCardPayment) || 0,
      loyaltyMemberId: order.loyaltyMemberId ?? undefined,
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

  // Atomic CAS: only mark failed if not already in a terminal state
  await orderRepository.atomicMarkPaymentFailed(tenantId, orderId);
}

/**
 * Mark a cash / in-store order as paid.
 * Creates a succeeded payment record in one step (no repository bypass).
 */
async function markCashOrderPaid(
  tenantId: string,
  orderId: string,
  input?: MarkCashOrderPaidInput
): Promise<void> {
  const order = await orderRepository.getByIdWithMerchant(tenantId, orderId);
  if (!order) {
    throw new AppError(ErrorCodes.ORDER_NOT_FOUND, { orderId });
  }

  // Idempotent: already completed → no-op
  if (order.status === "completed") {
    return;
  }

  // Only in_store orders in "created" status are eligible
  if (order.status !== "created" || order.paymentType !== "in_store") {
    throw new AppError(ErrorCodes.ORDER_NOT_ELIGIBLE_FOR_MARK_PAID, { orderId });
  }

  const amount = input?.amount ?? Number(order.totalAmount);
  const now = new Date();

  await runInTransaction(async (tx) => {
    // Create a succeeded payment record in one step (no repository bypass)
    await paymentService.createPaymentRecord(
      {
        tenantId,
        orderId,
        provider: "cash" as PaymentProvider,
        amount,
        currency: "USD",
        status: "succeeded",
        paidAt: now,
        paymentMethod: "cash",
      },
      tx
    );

    // Update order status
    await orderRepository.atomicComplete(
      tenantId,
      orderId,
      { paidAt: now, balanceDue: amount },
      tx
    );
  });

  // Emit event outside of transaction
  orderEventEmitter.emit("order.paid", {
    orderId,
    orderNumber: order.orderNumber,
    merchantId: order.merchantId ?? "",
    tenantId,
    timestamp: now,
    status: "completed",
    previousStatus: order.status as OrderStatus,
    source: "manual",
    customerPhone: order.customerPhone,
    customerFirstName: order.customerFirstName,
    customerLastName: order.customerLastName,
    customerEmail: order.customerEmail ?? undefined,
    totalAmount: Number(order.totalAmount),
    giftCardPayment: Number(order.giftCardPayment) || 0,
    loyaltyMemberId: order.loyaltyMemberId ?? undefined,
  });
}

/**
 * Cancel an order and emit the order.cancelled event.
 */
async function cancelOrder(
  tenantId: string,
  orderId: string,
  reason?: string,
  options?: StatusUpdateOptions
): Promise<void> {
  const order = await orderRepository.getByIdWithMerchant(tenantId, orderId);
  if (!order) {
    throw new AppError(ErrorCodes.ORDER_NOT_FOUND, { orderId });
  }

  // Already canceled — idempotent
  if (order.status === "canceled") {
    return;
  }

  // POS webhooks are authoritative — skip fulfillment guard so late
  // cancellation webhooks on already-fulfilled orders are treated as no-ops
  // rather than errors that trigger retries.
  const isWebhookSource =
    options?.source === "square_webhook" ||
    options?.source === "toast_webhook";

  if (!isWebhookSource) {
    // Manual cancellation not allowed once kitchen has started working
    const NON_CANCELLABLE_FULFILLMENT_STATUSES = [
      "preparing",
      "ready",
      "fulfilled",
    ];
    if (
      NON_CANCELLABLE_FULFILLMENT_STATUSES.includes(order.fulfillmentStatus)
    ) {
      throw new AppError(ErrorCodes.ORDER_CANCEL_NOT_ALLOWED, {
        orderId,
        fulfillmentStatus: order.fulfillmentStatus,
      });
    }
  }

  // Atomic CAS: only cancel if status hasn't changed to "canceled"
  // since our read, preventing duplicate order.cancelled events.
  const count = await orderRepository.atomicCancel(tenantId, orderId, reason);
  if (count === 0) {
    // Another request already canceled — safe to skip
    return;
  }

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
async function getTenantOrders(
  tenantId: string,
  options: TenantOrderListOptions = {}
) {
  return orderRepository.getTenantOrders(tenantId, options);
}

/**
 * Link an existing order to a loyalty member
 * Used when a guest registers after placing an order
 */
async function linkLoyaltyMember(
  tenantId: string,
  orderId: string,
  loyaltyMemberId: string
) {
  return orderRepository.updateLoyaltyMemberId(tenantId, orderId, loyaltyMemberId);
}

/**
 * Get orders for a loyalty member with pagination
 */
async function getMemberOrders(
  tenantId: string,
  loyaltyMemberId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
) {
  return orderRepository.getOrdersByLoyaltyMember(tenantId, loyaltyMemberId, options);
}

export const orderService = {
  createMerchantOrder,
  createMerchantOrderAtomic,
  createGiftCardOrder,
  calculateOrderTotals,
  getOrder,
  getOrderWithTimeline,
  updatePaymentStatus,
  markCashOrderPaid,
  cancelOrder,
  getTenantOrders,
  linkLoyaltyMember,
  getMemberOrders,
};
