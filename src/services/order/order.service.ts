import { orderRepository } from "@/repositories/order.repository";
import { menuService, taxConfigService } from "@/services/menu";
import { generateOrderNumber } from "@/lib/utils";
import { calculateOrderPricing, type PricingItem, type TipInput } from "@/lib/pricing";
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
   * Calculate order totals with per-item tax calculation
   * Uses unified pricing module for consistency with client-side calculation
   */
  async calculateOrderTotals(
    tenantId: string,
    input: Pick<CreateOrderInput, "items" | "orderType" | "tipAmount">
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

    // Calculate delivery fee separately (not included in pricing module for now)
    const deliveryFee = input.orderType === "delivery" ? 3.99 : 0;
    const discount = 0; // TODO: Implement discount/coupon system

    const totalAmount = pricing.totalAmount + deliveryFee - discount;

    return {
      subtotal: pricing.subtotal,
      taxAmount: pricing.taxAmount,
      taxBreakdown: [], // Simplified, no breakdown needed for now
      tipAmount: pricing.tipAmount,
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
