import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../order-points-status/route";

// Mock services
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getCompanyBySlug: vi.fn(),
  },
}));

vi.mock("@/services/loyalty", () => ({
  pointsService: {
    hasEarnedForOrder: vi.fn(),
  },
}));

import { merchantService } from "@/services/merchant";
import { pointsService } from "@/services/loyalty";
import type { CompanyWithMerchants } from "@/services/merchant/merchant.types";

describe("GET /api/storefront/loyalty/order-points-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if orderId is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/order-points-status?companySlug=test-company"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Missing required parameters");
  });

  it("should return 400 if companySlug is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/order-points-status?orderId=order-123"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Missing required parameters");
  });

  it("should return 404 if company not found", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/order-points-status?orderId=order-123&companySlug=non-existent"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Company not found");
  });

  it("should return pointsAwarded: true when points already awarded", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue({
      id: "company-1",
      tenantId: "tenant-1",
      name: "Test Company",
      slug: "test-company",
      merchants: [],
    } as unknown as CompanyWithMerchants);

    vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(true);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/order-points-status?orderId=order-123&companySlug=test-company"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.pointsAwarded).toBe(true);
    expect(pointsService.hasEarnedForOrder).toHaveBeenCalledWith(
      "tenant-1",
      "order-123"
    );
  });

  it("should return pointsAwarded: false when points not awarded", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue({
      id: "company-1",
      tenantId: "tenant-1",
      name: "Test Company",
      slug: "test-company",
      merchants: [],
    } as unknown as CompanyWithMerchants);

    vi.mocked(pointsService.hasEarnedForOrder).mockResolvedValue(false);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/order-points-status?orderId=order-123&companySlug=test-company"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.pointsAwarded).toBe(false);
  });

  it("should return 500 on internal error", async () => {
    vi.mocked(merchantService.getCompanyBySlug).mockRejectedValue(
      new Error("Database error")
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/order-points-status?orderId=order-123&companySlug=test-company"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to check points status");
  });
});
