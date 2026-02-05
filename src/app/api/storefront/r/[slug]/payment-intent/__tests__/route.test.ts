import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock services
vi.mock("@/services/payment", () => ({
  paymentService: {
    createPaymentIntent: vi.fn(),
  },
}));

vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantBySlug: vi.fn(),
  },
}));

import { paymentService } from "@/services/payment";
import { merchantService } from "@/services/merchant";

describe("POST /api/storefront/r/[slug]/payment-intent", () => {
  const mockMerchant = {
    id: "merchant-1",
    slug: "test-restaurant",
    company: {
      id: "company-1",
      tenantId: "tenant-1",
    },
  };

  const mockPaymentIntentResult = {
    paymentIntentId: "pi_test123",
    clientSecret: "pi_test123_secret_abc",
    stripeCustomerId: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create PaymentIntent successfully", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(
      mockMerchant as never
    );
    vi.mocked(paymentService.createPaymentIntent).mockResolvedValue(
      mockPaymentIntentResult
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/test-restaurant/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: 25.99,
          currency: "USD",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "test-restaurant" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.clientSecret).toBe("pi_test123_secret_abc");
    expect(data.data.paymentIntentId).toBe("pi_test123");
  });

  it("should create PaymentIntent with loyalty member and save card", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(
      mockMerchant as never
    );
    vi.mocked(paymentService.createPaymentIntent).mockResolvedValue({
      ...mockPaymentIntentResult,
      stripeCustomerId: "cus_123",
    });

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/test-restaurant/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: 50.0,
          currency: "USD",
          loyaltyMemberId: "member-1",
          saveCard: true,
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "test-restaurant" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.stripeCustomerId).toBe("cus_123");

    expect(paymentService.createPaymentIntent).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      companyId: "company-1",
      merchantId: "merchant-1",
      amount: 50.0,
      currency: "USD",
      loyaltyMemberId: "member-1",
      saveCard: true,
    });
  });

  it("should return 404 when merchant not found", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/non-existent/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: 25.99,
          currency: "USD",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "non-existent" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Restaurant not found");
  });

  it("should return 400 for invalid amount", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(
      mockMerchant as never
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/test-restaurant/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: -10,
          currency: "USD",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "test-restaurant" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Validation failed");
  });

  it("should return 400 for zero amount", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(
      mockMerchant as never
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/test-restaurant/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: 0,
          currency: "USD",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "test-restaurant" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Validation failed");
  });

  it("should return 400 for missing amount", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(
      mockMerchant as never
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/test-restaurant/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          currency: "USD",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "test-restaurant" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Validation failed");
  });

  it("should use default currency when not provided", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(
      mockMerchant as never
    );
    vi.mocked(paymentService.createPaymentIntent).mockResolvedValue(
      mockPaymentIntentResult
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/test-restaurant/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: 25.99,
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "test-restaurant" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    expect(paymentService.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "USD",
      })
    );
  });

  it("should return 500 when paymentService throws error", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(
      mockMerchant as never
    );
    vi.mocked(paymentService.createPaymentIntent).mockRejectedValue(
      new Error("Stripe API error")
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/test-restaurant/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: 25.99,
          currency: "USD",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "test-restaurant" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Stripe API error");
  });

  it("should handle non-Error exceptions", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(
      mockMerchant as never
    );
    vi.mocked(paymentService.createPaymentIntent).mockRejectedValue(
      "Unknown error"
    );

    const request = new NextRequest(
      "http://localhost:3000/api/storefront/r/test-restaurant/payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          amount: 25.99,
          currency: "USD",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "test-restaurant" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to create payment intent");
  });
});
