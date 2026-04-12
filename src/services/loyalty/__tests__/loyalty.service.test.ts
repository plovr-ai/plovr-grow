import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoyaltyService } from "../loyalty.service";
import { loyaltyConfigService } from "../loyalty-config.service";
import { loyaltyMemberService } from "../loyalty-member.service";
import { pointsService } from "../points.service";
import type { LoyaltyMemberData, LoyaltyStatus } from "../loyalty.types";

// Mock sub-services
vi.mock("../loyalty-config.service", () => ({
  loyaltyConfigService: {
    isLoyaltyEnabled: vi.fn(),
    getPointsPerDollar: vi.fn(),
    getLoyaltyConfig: vi.fn(),
  },
}));

vi.mock("../loyalty-member.service", () => ({
  loyaltyMemberService: {
    findOrCreateByPhone: vi.fn(),
    getMemberByPhone: vi.fn(),
    getLoyaltyStatusByPhone: vi.fn(),
    updateOrderStats: vi.fn(),
  },
}));

vi.mock("../points.service", () => ({
  pointsService: {
    hasEarnedForOrder: vi.fn(),
    awardPoints: vi.fn(),
    awardPointsWithCustomAmount: vi.fn(),
  },
}));

describe("LoyaltyService", () => {
  let service: LoyaltyService;

  const mockMember: LoyaltyMemberData = {
    id: "member-1",
    tenantId: "tenant-1",
    phone: "+12025551234",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    points: 100,
    totalOrders: 5,
    totalSpent: 150.0,
    lastOrderAt: new Date(),
    enrolledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockConfig = {
    id: "config-1",
    tenantId: "tenant-1",
    pointsPerDollar: 1.0,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyService();
  });

  describe("processOrderCompletion", () => {
    const orderData = {
      merchantId: "merchant-1",
      customerPhone: "+12025551234",
      customerFirstName: "John",
      customerLastName: "Doe",
      customerEmail: "john@example.com",
      totalAmount: 50.0,
    };

    it("should process order and award points", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
      vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(1.0);
      vi.mocked(loyaltyMemberService.findOrCreateByPhone).mockResolvedValue({
        member: mockMember,
        isNew: false,
      });
      vi.mocked(pointsService.awardPoints).mockResolvedValue({
        pointsEarned: 50,
        newBalance: 150,
        transactionId: "tx-1",
      });
      vi.mocked(loyaltyMemberService.updateOrderStats).mockResolvedValue();

      const result = await service.processOrderCompletion(
        "tenant-1",
        "order-1",
        orderData
      );

      expect(result).toEqual({
        pointsEarned: 50,
        newBalance: 150,
        transactionId: "tx-1",
      });

      expect(loyaltyMemberService.findOrCreateByPhone).toHaveBeenCalledWith(
        "tenant-1",
        "+12025551234",
        expect.objectContaining({
          phone: "+12025551234",
          firstName: "John",
          lastName: "Doe",
        })
      );

      expect(pointsService.awardPoints).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        expect.objectContaining({
          merchantId: "merchant-1",
          orderId: "order-1",
          orderAmount: 50.0,
          pointsPerDollar: 1.0,
        })
      );

      expect(loyaltyMemberService.updateOrderStats).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        50.0
      );
    });

    it("should return null if loyalty is not enabled", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(false);

      const result = await service.processOrderCompletion(
        "tenant-1",
        "order-1",
        orderData
      );

      expect(result).toBeNull();
      expect(pointsService.awardPoints).not.toHaveBeenCalled();
    });

    it("should return null if points already awarded", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
      vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(true);

      const result = await service.processOrderCompletion(
        "tenant-1",
        "order-1",
        orderData
      );

      expect(result).toBeNull();
      expect(loyaltyMemberService.findOrCreateByPhone).not.toHaveBeenCalled();
    });

    it("should use configured points per dollar", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
      vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(2.0);
      vi.mocked(loyaltyMemberService.findOrCreateByPhone).mockResolvedValue({
        member: mockMember,
        isNew: false,
      });
      vi.mocked(pointsService.awardPoints).mockResolvedValue({
        pointsEarned: 100,
        newBalance: 200,
        transactionId: "tx-1",
      });
      vi.mocked(loyaltyMemberService.updateOrderStats).mockResolvedValue();

      await service.processOrderCompletion(
        "tenant-1",
        "order-1",
        orderData
      );

      expect(pointsService.awardPoints).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        expect.objectContaining({
          pointsPerDollar: 2.0,
        })
      );
    });

    it("should use loyaltyMemberId directly when provided (skip phone lookup)", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
      vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(1.0);
      vi.mocked(pointsService.awardPoints).mockResolvedValue({
        pointsEarned: 50,
        newBalance: 150,
        transactionId: "tx-1",
      });
      vi.mocked(loyaltyMemberService.updateOrderStats).mockResolvedValue();

      await service.processOrderCompletion("tenant-1", "order-1", {
        ...orderData,
        loyaltyMemberId: "member-42",
      });

      // Should NOT call findOrCreateByPhone when loyaltyMemberId is provided
      expect(loyaltyMemberService.findOrCreateByPhone).not.toHaveBeenCalled();

      // Should call awardPoints with the provided memberId
      expect(pointsService.awardPoints).toHaveBeenCalledWith(
        "tenant-1",
        "member-42",
        expect.objectContaining({
          orderId: "order-1",
          orderAmount: 50.0,
        })
      );
    });

    it("should award 2x points for gift card portion (mixed payment)", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
      vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(1.0);
      vi.mocked(loyaltyMemberService.findOrCreateByPhone).mockResolvedValue({
        member: mockMember,
        isNew: false,
      });
      vi.mocked(pointsService.awardPointsWithCustomAmount).mockResolvedValue({
        pointsEarned: 30,
        newBalance: 130,
        transactionId: "tx-gc",
      });
      vi.mocked(loyaltyMemberService.updateOrderStats).mockResolvedValue();

      const result = await service.processOrderCompletion("tenant-1", "order-1", {
        ...orderData,
        totalAmount: 20,
        giftCardPayment: 10, // 10 gift card + 10 cash
      });

      expect(result).toEqual({
        pointsEarned: 30,
        newBalance: 130,
        transactionId: "tx-gc",
      });

      // Should use awardPointsWithCustomAmount, not awardPoints
      expect(pointsService.awardPointsWithCustomAmount).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        expect.objectContaining({
          points: 30, // floor(10 * 1 * 2) + floor(10 * 1) = 20 + 10 = 30
          description: expect.stringContaining("2x"),
        })
      );
      expect(pointsService.awardPoints).not.toHaveBeenCalled();
    });

    it("should award 2x points for gift-card-only payment", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
      vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(1.0);
      vi.mocked(loyaltyMemberService.findOrCreateByPhone).mockResolvedValue({
        member: mockMember,
        isNew: false,
      });
      vi.mocked(pointsService.awardPointsWithCustomAmount).mockResolvedValue({
        pointsEarned: 40,
        newBalance: 140,
        transactionId: "tx-gc2",
      });
      vi.mocked(loyaltyMemberService.updateOrderStats).mockResolvedValue();

      const result = await service.processOrderCompletion("tenant-1", "order-1", {
        ...orderData,
        totalAmount: 20,
        giftCardPayment: 20, // fully gift card
      });

      expect(result).toEqual({
        pointsEarned: 40,
        newBalance: 140,
        transactionId: "tx-gc2",
      });

      expect(pointsService.awardPointsWithCustomAmount).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        expect.objectContaining({
          points: 40, // floor(20 * 1 * 2) = 40
          description: expect.stringContaining("2x bonus on gift card payment"),
        })
      );
    });

    it("should return null when gift card 2x points total is 0", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
      vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(0);
      vi.mocked(loyaltyMemberService.findOrCreateByPhone).mockResolvedValue({
        member: mockMember,
        isNew: false,
      });

      const result = await service.processOrderCompletion("tenant-1", "order-1", {
        ...orderData,
        totalAmount: 5,
        giftCardPayment: 5,
      });

      expect(result).toBeNull();
      expect(pointsService.awardPointsWithCustomAmount).not.toHaveBeenCalled();
      expect(pointsService.awardPoints).not.toHaveBeenCalled();
    });

    it("should use standard awardPoints when no gift card payment", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
      vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
      vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(1.0);
      vi.mocked(loyaltyMemberService.findOrCreateByPhone).mockResolvedValue({
        member: mockMember,
        isNew: false,
      });
      vi.mocked(pointsService.awardPoints).mockResolvedValue({
        pointsEarned: 50,
        newBalance: 150,
        transactionId: "tx-cash",
      });
      vi.mocked(loyaltyMemberService.updateOrderStats).mockResolvedValue();

      await service.processOrderCompletion("tenant-1", "order-1", {
        ...orderData,
        giftCardPayment: 0, // explicitly 0
      });

      expect(pointsService.awardPoints).toHaveBeenCalled();
      expect(pointsService.awardPointsWithCustomAmount).not.toHaveBeenCalled();
    });
  });

  describe("getCustomerDashboard", () => {
    it("should return dashboard data", async () => {
      vi.mocked(loyaltyConfigService.getLoyaltyConfig).mockResolvedValue(mockConfig);
      vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue(mockMember);

      const result = await service.getCustomerDashboard(
        "tenant-1",
        "+12025551234"
      );

      expect(result.member).toEqual(mockMember);
      expect(result.config).toEqual(mockConfig);
      expect(result.isEnabled).toBe(true);
    });

    it("should return isEnabled false if config inactive", async () => {
      vi.mocked(loyaltyConfigService.getLoyaltyConfig).mockResolvedValue({
        ...mockConfig,
        status: "inactive",
      });
      vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue(null);

      const result = await service.getCustomerDashboard(
        "tenant-1",
        "+12025551234"
      );

      expect(result.isEnabled).toBe(false);
      expect(result.member).toBeNull();
    });

    it("should return isEnabled false if no config", async () => {
      vi.mocked(loyaltyConfigService.getLoyaltyConfig).mockResolvedValue(null);
      vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue(null);

      const result = await service.getCustomerDashboard(
        "tenant-1",
        "+12025551234"
      );

      expect(result.isEnabled).toBe(false);
      expect(result.config).toBeNull();
    });
  });

  describe("isLoyaltyEnabled", () => {
    it("should return true if loyalty is enabled", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);

      const result = await service.isLoyaltyEnabled("tenant-1");

      expect(result).toBe(true);
    });

    it("should return false if loyalty is disabled", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(false);

      const result = await service.isLoyaltyEnabled("tenant-1");

      expect(result).toBe(false);
    });
  });

  describe("getCustomerLoyaltyStatus", () => {
    it("should return loyalty status", async () => {
      const mockStatus: LoyaltyStatus = {
        memberId: "member-1",
        phone: "+12025551234",
        firstName: "John",
        lastName: "Doe",
        points: 100,
        totalOrders: 5,
        totalSpent: 150.0,
        enrolledAt: new Date(),
        pointsValue: 1.0,
      };
      vi.mocked(loyaltyMemberService.getLoyaltyStatusByPhone).mockResolvedValue(
        mockStatus
      );

      const result = await service.getCustomerLoyaltyStatus(
        "tenant-1",
        "+12025551234"
      );

      expect(result).toEqual(mockStatus);
    });

    it("should return null if member not found", async () => {
      vi.mocked(loyaltyMemberService.getLoyaltyStatusByPhone).mockResolvedValue(null);

      const result = await service.getCustomerLoyaltyStatus(
        "tenant-1",
        "+12025559999"
      );

      expect(result).toBeNull();
    });
  });

  describe("enrollCustomer", () => {
    it("should enroll new customer", async () => {
      vi.mocked(loyaltyMemberService.findOrCreateByPhone).mockResolvedValue({
        member: { ...mockMember, points: 0, totalOrders: 0 },
        isNew: true,
      });

      const result = await service.enrollCustomer(
        "tenant-1",
        "+12025559999",
        { firstName: "Jane", lastName: "Doe", email: "jane@example.com" }
      );

      expect(result.isNew).toBe(true);
      expect(loyaltyMemberService.findOrCreateByPhone).toHaveBeenCalledWith(
        "tenant-1",
        "+12025559999",
        expect.objectContaining({
          phone: "+12025559999",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
        })
      );
    });

    it("should return existing member if already enrolled", async () => {
      vi.mocked(loyaltyMemberService.findOrCreateByPhone).mockResolvedValue({
        member: mockMember,
        isNew: false,
      });

      const result = await service.enrollCustomer(
        "tenant-1",
        "+12025551234"
      );

      expect(result.isNew).toBe(false);
      expect(result.member).toEqual(mockMember);
    });
  });
});
