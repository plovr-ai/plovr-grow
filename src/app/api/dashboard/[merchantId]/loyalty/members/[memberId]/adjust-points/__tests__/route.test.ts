import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock services
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantById: vi.fn(),
  },
}));

vi.mock("@/services/loyalty", () => ({
  loyaltyMemberService: {
    getMember: vi.fn(),
  },
  pointsService: {
    adjustPoints: vi.fn(),
  },
}));

import { merchantService } from "@/services/merchant";
import { loyaltyMemberService, pointsService } from "@/services/loyalty";

const mockMerchantService = vi.mocked(merchantService);
const mockLoyaltyMemberService = vi.mocked(loyaltyMemberService);
const mockPointsService = vi.mocked(pointsService);

describe("POST /api/dashboard/[merchantId]/loyalty/members/[memberId]/adjust-points", () => {
  const mockMerchant = {
    id: "merchant-1",
    name: "Test Merchant",
    company: {
      id: "company-1",
      tenantId: "tenant-1",
    },
  };

  const mockMember = {
    id: "member-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    phone: "1234567890",
    points: 500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: Record<string, unknown>) {
    return new NextRequest(
      "http://localhost:3000/api/dashboard/merchant-1/loyalty/members/member-1/adjust-points",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  const params = Promise.resolve({
    merchantId: "merchant-1",
    memberId: "member-1",
  });

  describe("Validation", () => {
    beforeEach(() => {
      // Set up mocks for validation tests
      mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
      mockLoyaltyMemberService.getMember.mockResolvedValue(mockMember as never);
    });

    it("should return 400 if points is missing", async () => {
      const request = createRequest({ description: "Test reason" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 400 if description is missing", async () => {
      const request = createRequest({ points: 100 });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 400 if points is zero", async () => {
      const request = createRequest({ points: 0, description: "Test" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Points must not be zero");
    });

    it("should return 400 if description is empty", async () => {
      const request = createRequest({ points: 100, description: "" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Description is required");
    });
  });

  describe("Authorization", () => {
    it("should return 404 if merchant not found", async () => {
      mockMerchantService.getMerchantById.mockResolvedValue(null);

      const request = createRequest({ points: 100, description: "Test" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Merchant not found");
    });

    it("should return 404 if member not found", async () => {
      mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
      mockLoyaltyMemberService.getMember.mockResolvedValue(null);

      const request = createRequest({ points: 100, description: "Test" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Member not found");
    });

    it("should return 403 if member belongs to different company", async () => {
      mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
      mockLoyaltyMemberService.getMember.mockResolvedValue({
        ...mockMember,
        companyId: "different-company",
      } as never);

      const request = createRequest({ points: 100, description: "Test" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Member does not belong to this company");
    });
  });

  describe("Success Cases", () => {
    it("should successfully add points", async () => {
      mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
      mockLoyaltyMemberService.getMember.mockResolvedValue(mockMember as never);
      mockPointsService.adjustPoints.mockResolvedValue({
        pointsEarned: 100,
        newBalance: 600,
        transactionId: "txn-123",
      });

      const request = createRequest({
        points: 100,
        description: "Bonus points",
      });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.newBalance).toBe(600);
      expect(data.data.transactionId).toBe("txn-123");

      expect(mockPointsService.adjustPoints).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        100,
        "Bonus points"
      );
    });

    it("should successfully deduct points", async () => {
      mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
      mockLoyaltyMemberService.getMember.mockResolvedValue(mockMember as never);
      mockPointsService.adjustPoints.mockResolvedValue({
        pointsEarned: -200,
        newBalance: 300,
        transactionId: "txn-456",
      });

      const request = createRequest({
        points: -200,
        description: "Refund adjustment",
      });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.newBalance).toBe(300);

      expect(mockPointsService.adjustPoints).toHaveBeenCalledWith(
        "tenant-1",
        "member-1",
        -200,
        "Refund adjustment"
      );
    });
  });

  describe("Error Handling", () => {
    it("should return 400 if adjustment would result in negative balance", async () => {
      mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
      mockLoyaltyMemberService.getMember.mockResolvedValue(mockMember as never);
      mockPointsService.adjustPoints.mockRejectedValue(
        new Error("Adjustment would result in negative balance")
      );

      const request = createRequest({
        points: -1000,
        description: "Too many points",
      });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Adjustment would result in negative balance");
    });

    it("should return 500 for unexpected errors", async () => {
      mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
      mockLoyaltyMemberService.getMember.mockResolvedValue(mockMember as never);
      mockPointsService.adjustPoints.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createRequest({
        points: 100,
        description: "Test",
      });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Failed to adjust points");
    });
  });
});
