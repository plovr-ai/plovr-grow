import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoyaltyService } from "../loyalty.service";
import { loyaltyConfigService } from "../loyalty-config.service";
import { loyaltyMemberService } from "../loyalty-member.service";
import { pointsService } from "../points.service";

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
  },
}));

describe("LoyaltyService", () => {
  let service: LoyaltyService;

  const mockMember = {
    id: "member-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    phone: "+12025551234",
    name: "John Doe",
    email: "john@example.com",
    points: 100,
    totalOrders: 5,
    totalSpent: 150.0,
    lastOrderAt: new Date(),
    enrolledAt: new Date(),
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockConfig = {
    id: "config-1",
    tenantId: "tenant-1",
    companyId: "company-1",
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
        "company-1",
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
        "company-1",
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
        "company-1",
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
        "company-1",
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
        "company-1",
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
  });

  describe("getCustomerDashboard", () => {
    it("should return dashboard data", async () => {
      vi.mocked(loyaltyConfigService.getLoyaltyConfig).mockResolvedValue(mockConfig);
      vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue(mockMember);

      const result = await service.getCustomerDashboard(
        "tenant-1",
        "company-1",
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
        "company-1",
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
        "company-1",
        "+12025551234"
      );

      expect(result.isEnabled).toBe(false);
      expect(result.config).toBeNull();
    });
  });

  describe("isLoyaltyEnabled", () => {
    it("should return true if loyalty is enabled", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);

      const result = await service.isLoyaltyEnabled("tenant-1", "company-1");

      expect(result).toBe(true);
    });

    it("should return false if loyalty is disabled", async () => {
      vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(false);

      const result = await service.isLoyaltyEnabled("tenant-1", "company-1");

      expect(result).toBe(false);
    });
  });

  describe("getCustomerLoyaltyStatus", () => {
    it("should return loyalty status", async () => {
      const mockStatus = {
        memberId: "member-1",
        phone: "+12025551234",
        name: "John Doe",
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
        "company-1",
        "+12025551234"
      );

      expect(result).toEqual(mockStatus);
    });

    it("should return null if member not found", async () => {
      vi.mocked(loyaltyMemberService.getLoyaltyStatusByPhone).mockResolvedValue(null);

      const result = await service.getCustomerLoyaltyStatus(
        "tenant-1",
        "company-1",
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
        "company-1",
        "+12025559999",
        { firstName: "Jane", lastName: "Doe", email: "jane@example.com" }
      );

      expect(result.isNew).toBe(true);
      expect(loyaltyMemberService.findOrCreateByPhone).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
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
        "company-1",
        "+12025551234"
      );

      expect(result.isNew).toBe(false);
      expect(result.member).toEqual(mockMember);
    });
  });
});
