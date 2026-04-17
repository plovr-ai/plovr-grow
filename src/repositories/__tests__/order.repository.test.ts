import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { OrderRepository } from "../order.repository";

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  default: {
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

vi.mock("@/lib/id", () => {
  let counter = 0;
  return {
    generateEntityId: vi.fn(() => `mock-id-${++counter}`),
  };
});

import prisma from "@/lib/db";

describe("OrderRepository", () => {
  let repository: OrderRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new OrderRepository();
  });

  describe("getTenantOrders", () => {
    it("should return paginated orders for a company", async () => {
      const mockOrders = [
        {
          id: "order-1",
          tenantId: "tenant-1",
          merchantId: "merchant-1",
          orderNumber: "#001",
          status: "pending",
          customerName: "John Doe",
          customerPhone: "123-456-7890",
          createdAt: new Date(),
          customer: null,
          merchant: { id: "merchant-1", name: "Downtown", slug: "downtown" },
        },
        {
          id: "order-2",
          tenantId: "tenant-1",
          merchantId: "merchant-2",
          orderNumber: "#002",
          status: "completed",
          customerName: "Jane Smith",
          customerPhone: "987-654-3210",
          createdAt: new Date(),
          customer: null,
          merchant: { id: "merchant-2", name: "Uptown", slug: "uptown" },
        },
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as never);
      vi.mocked(prisma.order.count).mockResolvedValue(2);

      const result = await repository.getTenantOrders("tenant-1");

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          deleted: false,
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
              timezone: true,
            },
          },
          orderItems: {
            where: { deleted: false },
            orderBy: { sortOrder: "asc" },
            select: { name: true, quantity: true },
          },
        },
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it("should filter by merchantId when provided", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getTenantOrders("tenant-1", {
        merchantId: "merchant-1",
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: "tenant-1",
            deleted: false,
            merchantId: "merchant-1",
          },
        })
      );
    });

    it("should filter by status when provided", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getTenantOrders("tenant-1", {
        status: "created",
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "created",
          }),
        })
      );
    });

    it("should filter by orderType when provided", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getTenantOrders("tenant-1", {
        orderMode: "pickup",
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderMode: "pickup",
          }),
        })
      );
    });

    it("should filter by date range when provided", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      const dateFrom = new Date("2024-01-01");
      const dateTo = new Date("2024-01-31");

      await repository.getTenantOrders("tenant-1", {
        dateFrom,
        dateTo,
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          }),
        })
      );
    });

    it("should filter by search term when provided", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getTenantOrders("tenant-1", {
        search: "john",
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { orderNumber: { contains: "john" } },
              { customerFirstName: { contains: "john" } },
              { customerLastName: { contains: "john" } },
              { customerPhone: { contains: "john" } },
            ],
          }),
        })
      );
    });

    it("should handle pagination correctly", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(100);

      const result = await repository.getTenantOrders("tenant-1", {
        page: 3,
        pageSize: 10,
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (page - 1) * pageSize = (3 - 1) * 10
          take: 10,
        })
      );

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(10); // Math.ceil(100 / 10)
    });

    it("should apply custom ordering", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getTenantOrders("tenant-1", {
        orderBy: "totalAmount",
        orderDirection: "asc",
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { totalAmount: "asc" },
        })
      );
    });

    it("should return empty results when no orders exist", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      const result = await repository.getTenantOrders("tenant-1");

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it("should combine multiple filters", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      const dateFrom = new Date("2024-01-01");
      const dateTo = new Date("2024-01-31");

      await repository.getTenantOrders("tenant-1", {
        merchantId: "merchant-1",
        status: "completed",
        orderMode: "delivery",
        dateFrom,
        dateTo,
        page: 2,
        pageSize: 5,
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          deleted: false,
          merchantId: "merchant-1",
          status: "completed",
          orderMode: "delivery",
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: 5,
        take: 5,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
              timezone: true,
            },
          },
          orderItems: {
            where: { deleted: false },
            orderBy: { sortOrder: "asc" },
            select: { name: true, quantity: true },
          },
        },
      });
    });
  });

  describe("getOrdersByLoyaltyMember", () => {
    it("should return paginated orders for a loyalty member", async () => {
      const mockOrders = [
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
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as never);
      vi.mocked(prisma.order.count).mockResolvedValue(2);

      const result = await repository.getOrdersByLoyaltyMember(
        "tenant-1",
        "member-1"
      );

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          loyaltyMemberId: "member-1",
          deleted: false,
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
              timezone: true,
            },
          },
        },
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it("should handle pagination correctly", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(25);

      const result = await repository.getOrdersByLoyaltyMember(
        "tenant-1",
        "member-1",
        {
          page: 2,
          pageSize: 10,
        }
      );

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page - 1) * pageSize = (2 - 1) * 10
          take: 10,
        })
      );

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(3); // Math.ceil(25 / 10)
    });

    it("should use default pagination values when not provided", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getOrdersByLoyaltyMember("tenant-1", "member-1");

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10, // default pageSize
        })
      );
    });

    it("should return empty results when member has no orders", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      const result = await repository.getOrdersByLoyaltyMember(
        "tenant-1",
        "member-1"
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it("should filter by tenantId and loyaltyMemberId", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getOrdersByLoyaltyMember("tenant-1", "member-1");

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          loyaltyMemberId: "member-1",
          deleted: false,
        },
      });
    });

    it("should order by createdAt descending", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getOrdersByLoyaltyMember("tenant-1", "member-1");

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("should include merchant information", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(0);

      await repository.getOrdersByLoyaltyMember("tenant-1", "member-1");

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
                slug: true,
                timezone: true,
              },
            },
          },
        })
      );
    });
  });

  describe("create (with orderItems)", () => {
    it("should create order with nested orderItems and modifiers", async () => {
      const mockOrder = { id: "mock-id-1", orderNumber: "#001" };
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as never);

      const orderItems = [
        {
          menuItemId: "item-1",
          name: "Burger",
          price: 10.99,
          quantity: 2,
          totalPrice: 21.98,
          specialInstructions: "No onions",
          imageUrl: "https://example.com/burger.jpg",
          taxes: [{ taxConfigId: "tax-1", name: "Sales Tax", rate: 0.08, roundingMethod: "half_up" as const, inclusionType: "additive" as const }],
          selectedModifiers: [
            {
              groupId: "grp-1",
              groupName: "Extras",
              modifierId: "mod-1",
              modifierName: "Cheese",
              price: 1.5,
              quantity: 1,
            },
          ],
        },
      ];

      await repository.create(
        "tenant-1",
        "merchant-1",
        {
          orderNumber: "#001",
          customerFirstName: "John",
          customerLastName: "Doe",
          customerPhone: "555-1234",
          customerEmail: null,
          orderMode: "pickup",
          salesChannel: "online_order",
          status: "created",
          fulfillmentStatus: "pending",
          subtotal: 21.98,
          taxAmount: 1.76,
          tipAmount: 0,
          deliveryFee: 0,
          discount: 0,
          giftCardPayment: 0,
          balanceDue: 21.98,
          totalAmount: 23.74,
          notes: null,
          deliveryAddress: Prisma.JsonNull,
          scheduledAt: null,
        },
        undefined,
        undefined,
        orderItems
      );

      const callArgs = vi.mocked(prisma.order.create).mock.calls[0]?.[0];
      // Verify items JSON field is NOT written (deprecated)
      expect(callArgs?.data).not.toHaveProperty("items");

      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderItems: {
            create: [
              expect.objectContaining({
                menuItemId: "item-1",
                name: "Burger",
                unitPrice: 10.99,
                quantity: 2,
                totalPrice: 21.98,
                notes: "No onions",
                imageUrl: "https://example.com/burger.jpg",
                sortOrder: 0,
                modifiers: {
                  create: [
                    expect.objectContaining({
                      modifierGroupId: "grp-1",
                      modifierOptionId: "mod-1",
                      groupName: "Extras",
                      name: "Cheese",
                      price: 1.5,
                      quantity: 1,
                    }),
                  ],
                },
              }),
            ],
          },
        }),
      });
    });

    it("should create order without orderItems when not provided", async () => {
      const mockOrder = { id: "mock-id-1", orderNumber: "#002" };
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as never);

      await repository.create(
        "tenant-1",
        "merchant-1",
        {
          orderNumber: "#002",
          customerFirstName: "Jane",
          customerLastName: "Smith",
          customerPhone: "555-5678",
          customerEmail: null,
          orderMode: "pickup",
          salesChannel: "online_order",
          status: "created",
          fulfillmentStatus: "pending",
          subtotal: 0,
          taxAmount: 0,
          tipAmount: 0,
          deliveryFee: 0,
          discount: 0,
          giftCardPayment: 0,
          balanceDue: 0,
          totalAmount: 0,
          notes: null,
          deliveryAddress: Prisma.JsonNull,
          scheduledAt: null,
        }
      );

      const callArgs = vi.mocked(prisma.order.create).mock.calls[0]?.[0];
      expect(callArgs?.data).not.toHaveProperty("orderItems");
    });

    it("should skip modifiers create when item has no selected modifiers", async () => {
      const mockOrder = { id: "mock-id-1", orderNumber: "#003" };
      vi.mocked(prisma.order.create).mockResolvedValue(mockOrder as never);

      const orderItems = [
        {
          menuItemId: "item-1",
          name: "Fries",
          price: 4.99,
          quantity: 1,
          totalPrice: 4.99,
          selectedModifiers: [],
        },
      ];

      await repository.create(
        "tenant-1",
        "merchant-1",
        {
          orderNumber: "#003",
          customerFirstName: "Test",
          customerLastName: "User",
          customerPhone: "555-0000",
          customerEmail: null,
          orderMode: "pickup",
          salesChannel: "online_order",
          status: "created",
          fulfillmentStatus: "pending",
          subtotal: 4.99,
          taxAmount: 0,
          tipAmount: 0,
          deliveryFee: 0,
          discount: 0,
          giftCardPayment: 0,
          balanceDue: 4.99,
          totalAmount: 4.99,
          notes: null,
          deliveryAddress: Prisma.JsonNull,
          scheduledAt: null,
        },
        undefined,
        undefined,
        orderItems
      );

      const callArgs = vi.mocked(prisma.order.create).mock.calls[0]?.[0];
      const createdItems = (callArgs?.data as Record<string, unknown>).orderItems as {
        create: Record<string, unknown>[];
      };
      expect(createdItems.create[0]).not.toHaveProperty("modifiers");
    });
  });

  describe("getOrderItems", () => {
    it("should return order items with modifiers for an order", async () => {
      const mockItems = [
        {
          id: "oi-1",
          orderId: "order-1",
          menuItemId: "item-1",
          name: "Burger",
          unitPrice: new Prisma.Decimal("10.99"),
          quantity: 2,
          totalPrice: new Prisma.Decimal("21.98"),
          notes: null,
          imageUrl: null,
          taxes: null,
          sortOrder: 0,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          modifiers: [
            {
              id: "oim-1",
              orderItemId: "oi-1",
              modifierGroupId: "grp-1",
              modifierOptionId: "mod-1",
              groupName: "Extras",
              name: "Cheese",
              price: new Prisma.Decimal("1.50"),
              quantity: 1,
              deleted: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockItems as never);

      const result = await repository.getOrderItems("order-1");

      expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
        where: {
          orderId: "order-1",
          deleted: false,
        },
        orderBy: { sortOrder: "asc" },
        include: {
          modifiers: {
            where: { deleted: false },
          },
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Burger");
      expect(result[0].modifiers).toHaveLength(1);
      expect(result[0].modifiers[0].name).toBe("Cheese");
    });
  });

  describe("atomicComplete", () => {
    it("should update order to completed with CAS filter and return count", async () => {
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);

      const paidAt = new Date();
      const count = await repository.atomicComplete("tenant-1", "order-1", { paidAt });

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", tenantId: "tenant-1", status: { not: "completed" } },
        data: { status: "completed", paidAt },
      });
      expect(count).toBe(1);
    });

    it("should return 0 when CAS loses race (already completed)", async () => {
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 } as never);

      const count = await repository.atomicComplete("tenant-1", "order-1", {
        paidAt: new Date(),
      });

      expect(count).toBe(0);
    });

    it("should include balanceDue in patch when provided", async () => {
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);

      const paidAt = new Date();
      await repository.atomicComplete("tenant-1", "order-1", {
        paidAt,
        balanceDue: 42.5,
      });

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", tenantId: "tenant-1", status: { not: "completed" } },
        data: { status: "completed", paidAt, balanceDue: 42.5 },
      });
    });

    it("should use provided tx client instead of default prisma", async () => {
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const tx = { order: { updateMany: txUpdateMany } } as never;

      await repository.atomicComplete(
        "tenant-1",
        "order-1",
        { paidAt: new Date() },
        tx
      );

      expect(txUpdateMany).toHaveBeenCalled();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("atomicMarkPaymentFailed", () => {
    it("should update order to payment_failed with CAS filter and return count", async () => {
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);

      const count = await repository.atomicMarkPaymentFailed("tenant-1", "order-1");

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: "order-1",
          tenantId: "tenant-1",
          status: { notIn: ["completed", "canceled", "payment_failed"] },
        },
        data: { status: "payment_failed", paymentFailedAt: expect.any(Date) },
      });
      expect(count).toBe(1);
    });

    it("should return 0 when CAS loses race (already terminal)", async () => {
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 } as never);

      const count = await repository.atomicMarkPaymentFailed("tenant-1", "order-1");

      expect(count).toBe(0);
    });

    it("should use provided tx client instead of default prisma", async () => {
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const tx = { order: { updateMany: txUpdateMany } } as never;

      await repository.atomicMarkPaymentFailed("tenant-1", "order-1", tx);

      expect(txUpdateMany).toHaveBeenCalled();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("atomicCancel", () => {
    it("should update order to canceled with CAS filter, reason, and return count", async () => {
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);

      const count = await repository.atomicCancel(
        "tenant-1",
        "order-1",
        "Customer request"
      );

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", tenantId: "tenant-1", status: { not: "canceled" } },
        data: {
          status: "canceled",
          cancelledAt: expect.any(Date),
          cancelReason: "Customer request",
        },
      });
      expect(count).toBe(1);
    });

    it("should allow undefined reason", async () => {
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);

      await repository.atomicCancel("tenant-1", "order-1", undefined);

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", tenantId: "tenant-1", status: { not: "canceled" } },
        data: {
          status: "canceled",
          cancelledAt: expect.any(Date),
          cancelReason: undefined,
        },
      });
    });

    it("should return 0 when CAS loses race (already canceled)", async () => {
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 } as never);

      const count = await repository.atomicCancel(
        "tenant-1",
        "order-1",
        "duplicate"
      );

      expect(count).toBe(0);
    });

    it("should use provided tx client instead of default prisma", async () => {
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const tx = { order: { updateMany: txUpdateMany } } as never;

      await repository.atomicCancel("tenant-1", "order-1", "reason", tx);

      expect(txUpdateMany).toHaveBeenCalled();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });
  });
});
