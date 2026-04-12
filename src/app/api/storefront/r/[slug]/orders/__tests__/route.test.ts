import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock all dependencies
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantBySlug: vi.fn(),
  },
}));

vi.mock("@/services/order", () => ({
  orderService: {
    createMerchantOrderAtomic: vi.fn(),
    calculateOrderTotals: vi.fn(),
  },
}));

vi.mock("@/services/giftcard", () => ({
  giftCardService: {
    getGiftCard: vi.fn(),
  },
}));

vi.mock("@/services/payment", () => ({
  paymentService: {
    verifyPayment: vi.fn(),
    providerPaymentExists: vi.fn(),
  },
}));

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    getConnectAccount: vi.fn(),
  },
}));

vi.mock("@/services/loyalty", () => ({
  pointsService: {
    awardPointsWithCustomAmount: vi.fn(),
  },
  loyaltyConfigService: {
    isLoyaltyEnabled: vi.fn(),
    getPointsPerDollar: vi.fn(),
  },
}));

// Note: Loyalty points are now awarded via the order.paid event handler
// (loyalty-event-handler.ts), NOT directly in this route. Tests below
// verify the route no longer calls pointsService directly.

vi.mock("@storefront/lib/validations/checkout", () => ({
  checkoutFormSchema: {
    safeParse: vi.fn(),
  },
}));

import { merchantService } from "@/services/merchant";
import { orderService } from "@/services/order";
import { giftCardService } from "@/services/giftcard";
import { paymentService } from "@/services/payment";
import { stripeConnectService } from "@/services/stripe-connect";
import { checkoutFormSchema } from "@storefront/lib/validations/checkout";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/storefront/r/test-merchant/orders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const mockMerchant = {
  id: "merchant-1",
  name: "Test Merchant",
  slug: "test-merchant",
  currency: "USD",
  tenant: {
    id: "tenant-1",
    tenantId: "tenant-1",
  },
};

const validBody = {
  orderMode: "pickup",
  customerFirstName: "John",
  customerLastName: "Doe",
  customerPhone: "123-456-7890",
  items: [
    {
      menuItemId: "item-1",
      name: "Pizza",
      price: 20,
      quantity: 1,
      selectedModifiers: [],
      totalPrice: 20,
      taxes: [],
    },
  ],
};

const mockOrder = {
  id: "order-1",
  orderNumber: "20260408-0001",
  giftCardPayment: 0,
  balanceDue: 20,
  totalAmount: 20,
};

describe("POST /api/storefront/r/[slug]/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(mockMerchant as never);

    vi.mocked(checkoutFormSchema.safeParse).mockReturnValue({
      success: true,
      data: {
        orderMode: "pickup",
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "123-456-7890",
      },
    } as never);

    vi.mocked(orderService.createMerchantOrderAtomic).mockResolvedValue(mockOrder as never);
  });

  it("should create order successfully with 201 status", async () => {
    const request = createRequest(validBody);
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.orderId).toBe("order-1");
  });

  it("should call createMerchantOrderAtomic instead of separate service calls", async () => {
    const request = createRequest(validBody);
    await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });

    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledTimes(1);
    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        merchantId: "merchant-1",
        customerFirstName: "John",
        orderMode: "pickup",
      }),
      expect.objectContaining({
        giftCard: undefined,
        payment: undefined,
      })
    );
  });

  it("should pass gift card info to atomic method when gift card payment provided", async () => {
    vi.mocked(giftCardService.getGiftCard).mockResolvedValue({
      id: "gc-1",
      currentBalance: 50,
      cardNumber: "1234-5678-9012-3456",
      initialAmount: 50,
      createdAt: new Date(),
    } as never);

    const bodyWithGiftCard = {
      ...validBody,
      giftCardPayment: { giftCardId: "gc-1", amount: 15 },
    };

    const request = createRequest(bodyWithGiftCard);
    await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });

    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ giftCardPayment: 15 }),
      expect.objectContaining({
        giftCard: { id: "gc-1", amount: 15 },
      })
    );
  });

  it("should pass payment info to atomic method when card payment verified", async () => {
    vi.mocked(orderService.calculateOrderTotals).mockResolvedValue({
      subtotal: 20,
      taxAmount: 0,
      taxBreakdown: [],
      feesAmount: 0,
      feesBreakdown: [],
      tipAmount: 0,
      deliveryFee: 0,
      discount: 0,
      totalAmount: 20,
    } as never);

    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
      stripeAccountId: "acct_test123",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      scope: "read_write",
    } as never);

    vi.mocked(paymentService.verifyPayment).mockResolvedValue({
      success: true,
      paymentIntentId: "pi_123",
      status: "succeeded",
      amount: 2000,
      cardBrand: "visa",
      cardLast4: "4242",
    } as never);

    const bodyWithPayment = {
      ...validBody,
      paymentMethod: "card",
      stripePaymentIntentId: "pi_123",
    };

    const request = createRequest(bodyWithPayment);
    await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });

    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledWith(
      "tenant-1",
      expect.any(Object),
      expect.objectContaining({
        payment: {
          provider: "stripe",
          providerPaymentId: "pi_123",
          amount: 20,
          currency: "USD",
        },
      })
    );
  });

  it("should return 500 when transaction fails (e.g., gift card redemption error)", async () => {
    vi.mocked(giftCardService.getGiftCard).mockResolvedValue({
      id: "gc-1",
      currentBalance: 50,
      cardNumber: "1234-5678-9012-3456",
      initialAmount: 50,
      createdAt: new Date(),
    } as never);

    vi.mocked(orderService.createMerchantOrderAtomic).mockRejectedValue(
      new Error("Gift card has no balance")
    );

    const bodyWithGiftCard = {
      ...validBody,
      giftCardPayment: { giftCardId: "gc-1", amount: 15 },
    };

    const request = createRequest(bodyWithGiftCard);
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toEqual({ code: "INTERNAL_ERROR" });
  });

  it("should return 409 when PaymentIntent has already been used", async () => {
    vi.mocked(orderService.calculateOrderTotals).mockResolvedValue({
      subtotal: 20,
      taxAmount: 0,
      taxBreakdown: [],
      feesAmount: 0,
      feesBreakdown: [],
      tipAmount: 0,
      deliveryFee: 0,
      discount: 0,
      totalAmount: 20,
    } as never);

    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
      stripeAccountId: "acct_test123",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      scope: "read_write",
    } as never);

    vi.mocked(paymentService.verifyPayment).mockResolvedValue({
      success: true,
      paymentIntentId: "pi_duplicate",
      status: "succeeded",
      amount: 2000,
      cardBrand: "visa",
      cardLast4: "4242",
    } as never);

    // PaymentIntent already used
    vi.mocked(paymentService.providerPaymentExists).mockResolvedValue(true);

    const bodyWithPayment = {
      ...validBody,
      paymentMethod: "card",
      stripePaymentIntentId: "pi_duplicate",
    };

    const request = createRequest(bodyWithPayment);
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.success).toBe(false);
    expect(json.error).toEqual({ code: "PAYMENT_ALREADY_PROCESSED" });
    expect(orderService.createMerchantOrderAtomic).not.toHaveBeenCalled();
  });

  it("should proceed normally when PaymentIntent has not been used", async () => {
    vi.mocked(orderService.calculateOrderTotals).mockResolvedValue({
      subtotal: 20,
      taxAmount: 0,
      taxBreakdown: [],
      feesAmount: 0,
      feesBreakdown: [],
      tipAmount: 0,
      deliveryFee: 0,
      discount: 0,
      totalAmount: 20,
    } as never);

    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
      stripeAccountId: "acct_test123",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      scope: "read_write",
    } as never);

    vi.mocked(paymentService.verifyPayment).mockResolvedValue({
      success: true,
      paymentIntentId: "pi_new",
      status: "succeeded",
      amount: 2000,
      cardBrand: "visa",
      cardLast4: "4242",
    } as never);

    // PaymentIntent not yet used
    vi.mocked(paymentService.providerPaymentExists).mockResolvedValue(false);

    const bodyWithPayment = {
      ...validBody,
      paymentMethod: "card",
      stripePaymentIntentId: "pi_new",
    };

    const request = createRequest(bodyWithPayment);
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledTimes(1);
  });

  it("should return AppError status and code when createMerchantOrderAtomic throws AppError", async () => {
    vi.mocked(orderService.createMerchantOrderAtomic).mockRejectedValue(
      new AppError(ErrorCodes.PAYMENT_ALREADY_PROCESSED, undefined, 409)
    );

    const request = createRequest(validBody);
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.success).toBe(false);
    expect(json.error).toEqual({ code: "PAYMENT_ALREADY_PROCESSED" });
  });

  it("should return 404 when merchant not found", async () => {
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(null as never);

    const request = createRequest(validBody);
    const response = await POST(request, { params: Promise.resolve({ slug: "unknown" }) });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Restaurant not found");
  });

  it("should return 400 for validation failure", async () => {
    vi.mocked(checkoutFormSchema.safeParse).mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          fieldErrors: { customerFirstName: ["First name is required"] },
          formErrors: [],
        }),
      },
    } as never);

    const request = createRequest(validBody);
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
  });

  it("should return 400 for empty cart", async () => {
    const request = createRequest({ ...validBody, items: [] });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Cart is empty");
  });

  it("should return 400 when gift card not found", async () => {
    vi.mocked(giftCardService.getGiftCard).mockResolvedValue(null as never);

    const request = createRequest({
      ...validBody,
      giftCardPayment: { giftCardId: "gc-missing", amount: 10 },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Gift card not found");
  });

  it("should return 400 when gift card has no balance", async () => {
    vi.mocked(giftCardService.getGiftCard).mockResolvedValue({
      id: "gc-1",
      currentBalance: 0,
      cardNumber: "1234",
      initialAmount: 50,
      createdAt: new Date(),
    } as never);

    const request = createRequest({
      ...validBody,
      giftCardPayment: { giftCardId: "gc-1", amount: 10 },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Gift card has no balance");
  });

  it("should return 400 when gift card has insufficient balance", async () => {
    vi.mocked(giftCardService.getGiftCard).mockResolvedValue({
      id: "gc-1",
      currentBalance: 5,
      cardNumber: "1234",
      initialAmount: 50,
      createdAt: new Date(),
    } as never);

    const request = createRequest({
      ...validBody,
      giftCardPayment: { giftCardId: "gc-1", amount: 10 },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Insufficient gift card balance");
  });

  it("should return 400 when payment provider not configured", async () => {
    vi.mocked(orderService.calculateOrderTotals).mockResolvedValue({
      subtotal: 20, taxAmount: 0, taxBreakdown: [], feesAmount: 0, feesBreakdown: [],
      tipAmount: 0, deliveryFee: 0, discount: 0, totalAmount: 20,
    } as never);
    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue(null as never);

    const request = createRequest({
      ...validBody,
      paymentMethod: "card",
      stripePaymentIntentId: "pi_test",
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Payment provider not configured");
  });

  it("should return 400 when payment verification fails", async () => {
    vi.mocked(orderService.calculateOrderTotals).mockResolvedValue({
      subtotal: 20, taxAmount: 0, taxBreakdown: [], feesAmount: 0, feesBreakdown: [],
      tipAmount: 0, deliveryFee: 0, discount: 0, totalAmount: 20,
    } as never);
    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
      stripeAccountId: "acct_test",
    } as never);
    vi.mocked(paymentService.verifyPayment).mockResolvedValue({
      success: false, error: "Payment failed",
    } as never);

    const request = createRequest({
      ...validBody,
      paymentMethod: "card",
      stripePaymentIntentId: "pi_fail",
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Payment failed");
  });

  it("should NOT award loyalty points directly (delegated to event handler)", async () => {
    const { pointsService } = await import("@/services/loyalty");

    const bodyWithLoyalty = {
      ...validBody,
      loyaltyMemberId: "member-1",
    };

    const request = createRequest(bodyWithLoyalty);
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    // Order succeeds
    expect(response.status).toBe(201);
    expect(json.success).toBe(true);

    // Points are NOT awarded directly — event handler handles this
    expect(pointsService.awardPointsWithCustomAmount).not.toHaveBeenCalled();
  });

  it("should return 400 when payment verification fails with default error", async () => {
    vi.mocked(orderService.calculateOrderTotals).mockResolvedValue({
      subtotal: 20, taxAmount: 0, taxBreakdown: [], feesAmount: 0, feesBreakdown: [],
      tipAmount: 0, deliveryFee: 0, discount: 0, totalAmount: 20,
    } as never);
    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
      stripeAccountId: "acct_test",
    } as never);
    vi.mocked(paymentService.verifyPayment).mockResolvedValue({
      success: false,
    } as never);

    const request = createRequest({
      ...validBody,
      paymentMethod: "card",
      stripePaymentIntentId: "pi_fail_no_msg",
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Payment verification failed");
  });

  it("should return 400 for missing items field", async () => {
    const request = createRequest({ ...validBody, items: undefined as never });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Cart is empty");
  });

  it("should skip card verification when expectedCardPayment is 0 (gift card covers full amount)", async () => {
    vi.mocked(orderService.calculateOrderTotals).mockResolvedValue({
      subtotal: 20, taxAmount: 0, taxBreakdown: [], feesAmount: 0, feesBreakdown: [],
      tipAmount: 0, deliveryFee: 0, discount: 0, totalAmount: 20,
    } as never);

    vi.mocked(giftCardService.getGiftCard).mockResolvedValue({
      id: "gc-full",
      currentBalance: 50,
      cardNumber: "1234",
      initialAmount: 50,
      createdAt: new Date(),
    } as never);

    const request = createRequest({
      ...validBody,
      paymentMethod: "card",
      stripePaymentIntentId: "pi_should_skip",
      giftCardPayment: { giftCardId: "gc-full", amount: 20 },
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    // verifyPayment should not have been called since gift card covered everything
    expect(paymentService.verifyPayment).not.toHaveBeenCalled();
  });

  it("should set paymentType to 'online' when paymentMethod is 'card'", async () => {
    const bodyWithCard = {
      ...validBody,
      paymentMethod: "card",
    };

    const request = createRequest(bodyWithCard);
    await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });

    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        paymentType: "online",
      }),
      expect.any(Object)
    );
  });

  it("should set paymentType to 'in_store' when paymentMethod is 'cash'", async () => {
    const bodyWithCash = {
      ...validBody,
      paymentMethod: "cash",
    };

    const request = createRequest(bodyWithCash);
    await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });

    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        paymentType: "in_store",
      }),
      expect.any(Object)
    );
  });

  it("should default paymentType to 'online' when paymentMethod is not provided", async () => {
    const request = createRequest(validBody);
    await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });

    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        paymentType: "online",
      }),
      expect.any(Object)
    );
  });

  it("should use merchant currency for payment record, defaulting to USD when null", async () => {
    const merchantNoCurrency = {
      ...mockMerchant,
      currency: null,
    };
    vi.mocked(merchantService.getMerchantBySlug).mockResolvedValue(merchantNoCurrency as never);

    vi.mocked(orderService.calculateOrderTotals).mockResolvedValue({
      subtotal: 20, taxAmount: 0, taxBreakdown: [], feesAmount: 0, feesBreakdown: [],
      tipAmount: 0, deliveryFee: 0, discount: 0, totalAmount: 20,
    } as never);
    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
      stripeAccountId: "acct_test",
    } as never);
    vi.mocked(paymentService.verifyPayment).mockResolvedValue({
      success: true,
      paymentIntentId: "pi_cur",
      status: "succeeded",
      amount: 2000,
    } as never);
    vi.mocked(paymentService.providerPaymentExists).mockResolvedValue(false);

    const request = createRequest({
      ...validBody,
      paymentMethod: "card",
      stripePaymentIntentId: "pi_cur",
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });

    expect(response.status).toBe(201);
    expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledWith(
      "tenant-1",
      expect.any(Object),
      expect.objectContaining({
        payment: expect.objectContaining({
          provider: "stripe",
          currency: "USD",
        }),
      })
    );
  });
});
