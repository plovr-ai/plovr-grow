import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "../order.service";
import { orderEventEmitter } from "../order-events";
import type { OrderStatus } from "@/types";

// Mock dependencies
vi.mock("@/repositories/order.repository", () => ({
  orderRepository: {
    create: vi.fn(),
    getById: vi.fn(),
    getByIdWithMerchant: vi.fn(),
    getByOrderNumber: vi.fn(),
    getOrders: vi.fn(),
    getTodayOrders: vi.fn(),
    updateStatus: vi.fn(),
    updateStatusAndReturn: vi.fn(),
    getNextOrderSequence: vi.fn(),
    getNextMerchantOrderSequence: vi.fn(),
    getStats: vi.fn(),
    getCompanyOrders: vi.fn(),
    getMerchantOrders: vi.fn(),
    getMerchantTodayOrders: vi.fn(),
    getMerchantStats: vi.fn(),
    countPendingOrders: vi.fn(),
    updateLoyaltyMemberId: vi.fn(),
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
    getNextCateringOrderSequence: vi.fn(),
    getNextInvoiceSequence: vi.fn(),
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

  describe("validateStatusTransition()", () => {
    it("should allow valid transitions from pending", () => {
      expect(orderService.validateStatusTransition("pending", "confirmed")).toBe(true);
      expect(orderService.validateStatusTransition("pending", "cancelled")).toBe(true);
    });

    it("should allow valid transitions from confirmed", () => {
      expect(orderService.validateStatusTransition("confirmed", "preparing")).toBe(true);
      expect(orderService.validateStatusTransition("confirmed", "cancelled")).toBe(true);
    });

    it("should allow valid transitions from preparing", () => {
      expect(orderService.validateStatusTransition("preparing", "ready")).toBe(true);
      expect(orderService.validateStatusTransition("preparing", "cancelled")).toBe(true);
    });

    it("should allow valid transitions from ready", () => {
      expect(orderService.validateStatusTransition("ready", "completed")).toBe(true);
      expect(orderService.validateStatusTransition("ready", "cancelled")).toBe(true);
    });

    it("should not allow transitions from completed", () => {
      expect(orderService.validateStatusTransition("completed", "cancelled")).toBe(false);
      expect(orderService.validateStatusTransition("completed", "pending")).toBe(false);
    });

    it("should not allow transitions from cancelled", () => {
      expect(orderService.validateStatusTransition("cancelled", "pending")).toBe(false);
      expect(orderService.validateStatusTransition("cancelled", "completed")).toBe(false);
    });

    it("should not allow invalid transitions", () => {
      expect(orderService.validateStatusTransition("pending", "ready")).toBe(false);
      expect(orderService.validateStatusTransition("pending", "completed")).toBe(false);
      expect(orderService.validateStatusTransition("confirmed", "completed")).toBe(false);
      expect(orderService.validateStatusTransition("preparing", "confirmed")).toBe(false);
    });
  });

  describe("createOrder()", () => {
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

      vi.mocked(orderRepository.getNextMerchantOrderSequence).mockResolvedValue(1);

      vi.mocked(orderRepository.create).mockResolvedValue({
        id: "order-1",
        orderNumber: "20260127-0001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "pending",
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

    it("should create order with merchantId", async () => {
      const order = await orderService.createOrder("tenant-1", mockInput);

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
          status: "pending",
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
        status: "pending",
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

      const order = await orderService.createOrder("tenant-1", inputWithLoyalty);

      expect(orderRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        "merchant-1",
        expect.objectContaining({
          orderNumber: expect.any(String),
          customerFirstName: "John",
          customerLastName: "Doe",
          status: "pending",
        }),
        "loyalty-member-123"
      );

      expect(order.id).toBe("order-1");
      expect(order.loyaltyMemberId).toBe("loyalty-member-123");
    });

    it("should validate menu items exist", async () => {
      vi.mocked(menuService.getMenuItemsByIds).mockResolvedValue([]);

      await expect(orderService.createOrder("tenant-1", mockInput)).rejects.toThrow(
        "Some menu items are not available"
      );
    });

    it("should emit order.created event", async () => {
      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.created", eventHandler);

      await orderService.createOrder("tenant-1", mockInput);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          orderNumber: "20260127-0001",
          merchantId: "merchant-1",
          tenantId: "tenant-1",
          status: "pending",
          customerFirstName: "John",
          customerLastName: "Doe",
        })
      );

      unsubscribe();
    });

    it("should use merchant-specific order sequence", async () => {
      await orderService.createOrder("tenant-1", mockInput);

      expect(sequenceRepository.getNextOrderSequence).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        expect.any(String) // date string
      );
    });
  });

  describe("updateOrderStatus()", () => {
    const mockOrder = {
      id: "order-1",
      orderNumber: "#001",
      tenantId: "tenant-1",
      merchantId: "merchant-1",
      status: "pending",
      customerName: "John Doe",
      customerPhone: "123-456-7890",
    };

    beforeEach(() => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "confirmed",
        confirmedAt: new Date(),
      } as never);
    });

    it("should update order status", async () => {
      const result = await orderService.updateOrderStatus("tenant-1", "order-1", {
        status: "confirmed",
      });

      expect(orderRepository.updateStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "confirmed",
        expect.objectContaining({
          confirmedAt: expect.any(Date),
        })
      );

      expect(result.status).toBe("confirmed");
    });

    it("should throw error for invalid status transition", async () => {
      await expect(
        orderService.updateOrderStatus("tenant-1", "order-1", {
          status: "completed", // Invalid: pending -> completed
        })
      ).rejects.toThrow("Invalid status transition from pending to completed");
    });

    it("should throw error if order not found", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(null);

      await expect(
        orderService.updateOrderStatus("tenant-1", "order-1", {
          status: "confirmed",
        })
      ).rejects.toThrow("Order not found");
    });

    it("should emit status change event", async () => {
      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.confirmed", eventHandler);

      await orderService.updateOrderStatus("tenant-1", "order-1", {
        status: "confirmed",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          merchantId: "merchant-1",
          status: "confirmed",
          previousStatus: "pending",
        })
      );

      unsubscribe();
    });

    it("should include cancelReason in event for cancelled orders", async () => {
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: "Customer requested",
      } as never);

      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.cancelled", eventHandler);

      await orderService.updateOrderStatus("tenant-1", "order-1", {
        status: "cancelled",
        cancelReason: "Customer requested",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          cancelReason: "Customer requested",
        })
      );

      unsubscribe();
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
        status: "pending" as OrderStatus,
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
          status: "pending",
          merchantId: "merchant-1",
          merchant: { id: "merchant-1", name: "Downtown", slug: "downtown" },
        },
        {
          id: "order-2",
          orderNumber: "#002",
          status: "completed",
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

    it("should filter by merchantId when provided", async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      vi.mocked(orderRepository.getCompanyOrders).mockResolvedValue(mockResult);

      await orderService.getCompanyOrders("tenant-1", "company-1", {
        merchantId: "merchant-1",
        status: "pending" as OrderStatus,
      });

      expect(orderRepository.getCompanyOrders).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        {
          merchantId: "merchant-1",
          status: "pending",
        }
      );
    });
  });

  describe("getMerchantOrders()", () => {
    it("should call repository with correct parameters", async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      vi.mocked(orderRepository.getMerchantOrders).mockResolvedValue(mockResult);

      const options = {
        status: "pending" as OrderStatus,
        page: 2,
        pageSize: 10,
      };

      await orderService.getMerchantOrders("tenant-1", "merchant-1", options);

      expect(orderRepository.getMerchantOrders).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        options
      );
    });
  });

  describe("getMerchantTodayOrders()", () => {
    it("should call repository with correct parameters", async () => {
      vi.mocked(orderRepository.getMerchantTodayOrders).mockResolvedValue([]);

      await orderService.getMerchantTodayOrders("tenant-1", "merchant-1");

      expect(orderRepository.getMerchantTodayOrders).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1"
      );
    });
  });

  describe("getMerchantOrderStats()", () => {
    it("should call repository with date range", async () => {
      const mockStats = {
        totalOrders: 10,
        totalRevenue: 500,
        averageOrderValue: 50,
        ordersByStatus: { completed: 8, cancelled: 2 },
        ordersByType: { pickup: 6, delivery: 4 },
      };
      vi.mocked(orderRepository.getMerchantStats).mockResolvedValue(mockStats);

      const dateFrom = new Date("2024-01-01");
      const dateTo = new Date("2024-01-31");

      const result = await orderService.getMerchantOrderStats(
        "tenant-1",
        "merchant-1",
        dateFrom,
        dateTo
      );

      expect(orderRepository.getMerchantStats).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1",
        dateFrom,
        dateTo
      );

      expect(result.totalOrders).toBe(10);
      expect(result.totalRevenue).toBe(500);
    });
  });

  describe("countMerchantPendingOrders()", () => {
    it("should return pending order count", async () => {
      vi.mocked(orderRepository.countPendingOrders).mockResolvedValue(5);

      const count = await orderService.countMerchantPendingOrders("tenant-1", "merchant-1");

      expect(orderRepository.countPendingOrders).toHaveBeenCalledWith(
        "tenant-1",
        "merchant-1"
      );
      expect(count).toBe(5);
    });
  });

  describe("linkLoyaltyMember()", () => {
    it("should call repository to update loyalty member id", async () => {
      vi.mocked(orderRepository.updateLoyaltyMemberId).mockResolvedValue({
        id: "order-1",
        loyaltyMemberId: "member-123",
      } as never);

      await orderService.linkLoyaltyMember("tenant-1", "order-1", "member-123");

      expect(orderRepository.updateLoyaltyMemberId).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "member-123"
      );
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
          {
            id: "order-2",
            tenantId: "tenant-1",
            loyaltyMemberId: "member-1",
            orderNumber: "#002",
            status: "pending",
            orderMode: "delivery",
            totalAmount: 78.5,
            createdAt: new Date("2024-01-20"),
            merchant: {
              id: "merchant-2",
              name: "Uptown Store",
              slug: "uptown",
              timezone: "America/New_York",
            },
          },
        ],
        total: 2,
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

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it("should pass pagination options to repository", async () => {
      vi.mocked(orderRepository.getOrdersByLoyaltyMember).mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 5,
        totalPages: 0,
      } as never);

      await orderService.getMemberOrders("tenant-1", "member-1", {
        page: 2,
        pageSize: 5,
      });

      expect(orderRepository.getOrdersByLoyaltyMember).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        {
          page: 2,
          pageSize: 5,
        }
      );
    });

    it("should return empty results when member has no orders", async () => {
      vi.mocked(orderRepository.getOrdersByLoyaltyMember).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      } as never);

      const result = await orderService.getMemberOrders("tenant-1", "member-1");

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should handle multiple pages of orders", async () => {
      vi.mocked(orderRepository.getOrdersByLoyaltyMember).mockResolvedValue({
        items: [],
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      } as never);

      const result = await orderService.getMemberOrders("tenant-1", "member-1", {
        page: 2,
        pageSize: 10,
      });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.total).toBe(25);
    });
  });
});
