import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { PointsService } from "../points.service";

// Mock prisma
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    $transaction: vi.fn(),
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

// Mock repositories
vi.mock("@/repositories/point-transaction.repository", () => ({
  pointTransactionRepository: {
    create: vi.fn(),
    getByMember: vi.fn(),
    hasEarnedForOrder: vi.fn(),
    getEarnTransactionForOrder: vi.fn(),
    getTotalPointsEarned: vi.fn(),
  },
}));

vi.mock("@/repositories/loyalty-member.repository", () => ({
  loyaltyMemberRepository: {
    getById: vi.fn(),
    updatePoints: vi.fn(),
  },
}));

import prisma from "@/lib/db";
import { pointTransactionRepository } from "@/repositories/point-transaction.repository";
import { loyaltyMemberRepository } from "@/repositories/loyalty-member.repository";

describe("PointsService", () => {
  let service: PointsService;

  const mockMember = {
    id: "member-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    phone: "+12025551234",
    firstName: "John" as string | null,
    lastName: "Doe" as string | null,
    email: "john@example.com" as string | null,
    points: 100,
    totalOrders: 5,
    totalSpent: new Decimal(150.0),
    lastOrderAt: new Date() as Date | null,
    enrolledAt: new Date(),
    status: "active",
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTransaction = {
    id: "tx-1",
    tenantId: "tenant-1",
    memberId: "member-1",
    merchantId: "merchant-1" as string | null,
    orderId: "order-1" as string | null,
    type: "earn",
    points: 25,
    balanceBefore: 100,
    balanceAfter: 125,
    description: "Earned 25 points from order" as string | null,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    merchant: { id: "merchant-1", name: "Test Merchant", slug: "test-merchant" } as { id: string; name: string; slug: string } | null,
    order: { id: "order-1", orderNumber: "ORD-001" } as { id: string; orderNumber: string } | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PointsService();

    // Default: prisma.$transaction executes the callback immediately
    vi.mocked(prisma.$transaction).mockImplementation(
      // cast needed because mock returns {} instead of full PrismaClient
      (fn) => (fn as (tx: Parameters<typeof fn>[0]) => Promise<unknown>)({}  as Parameters<typeof fn>[0])
    );
  });

  describe("calculatePointsForOrder", () => {
    it("should calculate points correctly with integer result", () => {
      const result = service.calculatePointsForOrder(100, 1);
      expect(result).toBe(100);
    });

    it("should calculate points correctly with decimal result (rounds down)", () => {
      const result = service.calculatePointsForOrder(25.5, 1);
      expect(result).toBe(25);
    });

    it("should calculate points with custom pointsPerDollar", () => {
      const result = service.calculatePointsForOrder(100, 2);
      expect(result).toBe(200);
    });

    it("should calculate points with fractional pointsPerDollar", () => {
      const result = service.calculatePointsForOrder(100, 0.5);
      expect(result).toBe(50);
    });

    it("should return 0 for zero amount", () => {
      const result = service.calculatePointsForOrder(0, 1);
      expect(result).toBe(0);
    });

    it("should handle small amounts that round to 0", () => {
      const result = service.calculatePointsForOrder(0.5, 1);
      expect(result).toBe(0);
    });
  });

  describe("awardPoints", () => {
    it("should award points successfully within a transaction", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(pointTransactionRepository.create).mockResolvedValue(mockTransaction);
      vi.mocked(loyaltyMemberRepository.updatePoints).mockResolvedValue(mockMember);

      const result = await service.awardPoints("tenant-1", "member-1", {
        orderAmount: 25,
        pointsPerDollar: 1,
        merchantId: "merchant-1",
        orderId: "order-1",
      });

      expect(result.pointsEarned).toBe(25);
      expect(result.newBalance).toBe(125);
      expect(result.transactionId).toBe("tx-1");

      // Verify prisma.$transaction was called (atomic create + update)
      expect(prisma.$transaction).toHaveBeenCalledOnce();

      expect(pointTransactionRepository.create).toHaveBeenCalledWith("tenant-1", {
        memberId: "member-1",
        merchantId: "merchant-1",
        orderId: "order-1",
        type: "earn",
        points: 25,
        balanceBefore: 100,
        balanceAfter: 125,
        description: "Earned 25 points from order",
      }, expect.anything());

      expect(loyaltyMemberRepository.updatePoints).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        25,
        expect.anything()
      );
    });

    it("should return idempotent result if points already awarded for order (fast path)", async () => {
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(true);
      vi.mocked(pointTransactionRepository.getEarnTransactionForOrder).mockResolvedValue(mockTransaction);

      const result = await service.awardPoints("tenant-1", "member-1", {
        orderAmount: 25,
        pointsPerDollar: 1,
        orderId: "order-1",
      });

      // Should return existing transaction data, not throw
      expect(result.pointsEarned).toBe(25);
      expect(result.newBalance).toBe(125);
      expect(result.transactionId).toBe("tx-1");

      // Should NOT create a new transaction
      expect(pointTransactionRepository.create).not.toHaveBeenCalled();
      expect(loyaltyMemberRepository.updatePoints).not.toHaveBeenCalled();
    });

    it("should return idempotent result on P2002 unique constraint violation", async () => {
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);

      // Simulate P2002 unique constraint violation during transaction
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.0.0", meta: { target: ["tenant_id", "order_id", "type"] } }
      );
      vi.mocked(prisma.$transaction).mockRejectedValue(p2002Error);
      vi.mocked(pointTransactionRepository.getEarnTransactionForOrder).mockResolvedValue(mockTransaction);

      const result = await service.awardPoints("tenant-1", "member-1", {
        orderAmount: 25,
        pointsPerDollar: 1,
        orderId: "order-1",
      });

      // Should return existing transaction data
      expect(result.pointsEarned).toBe(25);
      expect(result.newBalance).toBe(125);
      expect(result.transactionId).toBe("tx-1");
    });

    it("should rethrow non-P2002 errors", async () => {
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);

      const genericError = new Error("Database connection lost");
      vi.mocked(prisma.$transaction).mockRejectedValue(genericError);

      await expect(
        service.awardPoints("tenant-1", "member-1", {
          orderAmount: 25,
          pointsPerDollar: 1,
          orderId: "order-1",
        })
      ).rejects.toThrow("Database connection lost");
    });

    it("should throw error if member not found", async () => {
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(null);

      await expect(
        service.awardPoints("tenant-1", "member-1", {
          orderAmount: 25,
          pointsPerDollar: 1,
        })
      ).rejects.toThrow("LOYALTY_MEMBER_NOT_FOUND");
    });

    it("should return 0 points for small amounts", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(false);

      const result = await service.awardPoints("tenant-1", "member-1", {
        orderAmount: 0.5,
        pointsPerDollar: 1,
      });

      expect(result.pointsEarned).toBe(0);
      expect(result.newBalance).toBe(100);
      expect(pointTransactionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("awardPointsWithCustomAmount", () => {
    it("should return idempotent result if points already awarded (fast path)", async () => {
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(true);
      vi.mocked(pointTransactionRepository.getEarnTransactionForOrder).mockResolvedValue(mockTransaction);

      const result = await service.awardPointsWithCustomAmount("tenant-1", "member-1", {
        points: 50,
        orderId: "order-1",
      });

      expect(result.pointsEarned).toBe(25); // from existing transaction
      expect(result.transactionId).toBe("tx-1");
      expect(pointTransactionRepository.create).not.toHaveBeenCalled();
    });

    it("should return idempotent result on P2002 unique constraint violation", async () => {
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.0.0", meta: { target: ["tenant_id", "order_id", "type"] } }
      );
      vi.mocked(prisma.$transaction).mockRejectedValue(p2002Error);
      vi.mocked(pointTransactionRepository.getEarnTransactionForOrder).mockResolvedValue(mockTransaction);

      const result = await service.awardPointsWithCustomAmount("tenant-1", "member-1", {
        points: 50,
        orderId: "order-1",
      });

      expect(result.pointsEarned).toBe(25);
      expect(result.transactionId).toBe("tx-1");
    });
  });

  describe("adjustPoints", () => {
    it("should add points successfully", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);
      vi.mocked(pointTransactionRepository.create).mockResolvedValue({
        ...mockTransaction,
        type: "adjust",
        points: 50,
        balanceAfter: 150,
      });
      vi.mocked(loyaltyMemberRepository.updatePoints).mockResolvedValue(mockMember);

      const result = await service.adjustPoints(
        "tenant-1",
        "member-1",
        50,
        "Bonus points"
      );

      expect(result.pointsEarned).toBe(50);
      expect(result.newBalance).toBe(150);
    });

    it("should deduct points successfully", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);
      vi.mocked(pointTransactionRepository.create).mockResolvedValue({
        ...mockTransaction,
        type: "adjust",
        points: -50,
        balanceAfter: 50,
      });
      vi.mocked(loyaltyMemberRepository.updatePoints).mockResolvedValue(mockMember);

      const result = await service.adjustPoints(
        "tenant-1",
        "member-1",
        -50,
        "Points correction"
      );

      expect(result.pointsEarned).toBe(-50);
      expect(result.newBalance).toBe(50);
    });

    it("should throw error if adjustment would result in negative balance", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);

      await expect(
        service.adjustPoints("tenant-1", "member-1", -150, "Too many points")
      ).rejects.toThrow("LOYALTY_NEGATIVE_BALANCE");
    });

    it("should throw error if member not found", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(null);

      await expect(
        service.adjustPoints("tenant-1", "member-1", 50, "Bonus")
      ).rejects.toThrow("LOYALTY_MEMBER_NOT_FOUND");
    });
  });

  describe("getTransactionHistory", () => {
    it("should return paginated transaction history", async () => {
      const mockResult = {
        items: [mockTransaction],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
      vi.mocked(pointTransactionRepository.getByMember).mockResolvedValue(mockResult);

      const result = await service.getTransactionHistory("tenant-1", "member-1", {
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(pointTransactionRepository.getByMember).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        { page: 1, pageSize: 20 }
      );
    });
  });

  describe("hasEarnedForOrder", () => {
    it("should return true if points already earned", async () => {
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(true);

      const result = await service.hasEarnedForOrder("tenant-1", "order-1");

      expect(result).toBe(true);
    });

    it("should return false if points not earned", async () => {
      vi.mocked(pointTransactionRepository.hasEarnedForOrder).mockResolvedValue(false);

      const result = await service.hasEarnedForOrder("tenant-1", "order-1");

      expect(result).toBe(false);
    });
  });
});
