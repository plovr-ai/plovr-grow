import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderRepository } from "../order.repository";

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  default: {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

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
});
