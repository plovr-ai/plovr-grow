import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock services
vi.mock("@/services/otp", () => ({
  otpService: {
    verifyOtp: vi.fn(),
  },
}));

vi.mock("@/services/loyalty", () => ({
  loyaltyService: {
    enrollCustomer: vi.fn(),
  },
  loyaltyMemberService: {
    getMemberByPhone: vi.fn(),
  },
}));

vi.mock("@/services/merchant", () => ({
  merchantService: {
    getTenantBySlug: vi.fn(),
  },
}));

vi.mock("@/lib/loyalty-session", () => ({
  setLoyaltySession: vi.fn(),
}));

import { otpService } from "@/services/otp";
import { loyaltyService, loyaltyMemberService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";
import type { TenantWithMerchants } from "@/services/merchant/merchant.types";

describe("POST /api/storefront/loyalty/otp/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept and process email parameter", async () => {
    // Mock company lookup
    vi.mocked(merchantService.getTenantBySlug).mockResolvedValue({
      id: "tenant-1",
      tenantId: "tenant-1",
      slug: "test-company",
      name: "Test Company",
    } as unknown as TenantWithMerchants);

    // Mock existing member check
    vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue(null);

    // Mock OTP verification
    vi.mocked(otpService.verifyOtp).mockResolvedValue({
      verified: true,
      success: true,
      reason: undefined,
    });

    // Mock member enrollment
    vi.mocked(loyaltyService.enrollCustomer).mockResolvedValue({
      member: {
        id: "member-1",
        phone: "+15551234567",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        points: 0,
        tenantId: "tenant-1",
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isNew: true,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "123456",
          companySlug: "test-company",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.member).toBeDefined();

    // Verify that enrollCustomer was called with email
    expect(loyaltyService.enrollCustomer).toHaveBeenCalledWith(
      "tenant-1",
      "+15551234567",
      {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      }
    );
  });

  it("should handle empty email string", async () => {
    vi.mocked(merchantService.getTenantBySlug).mockResolvedValue({
      id: "tenant-1",
      tenantId: "tenant-1",
      slug: "test-company",
      name: "Test Company",
    } as unknown as TenantWithMerchants);

    vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue(null);

    vi.mocked(otpService.verifyOtp).mockResolvedValue({
      verified: true,
      success: true,
      reason: undefined,
    });

    vi.mocked(loyaltyService.enrollCustomer).mockResolvedValue({
      member: {
        id: "member-1",
        phone: "+15551234567",
        firstName: "John",
        lastName: "Doe",
        email: null,
        points: 0,
        tenantId: "tenant-1",
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isNew: true,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "123456",
          companySlug: "test-company",
          firstName: "John",
          lastName: "Doe",
          email: "",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify that enrollCustomer was called with undefined for empty email
    expect(loyaltyService.enrollCustomer).toHaveBeenCalledWith(
      "tenant-1",
      "+15551234567",
      {
        firstName: "John",
        lastName: "Doe",
        email: undefined,
      }
    );
  });

  it("should reject invalid email format", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "123456",
          companySlug: "test-company",
          firstName: "John",
          lastName: "Doe",
          email: "invalid-email",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("email");
  });

  it("should reject null email (Zod validation)", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "123456",
          companySlug: "test-company",
          firstName: "John",
          lastName: "Doe",
          email: null,
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    // Null is not allowed by Zod schema
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should work without email parameter (backward compatibility)", async () => {
    vi.mocked(merchantService.getTenantBySlug).mockResolvedValue({
      id: "tenant-1",
      tenantId: "tenant-1",
      slug: "test-company",
      name: "Test Company",
    } as unknown as TenantWithMerchants);

    vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue(null);

    vi.mocked(otpService.verifyOtp).mockResolvedValue({
      verified: true,
      success: true,
      reason: undefined,
    });

    vi.mocked(loyaltyService.enrollCustomer).mockResolvedValue({
      member: {
        id: "member-1",
        phone: "+15551234567",
        firstName: "John",
        lastName: "Doe",
        email: null,
        points: 0,
        tenantId: "tenant-1",
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isNew: true,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "123456",
          companySlug: "test-company",
          firstName: "John",
          lastName: "Doe",
          // No email parameter
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Email should be undefined when not provided
    expect(loyaltyService.enrollCustomer).toHaveBeenCalledWith(
      "tenant-1",
      "+15551234567",
      {
        firstName: "John",
        lastName: "Doe",
        email: undefined,
      }
    );
  });

  it("should use login purpose for existing member", async () => {
    vi.mocked(merchantService.getTenantBySlug).mockResolvedValue({
      id: "company-1",
      tenantId: "tenant-1",
      slug: "test-company",
      name: "Test Company",
    } as unknown as TenantWithMerchants);

    // Return existing member
    vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue({
      id: "member-existing",
      phone: "+15551234567",
      firstName: "John",
      lastName: "Doe",
      email: null,
      points: 100,
      tenantId: "tenant-1",    } as never);

    vi.mocked(otpService.verifyOtp).mockResolvedValue({
      verified: true,
      success: true,
      reason: undefined,
    });

    vi.mocked(loyaltyService.enrollCustomer).mockResolvedValue({
      member: {
        id: "member-existing",
        phone: "+15551234567",
        firstName: "John",
        lastName: "Doe",
        email: null,
        points: 100,
        tenantId: "tenant-1",        totalOrders: 5,
        totalSpent: 200,
        lastOrderAt: null,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isNew: false,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "123456",
          companySlug: "test-company",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Should use "login" purpose for existing member
    expect(otpService.verifyOtp).toHaveBeenCalledWith(
      "tenant-1",
      "+15551234567",
      "123456",
      "login"
    );
  });

  it("should return 500 for unexpected errors", async () => {
    vi.mocked(merchantService.getTenantBySlug).mockRejectedValue(
      new Error("DB error")
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "123456",
          companySlug: "test-company",
          firstName: "John",
          lastName: "Doe",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toEqual({ code: "INTERNAL_ERROR" });
  });

  it("should return error when company not found", async () => {
    vi.mocked(merchantService.getTenantBySlug).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "123456",
          companySlug: "non-existent",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Company not found");
  });

  it("should return error when OTP verification fails", async () => {
    vi.mocked(merchantService.getTenantBySlug).mockResolvedValue({
      id: "tenant-1",
      tenantId: "tenant-1",
      slug: "test-company",
      name: "Test Company",
    } as unknown as TenantWithMerchants);

    vi.mocked(loyaltyMemberService.getMemberByPhone).mockResolvedValue(null);

    vi.mocked(otpService.verifyOtp).mockResolvedValue({
      success: false,
      verified: false,
      errorCode: "OTP_EXPIRED",
      reason: "expired",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/loyalty/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: "+15551234567",
          code: "999999",
          companySlug: "test-company",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("OTP_EXPIRED");
  });
});
