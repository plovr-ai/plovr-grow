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

vi.mock("@storefront/lib/validations/checkout", () => ({
  checkoutFormSchema: {
    safeParse: vi.fn(),
  },
}));

import { merchantService } from "@/services/merchant";
import { orderService } from "@/services/order";
import { giftCardService } from "@/services/giftcard";
import { paymentService } from "@/services/payment";
import { checkoutFormSchema } from "@storefront/lib/validations/checkout";

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
  company: {
    id: "company-1",
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
  cashPayment: 20,
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
        companyId: "company-1",
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
          stripePaymentIntentId: "pi_123",
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
    expect(json.error).toBe("Gift card has no balance");
  });

  it("should still succeed when loyalty points awarding fails (outside transaction)", async () => {
    const { loyaltyConfigService, pointsService } = await import("@/services/loyalty");

    vi.mocked(loyaltyConfigService.isLoyaltyEnabled).mockResolvedValue(true);
    vi.mocked(loyaltyConfigService.getPointsPerDollar).mockResolvedValue(1);
    vi.mocked(pointsService.awardPointsWithCustomAmount).mockRejectedValue(
      new Error("Points service unavailable")
    );

    vi.mocked(orderService.createMerchantOrderAtomic).mockResolvedValue({
      ...mockOrder,
      giftCardPayment: 0,
      cashPayment: 20,
    } as never);

    const bodyWithLoyalty = {
      ...validBody,
      loyaltyMemberId: "member-1",
    };

    const request = createRequest(bodyWithLoyalty);
    const response = await POST(request, { params: Promise.resolve({ slug: "test-merchant" }) });
    const json = await response.json();

    // Order should still succeed even though points failed
    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
  });
});
