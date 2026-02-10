import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "../order.service";
import { orderEventEmitter } from "../order-events";
import type { OrderStatus, FulfillmentStatus } from "@/types";

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
    updateFulfillmentStatus: vi.fn(),
    updateFulfillmentStatusAndReturn: vi.fn(),
    getNextOrderSequence: vi.fn(),
    getNextMerchantOrderSequence: vi.fn(),
    getStats: vi.fn(),
    getCompanyOrders: vi.fn(),
    getMerchantOrders: vi.fn(),
    getMerchantTodayOrders: vi.fn(),
    getMerchantStats: vi.fn(),
    countActiveOrders: vi.fn(),
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

  describe("validatePaymentStatusTransition()", () => {
    it("should allow valid transitions from created", () => {
      expect(orderService.validatePaymentStatusTransition("created", "partial_paid")).toBe(true);
      expect(orderService.validatePaymentStatusTransition("created", "completed")).toBe(true);
      expect(orderService.validatePaymentStatusTransition("created", "canceled")).toBe(true);
    });

    it("should allow valid transitions from partial_paid", () => {
      expect(orderService.validatePaymentStatusTransition("partial_paid", "completed")).toBe(true);
      expect(orderService.validatePaymentStatusTransition("partial_paid", "canceled")).toBe(true);
    });

    it("should not allow transitions from completed", () => {
      expect(orderService.validatePaymentStatusTransition("completed", "canceled")).toBe(false);
      expect(orderService.validatePaymentStatusTransition("completed", "created")).toBe(false);
    });

    it("should not allow transitions from canceled", () => {
      expect(orderService.validatePaymentStatusTransition("canceled", "created")).toBe(false);
      expect(orderService.validatePaymentStatusTransition("canceled", "completed")).toBe(false);
    });

    it("should not allow backward transitions", () => {
      expect(orderService.validatePaymentStatusTransition("partial_paid", "created")).toBe(false);
      expect(orderService.validatePaymentStatusTransition("completed", "partial_paid")).toBe(false);
    });
  });

  describe("validateFulfillmentStatusTransition()", () => {
    it("should allow valid forward transitions", () => {
      expect(orderService.validateFulfillmentStatusTransition("pending", "confirmed")).toBe(true);
      expect(orderService.validateFulfillmentStatusTransition("confirmed", "preparing")).toBe(true);
      expect(orderService.validateFulfillmentStatusTransition("preparing", "ready")).toBe(true);
      expect(orderService.validateFulfillmentStatusTransition("ready", "fulfilled")).toBe(true);
    });

    it("should not allow backward transitions", () => {
      expect(orderService.validateFulfillmentStatusTransition("confirmed", "pending")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("preparing", "confirmed")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("ready", "preparing")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("fulfilled", "ready")).toBe(false);
    });

    it("should not allow skipping steps", () => {
      expect(orderService.validateFulfillmentStatusTransition("pending", "preparing")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("pending", "ready")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("confirmed", "ready")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("pending", "fulfilled")).toBe(false);
    });

    it("should not allow transitions from fulfilled", () => {
      expect(orderService.validateFulfillmentStatusTransition("fulfilled", "pending")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("fulfilled", "confirmed")).toBe(false);
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

      const order = await orderService.createOrder("tenant-1", inputWithLoyalty);

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

      await expect(orderService.createOrder("tenant-1", mockInput)).rejects.toThrow(
        "Some menu items are not available"
      );
    });

    it("should emit order.created event with new status fields", async () => {
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
          status: "created",
          fulfillmentStatus: "pending",
          customerFirstName: "John",
          customerLastName: "Doe",
        })
      );

      unsubscribe();
    });
  });

  describe("updatePaymentStatus()", () => {
    const mockOrder = {
      id: "order-1",
      orderNumber: "#001",
      tenantId: "tenant-1",
      merchantId: "merchant-1",
      status: "created",
      fulfillmentStatus: "pending",
      customerName: "John Doe",
      customerPhone: "123-456-7890",
    };

    beforeEach(() => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "completed",
        paidAt: new Date(),
      } as never);
    });

    it("should update payment status", async () => {
      const result = await orderService.updatePaymentStatus("tenant-1", "order-1", {
        status: "completed",
      });

      expect(orderRepository.updateStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "completed",
        expect.objectContaining({
          paidAt: expect.any(Date),
        })
      );

      expect(result.status).toBe("completed");
    });

    it("should throw error for invalid payment status transition", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        status: "completed",
      } as never);

      await expect(
        orderService.updatePaymentStatus("tenant-1", "order-1", {
          status: "canceled",
        })
      ).rejects.toThrow("Invalid payment status transition from completed to canceled");
    });

    it("should throw error if order not found", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(null);

      await expect(
        orderService.updatePaymentStatus("tenant-1", "order-1", {
          status: "completed",
        })
      ).rejects.toThrow("Order not found");
    });

    it("should emit order.paid event when status becomes completed", async () => {
      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.paid", eventHandler);

      await orderService.updatePaymentStatus("tenant-1", "order-1", {
        status: "completed",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          merchantId: "merchant-1",
          status: "completed",
          previousStatus: "created",
        })
      );

      unsubscribe();
    });

    it("should emit order.cancelled event with cancelReason", async () => {
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "canceled",
        cancelledAt: new Date(),
        cancelReason: "Customer requested",
      } as never);

      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.cancelled", eventHandler);

      await orderService.updatePaymentStatus("tenant-1", "order-1", {
        status: "canceled",
        cancelReason: "Customer requested",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "canceled",
          cancelReason: "Customer requested",
        })
      );

      unsubscribe();
    });
  });

  describe("updateFulfillmentStatus()", () => {
    const mockPaidOrder = {
      id: "order-1",
      orderNumber: "#001",
      tenantId: "tenant-1",
      merchantId: "merchant-1",
      status: "completed",
      fulfillmentStatus: "pending",
      customerName: "John Doe",
      customerPhone: "123-456-7890",
    };

    beforeEach(() => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockPaidOrder as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockPaidOrder,
        fulfillmentStatus: "confirmed",
        confirmedAt: new Date(),
      } as never);
    });

    it("should update fulfillment status for paid order", async () => {
      const result = await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "confirmed",
      });

      expect(orderRepository.updateFulfillmentStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "confirmed",
        expect.objectContaining({
          confirmedAt: expect.any(Date),
        })
      );

      expect(result.fulfillmentStatus).toBe("confirmed");
    });

    it("should reject fulfillment update if order is not paid", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockPaidOrder,
        status: "created",
      } as never);

      await expect(
        orderService.updateFulfillmentStatus("tenant-1", "order-1", {
          fulfillmentStatus: "confirmed",
        })
      ).rejects.toThrow("Cannot update fulfillment status: order is not fully paid");
    });

    it("should throw error for invalid fulfillment status transition", async () => {
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockPaidOrder,
        fulfillmentStatus: "preparing",
      } as never);

      await expect(
        orderService.updateFulfillmentStatus("tenant-1", "order-1", {
          fulfillmentStatus: "confirmed", // Can't go backward
        })
      ).rejects.toThrow("Invalid fulfillment status transition from preparing to confirmed");
    });

    it("should emit fulfillment status change event", async () => {
      const eventHandler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.fulfillment.confirmed", eventHandler);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "confirmed",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          merchantId: "merchant-1",
          fulfillmentStatus: "confirmed",
          previousFulfillmentStatus: "pending",
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

  describe("getMerchantOrders()", () => {
    it("should call repository with correct parameters including fulfillmentStatus", async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      vi.mocked(orderRepository.getMerchantOrders).mockResolvedValue(mockResult);

      const options = {
        status: "completed" as OrderStatus,
        fulfillmentStatus: "preparing" as FulfillmentStatus,
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

  describe("countMerchantActiveOrders()", () => {
    it("should return active order count", async () => {
      vi.mocked(orderRepository.countActiveOrders).mockResolvedValue(5);

      const count = await orderService.countMerchantActiveOrders("tenant-1", "merchant-1");

      expect(orderRepository.countActiveOrders).toHaveBeenCalledWith(
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

  // Legacy method tests for backward compatibility
  describe("validateStatusTransition() [deprecated]", () => {
    it("should delegate to validatePaymentStatusTransition", () => {
      expect(orderService.validateStatusTransition("created", "completed")).toBe(true);
      expect(orderService.validateStatusTransition("completed", "canceled")).toBe(false);
    });
  });

  describe("updateOrderStatus() [deprecated]", () => {
    it("should delegate to updatePaymentStatus", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "created",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "completed",
        paidAt: new Date(),
      } as never);

      const result = await orderService.updateOrderStatus("tenant-1", "order-1", {
        status: "completed",
      });

      expect(result.status).toBe("completed");
    });
  });

  // ==================== Additional Edge Case Tests ====================

  describe("Payment Status Edge Cases", () => {
    it("should not allow same status transition", () => {
      expect(orderService.validatePaymentStatusTransition("created", "created")).toBe(false);
      expect(orderService.validatePaymentStatusTransition("completed", "completed")).toBe(false);
      expect(orderService.validatePaymentStatusTransition("canceled", "canceled")).toBe(false);
    });

    it("should allow direct transition from created to completed (full payment)", () => {
      expect(orderService.validatePaymentStatusTransition("created", "completed")).toBe(true);
    });

    it("should allow cancellation from any non-terminal state", () => {
      expect(orderService.validatePaymentStatusTransition("created", "canceled")).toBe(true);
      expect(orderService.validatePaymentStatusTransition("partial_paid", "canceled")).toBe(true);
    });

    it("should set paidAt timestamp when transitioning to completed", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "created",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "completed",
        paidAt: new Date(),
      } as never);

      await orderService.updatePaymentStatus("tenant-1", "order-1", {
        status: "completed",
      });

      expect(orderRepository.updateStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "completed",
        expect.objectContaining({
          paidAt: expect.any(Date),
        })
      );
    });

    it("should set cancelledAt timestamp when transitioning to canceled", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "created",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "canceled",
        cancelledAt: new Date(),
      } as never);

      await orderService.updatePaymentStatus("tenant-1", "order-1", {
        status: "canceled",
        cancelReason: "Test reason",
      });

      expect(orderRepository.updateStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "canceled",
        expect.objectContaining({
          cancelledAt: expect.any(Date),
          cancelReason: "Test reason",
        })
      );
    });
  });

  describe("Fulfillment Status Edge Cases", () => {
    it("should not allow same status transition", () => {
      expect(orderService.validateFulfillmentStatusTransition("pending", "pending")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("confirmed", "confirmed")).toBe(false);
      expect(orderService.validateFulfillmentStatusTransition("fulfilled", "fulfilled")).toBe(false);
    });

    it("should set confirmedAt timestamp when transitioning to confirmed", async () => {
      const mockPaidOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "completed",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockPaidOrder as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockPaidOrder,
        fulfillmentStatus: "confirmed",
        confirmedAt: new Date(),
      } as never);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "confirmed",
      });

      expect(orderRepository.updateFulfillmentStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "confirmed",
        expect.objectContaining({
          confirmedAt: expect.any(Date),
        })
      );
    });

    it("should set preparingAt timestamp when transitioning to preparing", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "completed",
        fulfillmentStatus: "confirmed",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "preparing",
        preparingAt: new Date(),
      } as never);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "preparing",
      });

      expect(orderRepository.updateFulfillmentStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "preparing",
        expect.objectContaining({
          preparingAt: expect.any(Date),
        })
      );
    });

    it("should set readyAt timestamp when transitioning to ready", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "completed",
        fulfillmentStatus: "preparing",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "ready",
        readyAt: new Date(),
      } as never);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "ready",
      });

      expect(orderRepository.updateFulfillmentStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "ready",
        expect.objectContaining({
          readyAt: expect.any(Date),
        })
      );
    });

    it("should set fulfilledAt timestamp when transitioning to fulfilled", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "completed",
        fulfillmentStatus: "ready",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "fulfilled",
        fulfilledAt: new Date(),
      } as never);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "fulfilled",
      });

      expect(orderRepository.updateFulfillmentStatusAndReturn).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "fulfilled",
        expect.objectContaining({
          fulfilledAt: expect.any(Date),
        })
      );
    });
  });

  describe("Full Fulfillment Flow", () => {
    const mockOrder = {
      id: "order-1",
      orderNumber: "#001",
      tenantId: "tenant-1",
      merchantId: "merchant-1",
      status: "completed",
      fulfillmentStatus: "pending",
    };

    it("should complete full fulfillment flow: pending → confirmed → preparing → ready → fulfilled", async () => {
      // Step 1: pending → confirmed
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "pending",
      } as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "confirmed",
      } as never);

      let result = await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "confirmed",
      });
      expect(result.fulfillmentStatus).toBe("confirmed");

      // Step 2: confirmed → preparing
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "confirmed",
      } as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "preparing",
      } as never);

      result = await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "preparing",
      });
      expect(result.fulfillmentStatus).toBe("preparing");

      // Step 3: preparing → ready
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "preparing",
      } as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "ready",
      } as never);

      result = await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "ready",
      });
      expect(result.fulfillmentStatus).toBe("ready");

      // Step 4: ready → fulfilled
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "ready",
      } as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "fulfilled",
      } as never);

      result = await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "fulfilled",
      });
      expect(result.fulfillmentStatus).toBe("fulfilled");
    });

    it("should emit correct events for each fulfillment status change", async () => {
      const confirmedHandler = vi.fn();
      const preparingHandler = vi.fn();
      const readyHandler = vi.fn();
      const fulfilledHandler = vi.fn();

      const unsubConfirmed = orderEventEmitter.on("order.fulfillment.confirmed", confirmedHandler);
      const unsubPreparing = orderEventEmitter.on("order.fulfillment.preparing", preparingHandler);
      const unsubReady = orderEventEmitter.on("order.fulfillment.ready", readyHandler);
      const unsubFulfilled = orderEventEmitter.on("order.fulfillment.fulfilled", fulfilledHandler);

      // pending → confirmed
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "pending",
      } as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "confirmed",
      } as never);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "confirmed",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(confirmedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          fulfillmentStatus: "confirmed",
          previousFulfillmentStatus: "pending",
        })
      );

      // confirmed → preparing
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "confirmed",
      } as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "preparing",
      } as never);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "preparing",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(preparingHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          fulfillmentStatus: "preparing",
          previousFulfillmentStatus: "confirmed",
        })
      );

      // preparing → ready
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "preparing",
      } as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "ready",
      } as never);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "ready",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(readyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          fulfillmentStatus: "ready",
          previousFulfillmentStatus: "preparing",
        })
      );

      // ready → fulfilled
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "ready",
      } as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "fulfilled",
      } as never);

      await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "fulfilled",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fulfilledHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          fulfillmentStatus: "fulfilled",
          previousFulfillmentStatus: "ready",
        })
      );

      unsubConfirmed();
      unsubPreparing();
      unsubReady();
      unsubFulfilled();
    });
  });

  describe("Cancellation Scenarios", () => {
    it("should allow cancellation of created order", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "created",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "canceled",
        cancelledAt: new Date(),
      } as never);

      const result = await orderService.updatePaymentStatus("tenant-1", "order-1", {
        status: "canceled",
        cancelReason: "Customer changed mind",
      });

      expect(result.status).toBe("canceled");
    });

    it("should allow cancellation of partial_paid order", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "partial_paid",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "canceled",
        cancelledAt: new Date(),
      } as never);

      const result = await orderService.updatePaymentStatus("tenant-1", "order-1", {
        status: "canceled",
        cancelReason: "Payment issue",
      });

      expect(result.status).toBe("canceled");
    });

    it("should NOT allow cancellation of completed order", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "completed",
        fulfillmentStatus: "preparing",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);

      await expect(
        orderService.updatePaymentStatus("tenant-1", "order-1", {
          status: "canceled",
          cancelReason: "Test",
        })
      ).rejects.toThrow("Invalid payment status transition from completed to canceled");
    });

    it("should NOT allow fulfillment update after cancellation", async () => {
      const mockCanceledOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "canceled",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockCanceledOrder as never);

      await expect(
        orderService.updateFulfillmentStatus("tenant-1", "order-1", {
          fulfillmentStatus: "confirmed",
        })
      ).rejects.toThrow("Cannot update fulfillment status: order is not fully paid");
    });

    it("should preserve fulfillment status when order is canceled", async () => {
      // Order was in preparing state when canceled
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "partial_paid",
        fulfillmentStatus: "pending", // fulfillmentStatus stays as-is
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        status: "canceled",
        fulfillmentStatus: "pending", // Preserved
        cancelledAt: new Date(),
      } as never);

      const result = await orderService.updatePaymentStatus("tenant-1", "order-1", {
        status: "canceled",
        cancelReason: "Test",
      });

      expect(result.status).toBe("canceled");
      expect(result.fulfillmentStatus).toBe("pending"); // Preserved
    });
  });

  describe("Business Rules Validation", () => {
    it("should not allow fulfillment update for unpaid order (created)", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "created",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);

      await expect(
        orderService.updateFulfillmentStatus("tenant-1", "order-1", {
          fulfillmentStatus: "confirmed",
        })
      ).rejects.toThrow("Cannot update fulfillment status: order is not fully paid");
    });

    it("should not allow fulfillment update for partial_paid order", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "partial_paid",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);

      await expect(
        orderService.updateFulfillmentStatus("tenant-1", "order-1", {
          fulfillmentStatus: "confirmed",
        })
      ).rejects.toThrow("Cannot update fulfillment status: order is not fully paid");
    });

    it("should allow fulfillment update only for completed order", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "#001",
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        status: "completed",
        fulfillmentStatus: "pending",
      };

      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(mockOrder as never);
      vi.mocked(orderRepository.updateFulfillmentStatusAndReturn).mockResolvedValue({
        ...mockOrder,
        fulfillmentStatus: "confirmed",
      } as never);

      const result = await orderService.updateFulfillmentStatus("tenant-1", "order-1", {
        fulfillmentStatus: "confirmed",
      });

      expect(result.fulfillmentStatus).toBe("confirmed");
    });
  });
});
