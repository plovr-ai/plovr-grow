import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock services
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getCompanyBySlug: vi.fn(),
  },
}));

vi.mock("@/services/order", () => ({
  orderService: {
    createCompanyOrder: vi.fn(),
  },
}));

vi.mock("@/services/giftcard", () => ({
  giftCardService: {
    createGiftCard: vi.fn(),
  },
}));

vi.mock("@/services/payment", () => ({
  paymentService: {
    verifyPayment: vi.fn(),
    createPaymentRecord: vi.fn(),
  },
}));

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    getConnectAccount: vi.fn(),
  },
}));

import { merchantService } from "@/services/merchant";
import { orderService } from "@/services/order";
import { giftCardService } from "@/services/giftcard";
import { paymentService } from "@/services/payment";
import { stripeConnectService } from "@/services/stripe-connect";

describe("POST /api/storefront/[companySlug]/giftcard", () => {
  const mockCompany = {
    id: "tenant-1",
    tenantId: "tenant-1",
    name: "Test Company",
    slug: "test-company",
  };

  const mockOrder = {
    id: "order-1",
    orderNumber: "GC-001",
  };

  const mockGiftCard = {
    id: "gc-1",
    cardNumber: "1234-5678-9012-3456",
    initialAmount: 50,
    currentBalance: 50,
  };

  const validFormData = {
    amount: 50,
    buyerFirstName: "John",
    buyerLastName: "Doe",
    buyerPhone: "(555) 123-4567",
    buyerEmail: "john@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without payment (backward compatibility)", () => {
    it("should create giftcard order successfully without payment", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(orderService.createCompanyOrder).mockResolvedValue(mockOrder as never);
      vi.mocked(giftCardService.createGiftCard).mockResolvedValue(
        mockGiftCard as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify(validFormData),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.orderId).toBe("order-1");
      expect(data.data.orderNumber).toBe("GC-001");
      expect(data.data.cardNumber).toBe("1234-5678-9012-3456");

      // Should NOT call payment verification or record creation
      expect(paymentService.verifyPayment).not.toHaveBeenCalled();
      expect(paymentService.createPaymentRecord).not.toHaveBeenCalled();
    });
  });

  describe("with Stripe payment", () => {
    it("should create giftcard order with verified payment", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
        stripeAccountId: "acct_test123",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        scope: "read_write",
      } as never);
      vi.mocked(paymentService.verifyPayment).mockResolvedValue({
        success: true,
        paymentIntentId: "pi_test123",
        status: "succeeded",
        amount: 5000,
        cardBrand: "visa",
        cardLast4: "4242",
      });
      vi.mocked(orderService.createCompanyOrder).mockResolvedValue(mockOrder as never);
      vi.mocked(paymentService.createPaymentRecord).mockResolvedValue(
        undefined as never
      );
      vi.mocked(giftCardService.createGiftCard).mockResolvedValue(
        mockGiftCard as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            stripePaymentIntentId: "pi_test123",
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      // Should verify payment with stripeAccountId
      expect(paymentService.verifyPayment).toHaveBeenCalledWith(
        "pi_test123",
        50,
        "acct_test123"
      );

      // Should create payment record
      expect(paymentService.createPaymentRecord).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        orderId: "order-1",
        stripePaymentIntentId: "pi_test123",
        amount: 50,
        currency: "USD",
      });
    });

    it("should return 400 when payment provider not configured", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            stripePaymentIntentId: "pi_test123",
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Payment provider not configured");
    });

    it("should return 400 when payment verification fails", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
        stripeAccountId: "acct_test123",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        scope: "read_write",
      } as never);
      vi.mocked(paymentService.verifyPayment).mockResolvedValue({
        success: false,
        paymentIntentId: "pi_test123",
        status: "requires_payment_method",
        amount: 5000,
        error: "Payment not completed",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            stripePaymentIntentId: "pi_test123",
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Payment not completed");

      // Should NOT create order or giftcard
      expect(orderService.createCompanyOrder).not.toHaveBeenCalled();
      expect(giftCardService.createGiftCard).not.toHaveBeenCalled();
    });

    it("should return 400 when payment amount mismatch", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
        stripeAccountId: "acct_test123",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        scope: "read_write",
      } as never);
      vi.mocked(paymentService.verifyPayment).mockResolvedValue({
        success: false,
        paymentIntentId: "pi_test123",
        status: "succeeded",
        amount: 2500, // Different amount
        error: "Payment amount mismatch",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            stripePaymentIntentId: "pi_test123",
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Payment amount mismatch");
    });
  });

  describe("validation", () => {
    it("should return 404 when company not found", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/non-existent/giftcard",
        {
          method: "POST",
          body: JSON.stringify(validFormData),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "non-existent" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Company not found");
    });

    it("should return 400 for missing required fields", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            amount: 50,
            // Missing buyer info
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
    });

    it("should return 400 for invalid phone format", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            buyerPhone: "1234567890", // Invalid format
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
    });

    it("should return 400 for invalid email", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            buyerEmail: "invalid-email",
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
    });

    it("should return 400 for negative amount", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            amount: -50,
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("optional fields", () => {
    it("should create giftcard with recipient info", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(orderService.createCompanyOrder).mockResolvedValue(mockOrder as never);
      vi.mocked(giftCardService.createGiftCard).mockResolvedValue(
        mockGiftCard as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            recipientName: "Jane Doe",
            recipientEmail: "jane@example.com",
            message: "Happy Birthday!",
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);

      // Verify order was created with message as notes
      expect(orderService.createCompanyOrder).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({
          notes: "Happy Birthday!",
        })
      );
    });

    it("should return 400 for invalid recipient email format", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            recipientEmail: "invalid-email",
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should allow empty recipient email", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(orderService.createCompanyOrder).mockResolvedValue(mockOrder as never);
      vi.mocked(giftCardService.createGiftCard).mockResolvedValue(
        mockGiftCard as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            recipientEmail: "",
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it("should return 400 for message exceeding 200 characters", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify({
            ...validFormData,
            message: "A".repeat(201),
          }),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("order creation", () => {
    it("should create order with correct structure", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(orderService.createCompanyOrder).mockResolvedValue(mockOrder as never);
      vi.mocked(giftCardService.createGiftCard).mockResolvedValue(
        mockGiftCard as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify(validFormData),
        }
      );

      await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });

      expect(orderService.createCompanyOrder).toHaveBeenCalledWith("tenant-1", {
        companyId: "tenant-1",
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "(555) 123-4567",
        customerEmail: "john@example.com",
        items: [
          {
            menuItemId: "giftcard-50",
            name: "$50 Gift Card",
            price: 50,
            quantity: 1,
            totalPrice: 50,
            selectedModifiers: [],
            taxes: [],
          },
        ],
        notes: undefined,
      });
    });

    it("should create giftcard with correct structure", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(orderService.createCompanyOrder).mockResolvedValue(mockOrder as never);
      vi.mocked(giftCardService.createGiftCard).mockResolvedValue(
        mockGiftCard as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify(validFormData),
        }
      );

      await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });

      expect(giftCardService.createGiftCard).toHaveBeenCalledWith(
        "tenant-1",
        "tenant-1",
        {
          purchaseOrderId: "order-1",
          amount: 50,
        }
      );
    });
  });

  describe("error handling", () => {
    it("should return 500 when orderService throws error", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(orderService.createCompanyOrder).mockRejectedValue(
        new Error("Database error")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify(validFormData),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Database error");
    });

    it("should return 500 when giftCardService throws error", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(orderService.createCompanyOrder).mockResolvedValue(mockOrder as never);
      vi.mocked(giftCardService.createGiftCard).mockRejectedValue(
        new Error("Card generation failed")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify(validFormData),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Card generation failed");
    });

    it("should handle non-Error exceptions", async () => {
      vi.mocked(merchantService.getCompanyBySlug).mockResolvedValue(
        mockCompany as never
      );
      vi.mocked(orderService.createCompanyOrder).mockRejectedValue("Unknown error");

      const request = new NextRequest(
        "http://localhost:3000/api/storefront/test-company/giftcard",
        {
          method: "POST",
          body: JSON.stringify(validFormData),
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ companySlug: "test-company" }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Failed to create order");
    });
  });
});
