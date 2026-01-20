import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoyaltyMemberService } from "../loyalty-member.service";

// Mock repository
vi.mock("@/repositories/loyalty-member.repository", () => ({
  loyaltyMemberRepository: {
    getById: vi.fn(),
    getByPhone: vi.fn(),
    findOrCreate: vi.fn(),
    update: vi.fn(),
    updateOrderStats: vi.fn(),
    getByCompany: vi.fn(),
    countByCompany: vi.fn(),
  },
}));

import { loyaltyMemberRepository } from "@/repositories/loyalty-member.repository";

describe("LoyaltyMemberService", () => {
  let service: LoyaltyMemberService;

  const mockMember = {
    id: "member-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    phone: "+12025551234",
    name: "John Doe",
    email: "john@example.com",
    points: 150,
    totalOrders: 5,
    totalSpent: 250.0,
    lastOrderAt: new Date("2024-01-15"),
    enrolledAt: new Date("2024-01-01"),
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyMemberService();
  });

  describe("getMember", () => {
    it("should return member by ID", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);

      const result = await service.getMember("tenant-1", "member-1");

      expect(result).toMatchObject({
        id: "member-1",
        phone: "+12025551234",
        name: "John Doe",
        points: 150,
      });
      expect(loyaltyMemberRepository.getById).toHaveBeenCalledWith(
        "tenant-1",
        "member-1"
      );
    });

    it("should return null if member not found", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(null);

      const result = await service.getMember("tenant-1", "member-1");

      expect(result).toBeNull();
    });
  });

  describe("getMemberByPhone", () => {
    it("should return member by phone", async () => {
      vi.mocked(loyaltyMemberRepository.getByPhone).mockResolvedValue(mockMember);

      const result = await service.getMemberByPhone(
        "tenant-1",
        "company-1",
        "+12025551234"
      );

      expect(result).toMatchObject({
        id: "member-1",
        phone: "+12025551234",
      });
      expect(loyaltyMemberRepository.getByPhone).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        "+12025551234"
      );
    });

    it("should return null if member not found", async () => {
      vi.mocked(loyaltyMemberRepository.getByPhone).mockResolvedValue(null);

      const result = await service.getMemberByPhone(
        "tenant-1",
        "company-1",
        "+12025559999"
      );

      expect(result).toBeNull();
    });
  });

  describe("findOrCreateByPhone", () => {
    it("should return existing member", async () => {
      vi.mocked(loyaltyMemberRepository.findOrCreate).mockResolvedValue({
        member: mockMember,
        isNew: false,
      });

      const result = await service.findOrCreateByPhone(
        "tenant-1",
        "company-1",
        "+12025551234"
      );

      expect(result.isNew).toBe(false);
      expect(result.member.phone).toBe("+12025551234");
    });

    it("should create new member", async () => {
      vi.mocked(loyaltyMemberRepository.findOrCreate).mockResolvedValue({
        member: { ...mockMember, points: 0, totalOrders: 0, totalSpent: 0 },
        isNew: true,
      });

      const result = await service.findOrCreateByPhone(
        "tenant-1",
        "company-1",
        "+12025559999",
        { name: "Jane Doe", email: "jane@example.com" }
      );

      expect(result.isNew).toBe(true);
      expect(loyaltyMemberRepository.findOrCreate).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        "+12025559999",
        { name: "Jane Doe", email: "jane@example.com" }
      );
    });
  });

  describe("getLoyaltyStatus", () => {
    it("should return loyalty status with default points value", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);

      const result = await service.getLoyaltyStatus("tenant-1", "member-1");

      expect(result).toEqual({
        memberId: "member-1",
        phone: "+12025551234",
        name: "John Doe",
        points: 150,
        totalOrders: 5,
        totalSpent: 250.0,
        enrolledAt: mockMember.enrolledAt,
        pointsValue: 1.5, // 150 points * 0.01 default
      });
    });

    it("should return loyalty status with custom points value", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(mockMember);

      const result = await service.getLoyaltyStatus("tenant-1", "member-1", 0.05);

      expect(result?.pointsValue).toBe(7.5); // 150 points * 0.05
    });

    it("should return null if member not found", async () => {
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(null);

      const result = await service.getLoyaltyStatus("tenant-1", "member-1");

      expect(result).toBeNull();
    });
  });

  describe("getLoyaltyStatusByPhone", () => {
    it("should return loyalty status by phone", async () => {
      vi.mocked(loyaltyMemberRepository.getByPhone).mockResolvedValue(mockMember);

      const result = await service.getLoyaltyStatusByPhone(
        "tenant-1",
        "company-1",
        "+12025551234"
      );

      expect(result).toMatchObject({
        memberId: "member-1",
        phone: "+12025551234",
        points: 150,
      });
    });

    it("should return null if member not found", async () => {
      vi.mocked(loyaltyMemberRepository.getByPhone).mockResolvedValue(null);

      const result = await service.getLoyaltyStatusByPhone(
        "tenant-1",
        "company-1",
        "+12025559999"
      );

      expect(result).toBeNull();
    });
  });

  describe("updateMember", () => {
    it("should update member profile", async () => {
      vi.mocked(loyaltyMemberRepository.update).mockResolvedValue();

      await service.updateMember("tenant-1", "member-1", {
        name: "John Smith",
        email: "john.smith@example.com",
      });

      expect(loyaltyMemberRepository.update).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        {
          name: "John Smith",
          email: "john.smith@example.com",
        }
      );
    });
  });

  describe("updateOrderStats", () => {
    it("should update order stats", async () => {
      vi.mocked(loyaltyMemberRepository.updateOrderStats).mockResolvedValue();

      await service.updateOrderStats("tenant-1", "member-1", 50.0);

      expect(loyaltyMemberRepository.updateOrderStats).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        50.0
      );
    });
  });

  describe("getMembersByCompany", () => {
    it("should return paginated members", async () => {
      const mockResult = {
        items: [mockMember],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
      vi.mocked(loyaltyMemberRepository.getByCompany).mockResolvedValue(mockResult);

      const result = await service.getMembersByCompany("tenant-1", "company-1", {
        page: 1,
        pageSize: 20,
        search: "john",
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(loyaltyMemberRepository.getByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        { page: 1, pageSize: 20, search: "john" }
      );
    });
  });

  describe("getMemberCount", () => {
    it("should return member count", async () => {
      vi.mocked(loyaltyMemberRepository.countByCompany).mockResolvedValue(100);

      const result = await service.getMemberCount("tenant-1", "company-1");

      expect(result).toBe(100);
      expect(loyaltyMemberRepository.countByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1"
      );
    });
  });
});
