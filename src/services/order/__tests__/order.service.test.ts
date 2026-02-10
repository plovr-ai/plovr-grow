import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "../order.service";
import { orderEventEmitter } from "../order-events";
import type { OrderStatus, FulfillmentStatus } from "@/types";

// Mock dependencies
vi.mock("@/repositories/order.repository", () => ({
  orderRepository: {
    create: vi.fn(),
    getByIdWithMerchant: vi.fn(),
    getCompanyOrders: vi.fn(),
    getOrdersByLoyaltyMember: vi.fn(),
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

// Import mocked modules
import { orderRepository } from "@/repositories/order.repository";
import { sequenceRepository } from "@/repositories/sequence.repository";
import { menuService, taxConfigService } from "@/services/menu";
import { merchantService } from "@/services/merchant";

describe("OrderService", () => {
  let orderService: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    orderService = new OrderService();
  });

  describe("createMerchantOrder()", () => {
    const mockInput = {
      companyId: "company-1",
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
        new Map([["tax-1", { rate: 0.08875, roundingMethod: "standard" }]])
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
        "company-1",
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
        undefined // loyaltyMemberId
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
        "company-1",
        "merchant-1",
        expect.objectContaining({
          orderNumber: expect.any(String),
          customerFirstName: "John",
          customerLastName: "Doe",
          status: "created",
          fulfillmentStatus: "pending",
        }),
        "loyalty-member-123"
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
        "company-1",
        "merchant-1",
        expect.objectContaining({
          orderMode: "delivery",
          deliveryFee: 3.99,
          deliveryAddress: deliveryInput.deliveryAddress,
        }),
        undefined
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
        "company-1",
        "merchant-1",
        expect.objectContaining({
          giftCardPayment: 20,
          cashPayment: expect.any(Number),
        }),
        undefined
      );
    });

    it("should default salesChannel to online_order when not provided", async () => {
      await orderService.createMerchantOrder("tenant-1", mockInput);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        "merchant-1",
        expect.objectContaining({
          salesChannel: "online_order",
        }),
        undefined
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
        "company-1",
        "merchant-1",
        expect.objectContaining({
          notes: "No onions please",
        }),
        undefined
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
        "company-1",
        "merchant-1",
        expect.objectContaining({
          scheduledAt: scheduledTime,
        }),
        undefined
      );
    });
  });

  describe("createCompanyOrder()", () => {
    const mockInput = {
      companyId: "company-1",
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
        tenantId: "tenant-1",
        companyId: "company-1",
        merchantId: null,
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
        "company-1",
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
        "company-1",
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
        "company-1",
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
        tenantId: "tenant-1",
        companyId: "company-1",
        merchantId: null,
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
        "company-1",
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
        tenantId: "tenant-1",
        companyId: "company-1",
        merchantId: null,
        giftCardPayment: 30,
        cashPayment: 20,
        totalAmount: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await orderService.createCompanyOrder("tenant-1", inputWithGiftCard);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
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
        "company-1",
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
        "company-1",
        null,
        expect.objectContaining({
          subtotal: 49.99,
          totalAmount: 49.99,
        }),
        undefined
      );
    });
  });

  describe("calculateOrderTotals()", () => {
    beforeEach(() => {
      vi.mocked(menuService.getMenuItemsByIds).mockResolvedValue([
        { id: "item-1", name: "Test Item" },
      ] as never);
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

    it("should calculate tax amount based on item taxes", async () => {
      const input = {
        items: [
          {
            menuItemId: "item-1",
            name: "Taxable Item",
            price: 100,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: 100,
            taxes: [{ taxConfigId: "tax-1", name: "Sales Tax", rate: 0.1, roundingMethod: "half_up" as const }],
          },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      expect(result.taxAmount).toBe(10);
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

    it("should calculate multiple taxes for same item", async () => {
      const input = {
        items: [
          {
            menuItemId: "item-1",
            name: "Alcohol",
            price: 100,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: 100,
            taxes: [
              { taxConfigId: "tax-1", name: "Sales Tax", rate: 0.08, roundingMethod: "half_up" as const },
              { taxConfigId: "tax-2", name: "Alcohol Tax", rate: 0.05, roundingMethod: "half_up" as const },
            ],
          },
        ],
        orderMode: "pickup" as const,
      };

      const result = await orderService.calculateOrderTotals("tenant-1", "merchant-1", input);

      // 8% + 5% = 13% of $100 = $13
      expect(result.taxAmount).toBe(13);
      expect(result.totalAmount).toBe(113);
    });
  });

  describe("getCompanyOrders()", () => {
    it("should call repository with correct parameters", async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      vi.mocked(orderRepository.getCompanyOrders).mockResolvedValue(mockResult);

      const options = {
        status: "created" as OrderStatus,
        fulfillmentStatus: "pending" as FulfillmentStatus,
        page: 2,
        pageSize: 10,
      };

      await orderService.getCompanyOrders("tenant-1", "company-1", options);

      expect(orderRepository.getCompanyOrders).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
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
      vi.mocked(orderRepository.getCompanyOrders).mockResolvedValue(mockResult as never);

      const result = await orderService.getCompanyOrders("tenant-1", "company-1");

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
});
