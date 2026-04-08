import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../award-order-points/route";

// Mock services
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getCompanyBySlug: vi.fn(),
  },
}));

vi.mock("@/services/order", () => ({
  orderService: {
    getOrder: vi.fn(),
    linkLoyaltyMember: vi.fn(),
  },
}));

vi.mock("@/services/loyalty", () => ({
  pointsService: {
    hasEarnedForOrder: vi.fn(),
    awardPoints: vi.fn(),
  },
  loyaltyConfigService: {
    isLoyaltyEnabled: vi.fn(),
    getPointsPerDollar: vi.fn(),
  },
}));

import { merchantService } from "@/services/merchant";
import { orderService } from "@/services/order";
import { pointsService, loyaltyConfigService } from "@/services/loyalty";
import type { CompanyWithMerchants } from "@/services/merchant/merchant.types";

describe("POST /api/storefront/loyalty/award-order-points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if orderId is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          memberId: "member-123",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    // Zod validation returns error message
    expect(data.error).toBeDefined();
  });

  it("should return 400 if memberId is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-123",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it("should return 400 if companySlug is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-123",
          memberId: "member-123",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it("should return 400 if orderId is empty string", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "",
          memberId: "member-123",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Order ID is required");
  });

  it("should return 404 if company not found", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-123",
          memberId: "member-123",
          companySlug: "non-existent",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Company not found");
  });

  it("should return 400 if loyalty program is not enabled", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue({
      id: "company-1",
      tenantId: "tenant-1",
      name: "Test Company",
      slug: "test-company",
      merchants: [],
    } as unknown as CompanyWithMerchants);

    vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(false);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-123",
          memberId: "member-123",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Loyalty program is not enabled");
  });

  it("should return 400 if points already awarded", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue({
      id: "company-1",
      tenantId: "tenant-1",
      name: "Test Company",
      slug: "test-company",
      merchants: [],
    } as unknown as CompanyWithMerchants);

    vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
    vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(true);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-123",
          memberId: "member-123",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Points already awarded for this order");
  });

  it("should return 404 if order not found", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue({
      id: "company-1",
      tenantId: "tenant-1",
      name: "Test Company",
      slug: "test-company",
      merchants: [],
    } as unknown as CompanyWithMerchants);

    vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
    vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
    vi.mocked(orderService.getOrder).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-123",
          memberId: "member-123",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Order not found");
  });

  it("should award points successfully", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue({
      id: "company-1",
      tenantId: "tenant-1",
      name: "Test Company",
      slug: "test-company",
      merchants: [],
    } as unknown as CompanyWithMerchants);

    vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
    vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);
    // Mock order with totalAmount that can be converted with Number()
    const mockOrder = {
      id: "order-123",
      merchantId: "merchant-1",
      orderNumber: "1001",
      totalAmount: 50.0,
    };
    vi.mocked(orderService.getOrder).mockResolvedValue(
      mockOrder as unknown as Awaited<ReturnType<typeof orderService.getOrder>>
    );
    vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(1);
    vi.mocked(pointsService.awardPoints).mockResolvedValue({
      pointsEarned: 50,
      newBalance: 150,
      transactionId: "tx-1",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-123",
          memberId: "member-123",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.pointsEarned).toBe(50);
    expect(data.data.newBalance).toBe(150);

    expect(pointsService.awardPoints).toHaveBeenCalledWith(
      "tenant-1",
      "member-123",
      expect.objectContaining({
        merchantId: "merchant-1",
        orderId: "order-123",
        orderAmount: 50.0,
        pointsPerDollar: 1,
        description: "Earned from order #1001",
      })
    );

    // Verify order is linked to loyalty member
    expect(orderService.linkLoyaltyMember).toHaveBeenCalledWith(
      "tenant-1",
      "order-123",
      "member-123"
    );
  });

  it("should return 500 on internal error", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockRejectedValue(
      new Error("Database error")
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/award-order-points",
      {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-123",
          memberId: "member-123",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to award points");
  });
});
