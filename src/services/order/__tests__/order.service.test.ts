import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "../order.service";
import { orderEventEmitter } from "../order-events";
import type { OrderStatus, FulfillmentStatus } from "@/types";

// Mock dependencies
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(Symbol("tx"))),
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

vi.mock("@/repositories/order.repository", () => ({
  orderRepository: {
    create: vi.fn(),
    getByIdWithMerchant: vi.fn(),
    getTenantOrders: vi.fn(),
    getOrdersByLoyaltyMember: vi.fn(),
    updateLoyaltyMemberId: vi.fn(),
  },
}));

vi.mock("@/services/giftcard", () => ({
  giftCardService: {
    redeemGiftCard: vi.fn(),
  },
}));

vi.mock("@/services/payment", () => ({
  paymentService: {
    createPaymentRecord: vi.fn(),
  },
}));

vi.mock("@/services/menu", () => ({
  menuService: {
    getMenuItemsByIds: vi.fn(),
  },
  taxConfigService: {
    getTaxConfigsMap: vi.fn(),
  },
}));

vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchant: vi.fn(),
    getMerchantById: vi.fn(),
  },
}));

vi.mock("@/repositories/sequence.repository", () => ({
  sequenceRepository: {
    getNextOrderSequence: vi.fn(),
    getNextCompanyOrderSequence: vi.fn(),
  },
}));

vi.mock("@/repositories/point-transaction.repository", () => ({
  pointTransactionRepository: {
    getByOrderId: vi.fn(),
  },
}));

vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getMenuItemsTaxConfigIds: vi.fn(),
    getTaxConfigsByIds: vi.fn(),
    getMerchantTaxRateMap: vi.fn(),
  },
}));

// Import mocked modules
import { orderRepository } from "@/repositories/order.repository";
import { sequenceRepository } from "@/repositories/sequence.repository";
import { taxConfigRepository } from "@/repositories/tax-config.repository";
import { pointTransactionRepository } from "@/repositories/point-transaction.repository";
import { menuService, taxConfigService } from "@/services/menu";
import { merchantService } from "@/services/merchant";
import { giftCardService } from "@/services/giftcard";
import { paymentService } from "@/services/payment";
import prisma from "@/lib/db";

describe("OrderService", () => {
  let orderService: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    orderService = new OrderService();
  });

  describe("createMerchantOrder()", () => {
    const mockInput = {
      merchantId: "merchant-1",
      customerFirstName: "John",
      customerLastName: "Doe",
      customerPhone: "123-456-7890",
      customerEmail: "john@example.com",
      orderMode: "pickup" as const,
      items: [
        {
          menuItemId: "item-1",
          name: "Margherita Pizza",
          price: 18.99,
          quantity: 2,
          selectedModifiers: [],
          totalPrice: 37.98,
          taxes: [{ taxConfigId: "tax-1", name: "Standard Tax", rate: 0.08875, roundingMethod: "half_up" as const }],
        },
      ],
      tipAmount: 5,
    };

    beforeEach(() => {
      vi.mocked(menuService.getMenuItemsByIds).mockResolvedValue([
        { id: "item-1", name: "Margherita Pizza" },
      ] as never);

      vi.mocked(taxConfigService.getTaxConfigsMap).mockResolvedValue(
        new Map([["tax-1", { id: "tax-1", name: "Sales Tax", description: null, roundingMethod: "half_up", inclusionType: "ADDITIVE" as const, calculationPhase: "SUBTOTAL" as const, appliesToCustomAmounts: false, status: "active" as const }]])
      );

      // Mock tax config repository (server-side tax lookup)
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", ["tax-1"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        { id: "tax-1", name: "Sales Tax", roundingMethod: "half_up", status: "active" },
      ] as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map([["tax-1", 0.08875]])
      );

      vi.mocked(merchantService.getMerchant).mockResolvedValue({
        id: "merchant-1",
        name: "Test Merchant",
        slug: "test-merchant",
      } as never);

      vi.mocked(merchantService.getMerchantById).mockResolvedValue({
        id: "merchant-1",
        name: "Test Merchant",
        slug: "test-merchant",
        timezone: "America/New_York",
      } as never);

      vi.mocked(sequenceRepository.getNextOrderSequence).mockResolvedValue(1);
      vi.mocked(sequenceRepository.getNextCompanyOrderSequence).mockResolvedValue(1);

      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-1",
        orderNumber: "20260127-0001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "created",
        fulfillmentStatus: "pending",
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "123-456-7890",
        customerEmail: "john@example.com",
        orderMode: "pickup",
        items: mockInput.items,
        subtotal: 37.98,
        taxAmount: 0,
        tipAmount: 5,
        deliveryFee: 0,
        discount: 0,
        giftCardPayment: 0,
        cashPayment: 42.98,
        totalAmount: 42.98,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
    });

    it("should create order with initial status 'created' and fulfillmentStatus 'pending'", async () => {
      const order = await orderService.createMerchantOrder("tenant-1", mockInput);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.objectContaining({
          orderNumber: expect.any(String),
          customerFirstName: "John",
          customerLastName: "Doe",
          customerPhone: "123-456-7890",
          orderMode: "pickup",
          status: "created",
          fulfillmentStatus: "pending",
        }),
        undefined, // loyaltyMemberId
        undefined // tx
      );

      expect(order.id).toBe("order-1");
      expect(order.merchantId).toBe("merchant-1");
    });

    it("should create order with loyaltyMemberId when provided", async () => {
      const inputWithLoyalty = {
        ...mockInput,
        loyaltyMemberId: "loyalty-member-123",
      };

      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-1",
        orderNumber: "20260127-0001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        loyaltyMemberId: "loyalty-member-123",
        status: "created",
        fulfillmentStatus: "pending",
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "123-456-7890",
        customerEmail: "john@example.com",
        orderMode: "pickup",
        items: mockInput.items,
        subtotal: 37.98,
        taxAmount: 0,
        tipAmount: 5,
        deliveryFee: 0,
        discount: 0,
        giftCardPayment: 0,
        cashPayment: 42.98,
        totalAmount: 42.98,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const order = await orderService.createMerchantOrder("tenant-1", inputWithLoyalty);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.objectContaining({
          orderNumber: expect.any(String),
          customerFirstName: "John",
          customerLastName: "Doe",
          status: "created",
          fulfillmentStatus: "pending",
        }),
        "loyalty-member-123",
        undefined // tx
      );

      expect(order.id).toBe("order-1");
      expect(order.loyaltyMemberId).toBe("loyalty-member-123");
    });

    it("should validate menu items exist", async () => {
      vi.mocked(menuService.getMenuItemsByIds).mockResolvedValue([]);

      await expect(orderService.createMerchantOrder("tenant-1", mockInput)).rejects.toThrow(
        "Some menu items are not available"
      );
    });

    it("should emit order.created event with new status fields", async () => {
      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.created", eventHandler);

      await orderService.createMerchantOrder("tenant-1", mockInput);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          orderNumber: "20260127-0001",
          merchantId: "merchant-1",
          tenantId: "tenant-1",
          status: "created",
          fulfillmentStatus: "pending",
          customerFirstName: "John",
          customerLastName: "Doe",
        })
      );

      unsubscribe();
    });

    it("should create delivery order with deliveryAddress and deliveryFee", async () => {
      const deliveryInput = {
        ...mockInput,
        orderMode: "delivery" as const,
        deliveryAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          zipCode: "10001",
        },
      };

      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-1",
        orderNumber: "20260127-0001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "created",
        fulfillmentStatus: "pending",
        orderMode: "delivery",
        deliveryFee: 3.99,
        totalAmount: 46.97,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await orderService.createMerchantOrder("tenant-1", deliveryInput);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.objectContaining({
          orderMode: "delivery",
          deliveryFee: 3.99,
          deliveryAddress: deliveryInput.deliveryAddress,
        }),
        undefined,
        undefined // tx
      );
    });

    it("should calculate payment breakdown with giftCardPayment", async () => {
      const inputWithGiftCard = {
        ...mockInput,
        giftCardPayment: 20,
      };

      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-1",
        orderNumber: "20260127-0001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "created",
        fulfillmentStatus: "pending",
        giftCardPayment: 20,
        cashPayment: 22.98,
        totalAmount: 42.98,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await orderService.createMerchantOrder("tenant-1", inputWithGiftCard);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.objectContaining({
          giftCardPayment: 20,
          cashPayment: expect.any(Number),
        }),
        undefined,
        undefined // tx
      );
    });

    it("should default salesChannel to online_order when not provided", async () => {
      await orderService.createMerchantOrder("tenant-1", mockInput);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.objectContaining({
          salesChannel: "online_order",
        }),
        undefined,
        undefined // tx
      );
    });

    it("should save notes when provided", async () => {
      const inputWithNotes = {
        ...mockInput,
        notes: "No onions please",
      };

      await orderService.createMerchantOrder("tenant-1", inputWithNotes);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.objectContaining({
          notes: "No onions please",
        }),
        undefined,
        undefined // tx
      );
    });

    it("should save scheduledAt when provided", async () => {
      const scheduledTime = new Date("2026-02-15T18:00:00Z");
      const inputWithSchedule = {
        ...mockInput,
        scheduledAt: scheduledTime,
      };

      await orderService.createMerchantOrder("tenant-1", inputWithSchedule);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.objectContaining({
          scheduledAt: scheduledTime,
        }),
        undefined,
        undefined // tx
      );
    });
  });

  describe("createCompanyOrder()", () => {
    const mockInput = {
      customerFirstName: "Jane",
      customerLastName: "Smith",
      customerPhone: "555-123-4567",
      customerEmail: "jane@example.com",
      items: [
        {
          menuItemId: "giftcard-50",
          name: "$50 Gift Card",
          price: 50,
          quantity: 1,
          selectedModifiers: [],
          totalPrice: 50,
          taxes: [],
        },
      ],
    };

    beforeEach(() => {
      vi.mocked(sequenceRepository.getNextCompanyOrderSequence).mockResolvedValue(1);

      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-gc-1",
        orderNumber: "GC-20260210-0001",
        tenantId: "tenant-1",        merchantId: null,
        status: "created",
        fulfillmentStatus: "pending",
        customerFirstName: "Jane",
        customerLastName: "Smith",
        customerPhone: "555-123-4567",
        customerEmail: "jane@example.com",
        orderMode: "pickup",
        salesChannel: "giftcard",
        items: mockInput.items,
        subtotal: 50,
        taxAmount: 0,
        tipAmount: 0,
        deliveryFee: 0,
        discount: 0,
        giftCardPayment: 0,
        cashPayment: 50,
        totalAmount: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
    });

    it("should create company order with merchantId as null", async () => {
      const order = await orderService.createCompanyOrder("tenant-1", mockInput);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        null, // merchantId should be null
        expect.objectContaining({
          orderNumber: expect.any(String),
          customerFirstName: "Jane",
          customerLastName: "Smith",
          orderMode: "pickup",
          salesChannel: "giftcard",
          status: "created",
          fulfillmentStatus: "pending",
          taxAmount: 0,
          tipAmount: 0,
          deliveryFee: 0,
        }),
        undefined
      );

      expect(order.id).toBe("order-gc-1");
      expect(order.merchantId).toBeNull();
    });

    it("should calculate totalAmount as sum of item prices without tax", async () => {
      const multiItemInput = {
        ...mockInput,
        items: [
          { menuItemId: "gc-25", name: "$25 Gift Card", price: 25, quantity: 1, selectedModifiers: [], totalPrice: 25, taxes: [] },
          { menuItemId: "gc-50", name: "$50 Gift Card", price: 50, quantity: 1, selectedModifiers: [], totalPrice: 50, taxes: [] },
        ],
      };

      await orderService.createCompanyOrder("tenant-1", multiItemInput);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        null,
        expect.objectContaining({
          subtotal: 75,
          totalAmount: 75,
          taxAmount: 0,
        }),
        undefined
      );
    });

    it("should not validate menu items (skip menu service call)", async () => {
      await orderService.createCompanyOrder("tenant-1", mockInput);

      // menuService.getMenuItemsByIds should NOT be called for company orders
      expect(menuService.getMenuItemsByIds).not.toHaveBeenCalled();
    });

    it("should not emit order.created event", async () => {
      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.created", eventHandler);

      await orderService.createCompanyOrder("tenant-1", mockInput);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Company orders should NOT emit events
      expect(eventHandler).not.toHaveBeenCalled();

      unsubscribe();
    });

    it("should use getNextCompanyOrderSequence for order number generation", async () => {
      await orderService.createCompanyOrder("tenant-1", mockInput);

      expect(sequenceRepository.getNextCompanyOrderSequence).toHaveBeenCalledWith(
        "tenant-1",
        expect.any(String) // dateStr
      );

      // Should NOT call merchant sequence
      expect(sequenceRepository.getNextOrderSequence).not.toHaveBeenCalled();
    });

    it("should create order with loyaltyMemberId when provided", async () => {
      const inputWithLoyalty = {
        ...mockInput,
        loyaltyMemberId: "loyalty-member-456",
      };

      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-gc-1",
        orderNumber: "GC-20260210-0001",
        tenantId: "tenant-1",        merchantId: null,
        loyaltyMemberId: "loyalty-member-456",
        status: "created",
        fulfillmentStatus: "pending",
        customerFirstName: "Jane",
        customerLastName: "Smith",
        customerPhone: "555-123-4567",
        customerEmail: "jane@example.com",
        orderMode: "pickup",
        salesChannel: "giftcard",
        items: mockInput.items,
        subtotal: 50,
        taxAmount: 0,
        tipAmount: 0,
        deliveryFee: 0,
        discount: 0,
        giftCardPayment: 0,
        cashPayment: 50,
        totalAmount: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const order = await orderService.createCompanyOrder("tenant-1", inputWithLoyalty);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        null,
        expect.any(Object),
        "loyalty-member-456"
      );

      expect(order.loyaltyMemberId).toBe("loyalty-member-456");
    });

    it("should calculate payment breakdown with giftCardPayment", async () => {
      const inputWithGiftCard = {
        ...mockInput,
        giftCardPayment: 30,
      };

      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-gc-1",
        orderNumber: "GC-20260210-0001",
        tenantId: "tenant-1",        merchantId: null,
        giftCardPayment: 30,
        cashPayment: 20,
        totalAmount: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await orderService.createCompanyOrder("tenant-1", inputWithGiftCard);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        null,
        expect.objectContaining({
          giftCardPayment: 30,
          cashPayment: 20,
          totalAmount: 50,
        }),
        undefined
      );
    });

    it("should save notes when provided", async () => {
      const inputWithNotes = {
        ...mockInput,
        notes: "Happy Birthday!",
      };

      await orderService.createCompanyOrder("tenant-1", inputWithNotes);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        null,
        expect.objectContaining({
          notes: "Happy Birthday!",
        }),
        undefined
      );
    });

    it("should handle decimal amounts correctly", async () => {
      const decimalInput = {
        ...mockInput,
        items: [
          { menuItemId: "gc-25.50", name: "$25.50 Gift Card", price: 25.5, quantity: 1, selectedModifiers: [], totalPrice: 25.5, taxes: [] },
          { menuItemId: "gc-24.49", name: "$24.49 Gift Card", price: 24.49, quantity: 1, selectedModifiers: [], totalPrice: 24.49, taxes: [] },
        ],
      };

      await orderService.createCompanyOrder("tenant-1", decimalInput);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        null,
        expect.objectContaining({
          subtotal: 49.99,
          totalAmount: 49.99,
        }),
        undefined
      );
    });
  });

  describe("createCompanyOrder() - branch coverage", () => {
    it("should default customerEmail to null when not provided", async () => {
      vi.mocked(sequenceRepository.getNextCompanyOrderSequence).mockResolvedValue(1);
      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-gc-2",
        orderNumber: "GC-20260410-0001",
      } as never);

      await orderService.createCompanyOrder("tenant-1", {        customerFirstName: "Jane",
        customerLastName: "Smith",
        customerPhone: "555-0000",
        // no customerEmail
        items: [
          {
            menuItemId: "gc-1",
            name: "$10 Gift Card",
            price: 10,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: 10,
            taxes: [],
          },
        ],
      });

      const createCall = vi.mocked(orderRepository.create).mock.calls[0];
      const orderData = createCall[2] as unknown as Record<string, unknown>;
      expect(orderData.customerEmail).toBeNull();
    });
  });

  describe("calculateOrderTotals()", () => {
    beforeEach(() => {
      // Default: no taxes assigned to items
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([]);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(new Map());
    });

    it("should calculate subtotal from item prices", async () => {
      const input = {
        items: [
          { menuItemId: "item-1", name: "Item 1", price: 10, quantity: 2, selectedModifiers: [], totalPrice: 20, taxes: [] },
          { menuItemId: "item-2", name: "Item 2", price: 15, quantity: 1, selectedModifiers: [], totalPrice: 15, taxes: [] },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      expect(result.subtotal).toBe(35);
    });

    it("should calculate tax amount from DB, not from frontend-provided taxes", async () => {
      // DB says: item-1 has tax-1 with 10% rate
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", ["tax-1"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        { id: "tax-1", name: "Sales Tax", roundingMethod: "half_up", status: "active" },
      ] as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map([["tax-1", 0.1]])
      );

      const input = {
        items: [
          {
            menuItemId: "item-1",
            name: "Taxable Item",
            price: 100,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: 100,
            // Frontend sends forged 0% rate — should be ignored
            taxes: [{ taxConfigId: "tax-1", name: "Sales Tax", rate: 0, roundingMethod: "half_up" as const }],
          },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      // Tax should be 10% from DB, NOT 0% from frontend
      expect(result.taxAmount).toBe(10);
    });

    it("should ignore frontend tax data and use DB tax data (security fix)", async () => {
      // DB says: item-1 has tax-1 with 8.875% rate
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", ["tax-1"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        { id: "tax-1", name: "Sales Tax", roundingMethod: "half_up", status: "active" },
      ] as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map([["tax-1", 0.08875]])
      );

      const input = {
        items: [
          {
            menuItemId: "item-1",
            name: "Pizza",
            price: 20,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: 20,
            // Attacker forges rate to 0
            taxes: [{ taxConfigId: "tax-1", name: "Sales Tax", rate: 0, roundingMethod: "half_up" as const }],
          },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      // 8.875% of $20 = $1.78 (rounded half_up)
      expect(result.taxAmount).toBe(1.78);
      expect(result.totalAmount).toBe(21.78);
    });

    it("should handle item with no taxes in DB", async () => {
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", []]])
      );

      const input = {
        items: [
          { menuItemId: "item-1", name: "Item", price: 20, quantity: 1, selectedModifiers: [], totalPrice: 20, taxes: [] },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      expect(result.taxAmount).toBe(0);
      expect(result.totalAmount).toBe(20);
    });

    it("should handle item with multiple taxes from DB", async () => {
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", ["tax-1", "tax-2"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        { id: "tax-1", name: "Sales Tax", roundingMethod: "half_up", status: "active" },
        { id: "tax-2", name: "Alcohol Tax", roundingMethod: "half_up", status: "active" },
      ] as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map([["tax-1", 0.08], ["tax-2", 0.05]])
      );

      const input = {
        items: [
          {
            menuItemId: "item-1",
            name: "Alcohol",
            price: 100,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: 100,
            taxes: [],
          },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      // 8% + 5% = 13% of $100 = $13
      expect(result.taxAmount).toBe(13);
      expect(result.totalAmount).toBe(113);
    });

    it("should handle missing merchant rate (default to 0)", async () => {
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", ["tax-1"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        { id: "tax-1", name: "Sales Tax", roundingMethod: "half_up", status: "active" },
      ] as never);
      // No merchant rate configured for tax-1
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(new Map());

      const input = {
        items: [
          {
            menuItemId: "item-1",
            name: "Item",
            price: 100,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: 100,
            taxes: [],
          },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      // Rate defaults to 0 when no merchant rate configured
      expect(result.taxAmount).toBe(0);
      expect(result.totalAmount).toBe(100);
    });

    it("should add delivery fee for delivery orders", async () => {
      const input = {
        items: [
          { menuItemId: "item-1", name: "Item", price: 20, quantity: 1, selectedModifiers: [], totalPrice: 20, taxes: [] },
        ],
        orderMode: "delivery" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      expect(result.deliveryFee).toBe(3.99);
      expect(result.totalAmount).toBe(23.99);
    });

    it("should not add delivery fee for pickup orders", async () => {
      const input = {
        items: [
          { menuItemId: "item-1", name: "Item", price: 20, quantity: 1, selectedModifiers: [], totalPrice: 20, taxes: [] },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      expect(result.deliveryFee).toBe(0);
      expect(result.totalAmount).toBe(20);
    });

    it("should include tip in total amount", async () => {
      const input = {
        items: [
          { menuItemId: "item-1", name: "Item", price: 20, quantity: 1, selectedModifiers: [], totalPrice: 20, taxes: [] },
        ],
        orderMode: "pickup" as const,
        tipAmount: 5,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      expect(result.tipAmount).toBe(5);
      expect(result.totalAmount).toBe(25);
    });

    it("should pass tenantId to getTaxConfigsByIds for tenant isolation", async () => {
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", ["tax-1"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        { id: "tax-1", name: "Sales Tax", roundingMethod: "half_up", status: "active" },
      ] as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map([["tax-1", 0.1]])
      );

      const input = {
        items: [
          { menuItemId: "item-1", name: "Item", price: 10, quantity: 1, selectedModifiers: [], totalPrice: 10, taxes: [] },
        ],
        orderMode: "pickup" as const,
      };

      await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      expect(taxConfigRepository.getTaxConfigsByIds).toHaveBeenCalledWith("tenant-1", ["tax-1"]);
      expect(taxConfigRepository.getMerchantTaxRateMap).toHaveBeenCalledWith("merchant-1");
    });
  });

  describe("getTenantOrders()", () => {
    it("should call repository with correct parameters", async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      vi.mocked(orderRepository.getTenantOrders).mockResolvedValue(mockResult);

      const options = {
        status: "created" as OrderStatus,
        fulfillmentStatus: "pending" as FulfillmentStatus,
        page: 2,
        pageSize: 10,
      };

      await orderService.getTenantOrders("tenant-1", options);

      expect(orderRepository.getTenantOrders).toHaveBeenCalledWith(
        "tenant-1",
        options
      );
    });

    it("should return paginated orders for a company", async () => {
      const mockOrders = [
        {
          id: "order-1",
          orderNumber: "#001",
          status: "created",
          fulfillmentStatus: "pending",
          merchantId: "merchant-1",
          merchant: { id: "merchant-1", name: "Downtown", slug: "downtown" },
        },
        {
          id: "order-2",
          orderNumber: "#002",
          status: "completed",
          fulfillmentStatus: "fulfilled",
          merchantId: "merchant-2",
          merchant: { id: "merchant-2", name: "Uptown", slug: "uptown" },
        },
      ];
      const mockResult = {
        items: mockOrders,
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
      vi.mocked(orderRepository.getTenantOrders).mockResolvedValue(mockResult as never);

      const result = await orderService.getTenantOrders("tenant-1");

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  describe("getMemberOrders()", () => {
    it("should return paginated orders for a loyalty member", async () => {
      const mockResult = {
        items: [
          {
            id: "order-1",
            tenantId: "tenant-1",
            loyaltyMemberId: "member-1",
            orderNumber: "#001",
            status: "completed",
            fulfillmentStatus: "fulfilled",
            orderMode: "pickup",
            totalAmount: 45.99,
            createdAt: new Date("2024-01-15"),
            merchant: {
              id: "merchant-1",
              name: "Downtown Store",
              slug: "downtown",
              timezone: "America/New_York",
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      vi.mocked(orderRepository.getOrdersByLoyaltyMember).mockResolvedValue(
        mockResult as never
      );

      const result = await orderService.getMemberOrders("tenant-1", "member-1");

      expect(orderRepository.getOrdersByLoyaltyMember).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        undefined
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("createMerchantOrderAtomic()", () => {
    const mockInput = {      merchantId: "merchant-1",
      customerFirstName: "John",
      customerLastName: "Doe",
      customerPhone: "123-456-7890",
      customerEmail: "john@example.com",
      orderMode: "pickup" as const,
      items: [
        {
          menuItemId: "item-1",
          name: "Margherita Pizza",
          price: 18.99,
          quantity: 2,
          selectedModifiers: [],
          totalPrice: 37.98,
          taxes: [{ taxConfigId: "tax-1", name: "Standard Tax", rate: 0.08875, roundingMethod: "half_up" as const }],
        },
      ],
      tipAmount: 5,
    };

    const mockOrder = {
      id: "order-1",
      orderNumber: "20260127-0001",
      tenantId: "tenant-1",
      merchantId: "merchant-1",
      status: "created",
      fulfillmentStatus: "pending",
      customerFirstName: "John",
      customerLastName: "Doe",
      customerPhone: "123-456-7890",
      customerEmail: "john@example.com",
      orderMode: "pickup",
      items: mockInput.items,
      subtotal: 37.98,
      taxAmount: 0,
      tipAmount: 5,
      deliveryFee: 0,
      discount: 0,
      giftCardPayment: 0,
      cashPayment: 42.98,
      totalAmount: 42.98,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      vi.mocked(menuService.getMenuItemsByIds).mockResolvedValue([
        { id: "item-1", name: "Margherita Pizza" },
      ] as never);

      // Mock tax config repository for atomic tests
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", ["tax-1"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        { id: "tax-1", name: "Sales Tax", roundingMethod: "half_up", status: "active" },
      ] as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map([["tax-1", 0.08875]])
      );

      vi.mocked(merchantService.getMerchantById).mockResolvedValue({
        id: "merchant-1",
        name: "Test Merchant",
        slug: "test-merchant",
        timezone: "America/New_York",
      } as never);

      vi.mocked(sequenceRepository.getNextOrderSequence).mockResolvedValue(1);

      vi.mocked(orderRepository.create).mockResolvedValue(mockOrder as never);

      vi.mocked(giftCardService.redeemGiftCard).mockResolvedValue({
        success: true,
        amountRedeemed: 20,
        remainingBalance: 30,
        transactionId: "gc-tx-1",
      } as never);

      vi.mocked(paymentService.createPaymentRecord).mockResolvedValue({
        id: "payment-1",
      } as never);
    });

    it("should wrap order creation in a transaction", async () => {
      await orderService.createMerchantOrderAtomic("tenant-1", mockInput);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should create order and return it", async () => {
      const order = await orderService.createMerchantOrderAtomic("tenant-1", mockInput);

      expect(order.id).toBe("order-1");
      expect(orderRepository.create).toHaveBeenCalled();
    });

    it("should redeem gift card within the transaction when provided", async () => {
      await orderService.createMerchantOrderAtomic("tenant-1", mockInput, {
        giftCard: { id: "gc-1", amount: 20 },
      });

      expect(giftCardService.redeemGiftCard).toHaveBeenCalledWith(
        "tenant-1",
        "gc-1",
        "order-1",
        20,
        expect.anything() // tx
      );
    });

    it("should create payment record within the transaction when provided", async () => {
      await orderService.createMerchantOrderAtomic("tenant-1", mockInput, {
        payment: {
          stripePaymentIntentId: "pi_123",
          amount: 42.98,
          currency: "USD",
        },
      });

      expect(paymentService.createPaymentRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          orderId: "order-1",
          stripePaymentIntentId: "pi_123",
          amount: 42.98,
          currency: "USD",
        }),
        expect.anything() // tx
      );
    });

    it("should not call gift card or payment services when options are not provided", async () => {
      await orderService.createMerchantOrderAtomic("tenant-1", mockInput);

      expect(giftCardService.redeemGiftCard).not.toHaveBeenCalled();
      expect(paymentService.createPaymentRecord).not.toHaveBeenCalled();
    });

    it("should handle both gift card and payment in the same transaction", async () => {
      await orderService.createMerchantOrderAtomic("tenant-1", mockInput, {
        giftCard: { id: "gc-1", amount: 20 },
        payment: {
          stripePaymentIntentId: "pi_123",
          amount: 22.98,
          currency: "USD",
        },
      });

      expect(giftCardService.redeemGiftCard).toHaveBeenCalled();
      expect(paymentService.createPaymentRecord).toHaveBeenCalled();
    });

    it("should rollback all operations when gift card redemption fails", async () => {
      const transactionError = new Error("Insufficient gift card balance");
      vi.mocked(giftCardService.redeemGiftCard).mockRejectedValue(transactionError);

      // Mock $transaction to actually propagate the error (simulating real Prisma behavior)
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return (fn as (tx: unknown) => Promise<unknown>)(Symbol("tx"));
      });

      await expect(
        orderService.createMerchantOrderAtomic("tenant-1", mockInput, {
          giftCard: { id: "gc-1", amount: 20 },
        })
      ).rejects.toThrow("Insufficient gift card balance");
    });

    it("should rollback all operations when payment record creation fails", async () => {
      const transactionError = new Error("Payment record creation failed");
      vi.mocked(paymentService.createPaymentRecord).mockRejectedValue(transactionError);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return (fn as (tx: unknown) => Promise<unknown>)(Symbol("tx"));
      });

      await expect(
        orderService.createMerchantOrderAtomic("tenant-1", mockInput, {
          payment: {
            stripePaymentIntentId: "pi_123",
            amount: 42.98,
            currency: "USD",
          },
        })
      ).rejects.toThrow("Payment record creation failed");
    });

    it("should emit order.created event AFTER transaction commits", async () => {
      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.created", eventHandler);

      await orderService.createMerchantOrderAtomic("tenant-1", mockInput);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          orderNumber: "20260127-0001",
          merchantId: "merchant-1",
        })
      );

      unsubscribe();
    });

    it("should NOT emit event when transaction fails", async () => {
      vi.mocked(giftCardService.redeemGiftCard).mockRejectedValue(
        new Error("Gift card error")
      );
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return (fn as (tx: unknown) => Promise<unknown>)(Symbol("tx"));
      });

      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.created", eventHandler);

      await expect(
        orderService.createMerchantOrderAtomic("tenant-1", mockInput, {
          giftCard: { id: "gc-1", amount: 20 },
        })
      ).rejects.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).not.toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe("getOrder()", () => {
    it("should delegate to orderRepository.getByIdWithMerchant", async () => {
      const mockOrder = { id: "order-1", orderNumber: "ORD-001" };
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);

      const result = await orderService.getOrder("tenant-1", "order-1");

      expect(orderRepository.getByIdWithMerchant).toHaveBeenCalledWith("tenant-1", "order-1");
      expect(result).toEqual(mockOrder);
    });

    it("should return null when order not found", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(null);

      const result = await orderService.getOrder("tenant-1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getOrderWithTimeline()", () => {
    const now = new Date("2026-04-10T12:00:00Z");

    it("should return null when order not found", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(null);

      const result = await orderService.getOrderWithTimeline("tenant-1", "order-1");

      expect(result).toBeNull();
    });

    it("should build timeline with all events for a fully fulfilled order", async () => {
      const paidAt = new Date("2026-04-10T12:01:00Z");
      const confirmedAt = new Date("2026-04-10T12:02:00Z");
      const preparingAt = new Date("2026-04-10T12:05:00Z");
      const readyAt = new Date("2026-04-10T12:20:00Z");
      const fulfilledAt = new Date("2026-04-10T12:25:00Z");

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        id: "order-1",
        status: "paid",
        fulfillmentStatus: "fulfilled",
        createdAt: now,
        paidAt,
        confirmedAt,
        preparingAt,
        readyAt,
        fulfilledAt,
        cancelledAt: null,
      } as never);

      vi.mocked(pointTransactionRepository.getByOrderId).mockResolvedValue(null);

      const result = await orderService.getOrderWithTimeline("tenant-1", "order-1");

      expect(result).not.toBeNull();
      expect(result!.timeline).toHaveLength(6);
      expect(result!.timeline[0]).toEqual({ type: "payment", status: "created", timestamp: now });
      expect(result!.timeline[1]).toEqual({ type: "payment", status: "completed", timestamp: paidAt });
      expect(result!.timeline[2]).toEqual({ type: "fulfillment", status: "confirmed", timestamp: confirmedAt });
      expect(result!.timeline[3]).toEqual({ type: "fulfillment", status: "preparing", timestamp: preparingAt });
      expect(result!.timeline[4]).toEqual({ type: "fulfillment", status: "ready", timestamp: readyAt });
      expect(result!.timeline[5]).toEqual({ type: "fulfillment", status: "fulfilled", timestamp: fulfilledAt });
      expect(result!.pointsEarned).toBeUndefined();
    });

    it("should include cancelled event in timeline", async () => {
      const cancelledAt = new Date("2026-04-10T12:03:00Z");

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        id: "order-1",
        status: "canceled",
        fulfillmentStatus: "pending",
        createdAt: now,
        paidAt: null,
        confirmedAt: null,
        preparingAt: null,
        readyAt: null,
        fulfilledAt: null,
        cancelledAt,
      } as never);

      vi.mocked(pointTransactionRepository.getByOrderId).mockResolvedValue(null);

      const result = await orderService.getOrderWithTimeline("tenant-1", "order-1");

      expect(result!.timeline).toHaveLength(2);
      expect(result!.timeline[1]).toEqual({ type: "payment", status: "canceled", timestamp: cancelledAt });
    });

    it("should include pointsEarned when earn transaction exists", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        id: "order-1",
        status: "paid",
        fulfillmentStatus: "fulfilled",
        createdAt: now,
        paidAt: new Date("2026-04-10T12:01:00Z"),
        confirmedAt: null,
        preparingAt: null,
        readyAt: null,
        fulfilledAt: null,
        cancelledAt: null,
      } as never);

      vi.mocked(pointTransactionRepository.getByOrderId).mockResolvedValue({
        id: "pt-1",
        type: "earn",
        points: 100,
      } as never);

      const result = await orderService.getOrderWithTimeline("tenant-1", "order-1");

      expect(result!.pointsEarned).toBe(100);
    });

    it("should not include pointsEarned for non-earn transaction types", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        id: "order-1",
        status: "paid",
        fulfillmentStatus: "fulfilled",
        createdAt: now,
        paidAt: null,
        confirmedAt: null,
        preparingAt: null,
        readyAt: null,
        fulfilledAt: null,
        cancelledAt: null,
      } as never);

      vi.mocked(pointTransactionRepository.getByOrderId).mockResolvedValue({
        id: "pt-1",
        type: "redeem",
        points: 50,
      } as never);

      const result = await orderService.getOrderWithTimeline("tenant-1", "order-1");

      expect(result!.pointsEarned).toBeUndefined();
    });

    it("should sort timeline events by timestamp", async () => {
      // Create events out of chronological order to verify sorting
      const cancelledAt = new Date("2026-04-10T12:01:00Z");
      const paidAt = new Date("2026-04-10T12:00:30Z");

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        id: "order-1",
        status: "canceled",
        fulfillmentStatus: "pending",
        createdAt: now,
        paidAt,
        confirmedAt: null,
        preparingAt: null,
        readyAt: null,
        fulfilledAt: null,
        cancelledAt,
      } as never);

      vi.mocked(pointTransactionRepository.getByOrderId).mockResolvedValue(null);

      const result = await orderService.getOrderWithTimeline("tenant-1", "order-1");

      // Should be sorted: created -> paid -> cancelled
      expect(result!.timeline[0].status).toBe("created");
      expect(result!.timeline[1].status).toBe("completed");
      expect(result!.timeline[2].status).toBe("canceled");
    });
  });

  describe("linkLoyaltyMember()", () => {
    it("should delegate to orderRepository.updateLoyaltyMemberId", async () => {
      vi.mocked(orderRepository.updateLoyaltyMemberId).mockResolvedValue({
        id: "order-1",
        loyaltyMemberId: "member-1",
      } as never);

      const result = await orderService.linkLoyaltyMember("tenant-1", "order-1", "member-1");

      expect(orderRepository.updateLoyaltyMemberId).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "member-1"
      );
      expect(result).toEqual(expect.objectContaining({ loyaltyMemberId: "member-1" }));
    });
  });

  describe("createMerchantOrder() - branch coverage", () => {
    const mockInput = {      merchantId: "merchant-1",
      customerFirstName: "Jane",
      customerLastName: "Smith",
      customerPhone: "555-0000",
      orderMode: "pickup" as const,
      items: [
        {
          menuItemId: "item-1",
          name: "Test Item",
          price: 10.0,
          quantity: 1,
          selectedModifiers: [],
          totalPrice: 10.0,
          taxes: [],
        },
      ],
      tipAmount: 0,
    };

    beforeEach(() => {
      vi.mocked(menuService.getMenuItemsByIds).mockResolvedValue([
        { id: "item-1", name: "Test Item" },
      ] as never);
      vi.mocked(taxConfigService.getTaxConfigsMap).mockResolvedValue(new Map());
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([]);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(new Map());
      vi.mocked(merchantService.getMerchant).mockResolvedValue({
        id: "merchant-1",
        name: "Test Merchant",
        slug: "test-merchant",
      } as never);
      vi.mocked(sequenceRepository.getNextOrderSequence).mockResolvedValue(1);
      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-1",
        orderNumber: "001",
      } as never);
    });

    it("should use ISO date when merchant has no timezone", async () => {
      vi.mocked(merchantService.getMerchantById).mockResolvedValue({
        id: "merchant-1",
        name: "Test Merchant",
        slug: "test-merchant",
        timezone: undefined,
      } as never);

      await orderService.createMerchantOrder("tenant-1", mockInput);

      expect(orderRepository.create).toHaveBeenCalled();
    });

    it("should default customerEmail to null when not provided", async () => {
      vi.mocked(merchantService.getMerchantById).mockResolvedValue({
        id: "merchant-1",
        name: "Test Merchant",
        slug: "test-merchant",
        timezone: "America/New_York",
      } as never);

      await orderService.createMerchantOrder("tenant-1", mockInput);

      const createCall = vi.mocked(orderRepository.create).mock.calls[0];
      // The 4th argument is the order data object
      const orderData = createCall[2] as unknown as Record<string, unknown>;
      expect(orderData.customerEmail).toBeNull();
    });

    it("should handle missing tax config in item tax resolution", async () => {
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-1", ["tax-missing"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([]);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(new Map());
      vi.mocked(merchantService.getMerchantById).mockResolvedValue({
        id: "merchant-1",
        name: "Test Merchant",
        slug: "test-merchant",
        timezone: "America/New_York",
      } as never);

      await orderService.createMerchantOrder("tenant-1", mockInput);

      expect(orderRepository.create).toHaveBeenCalled();
    });
  });
});
