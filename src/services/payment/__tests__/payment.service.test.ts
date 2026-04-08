import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { PaymentService } from "../payment.service";
import { stripeService } from "@/services/stripe";
import { paymentRepository } from "@/repositories/payment.repository";
import { stripeCustomerRepository } from "@/repositories/stripe-customer.repository";
import { loyaltyMemberRepository } from "@/repositories/loyalty-member.repository";

// Mock dependencies
vi.mock("@/services/stripe", () => ({
  stripeService: {
    createPaymentIntent: vi.fn(),
    retrievePaymentIntent: vi.fn(),
    createCustomer: vi.fn(),
    listPaymentMethods: vi.fn(),
    detachPaymentMethod: vi.fn(),
  },
}));

vi.mock("@/repositories/payment.repository", () => ({
  paymentRepository: {
    create: vi.fn(),
    getById: vi.fn(),
    getByPaymentIntentId: vi.fn(),
    getByOrderId: vi.fn(),
    getSuccessfulPaymentByOrderId: vi.fn(),
    updateStatus: vi.fn(),
    updateByPaymentIntentId: vi.fn(),
  },
}));

vi.mock("@/repositories/stripe-customer.repository", () => ({
  stripeCustomerRepository: {
    create: vi.fn(),
    getByLoyaltyMemberId: vi.fn(),
    getByStripeCustomerId: vi.fn(),
  },
}));

vi.mock("@/repositories/loyalty-member.repository", () => ({
  loyaltyMemberRepository: {
    getById: vi.fn(),
  },
}));

describe("PaymentService", () => {
  let service: PaymentService;

  const mockTenantId = "tenant-1";
  const mockCompanyId = "company-1";
  const mockMerchantId = "merchant-1";
  const mockOrderId = "order-1";
  const mockLoyaltyMemberId = "member-1";

  const mockLoyaltyMember = {
    id: mockLoyaltyMemberId,
    tenantId: mockTenantId,
    companyId: mockCompanyId,
    phone: "+12025551234",
    email: "test@example.com",
    firstName: "John",
    lastName: "Doe",
    points: 100,
    totalOrders: 5,
    totalSpent: new Decimal(150),
    lastOrderAt: null,
    enrolledAt: new Date(),
    status: "active",
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStripeCustomer = {
    id: "sc-1",
    tenantId: mockTenantId,
    companyId: mockCompanyId,
    loyaltyMemberId: mockLoyaltyMemberId,
    stripeCustomerId: "cus_123abc",
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentIntentResult = {
    id: "pi_test123",
    clientSecret: "pi_test123_secret_abc",
    status: "requires_payment_method",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService();
  });

  describe("createPaymentIntent", () => {
    it("should create a PaymentIntent without customer", async () => {
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(
        mockPaymentIntentResult
      );

      const result = await service.createPaymentIntent({
        tenantId: mockTenantId,
        companyId: mockCompanyId,
        merchantId: mockMerchantId,
        amount: 25.99,
        currency: "USD",
      });

      expect(result).toEqual({
        paymentIntentId: "pi_test123",
        clientSecret: "pi_test123_secret_abc",
        stripeCustomerId: undefined,
      });

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        amount: 25.99,
        currency: "USD",
        customerId: undefined,
        saveCard: undefined,
        metadata: {
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          merchantId: mockMerchantId,
        },
      });
    });

    it("should create a PaymentIntent with existing Stripe customer", async () => {
      vi.mocked(stripeCustomerRepository.getByLoyaltyMemberId).mockResolvedValue(
        mockStripeCustomer
      );
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(
        mockPaymentIntentResult
      );

      const result = await service.createPaymentIntent({
        tenantId: mockTenantId,
        companyId: mockCompanyId,
        amount: 50.0,
        currency: "USD",
        loyaltyMemberId: mockLoyaltyMemberId,
        saveCard: true,
      });

      expect(result.stripeCustomerId).toBe("cus_123abc");
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: "cus_123abc",
          saveCard: true,
        })
      );
    });

    it("should create a new Stripe customer for loyalty member", async () => {
      vi.mocked(stripeCustomerRepository.getByLoyaltyMemberId).mockResolvedValue(
        null
      );
      vi.mocked(loyaltyMemberRepository.getById).mockResolvedValue(
        mockLoyaltyMember
      );
      vi.mocked(stripeService.createCustomer).mockResolvedValue("cus_new456");
      vi.mocked(stripeCustomerRepository.create).mockResolvedValue({
        id: "sc-new",
        tenantId: mockTenantId,
        companyId: mockCompanyId,
        loyaltyMemberId: mockLoyaltyMemberId,
        stripeCustomerId: "cus_new456",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(
        mockPaymentIntentResult
      );

      const result = await service.createPaymentIntent({
        tenantId: mockTenantId,
        companyId: mockCompanyId,
        amount: 75.0,
        currency: "USD",
        loyaltyMemberId: mockLoyaltyMemberId,
      });

      expect(stripeService.createCustomer).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "John Doe",
        metadata: expect.objectContaining({
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          loyaltyMemberId: mockLoyaltyMemberId,
        }),
      });
      expect(stripeCustomerRepository.create).toHaveBeenCalled();
      expect(result.stripeCustomerId).toBe("cus_new456");
    });
  });

  describe("verifyPayment", () => {
    it("should return success for succeeded payment with correct amount", async () => {
      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue({
        id: "pi_test123",
        status: "succeeded",
        amount: 2599, // $25.99 in cents
        currency: "usd",
        cardBrand: "visa",
        cardLast4: "4242",
      });

      const result = await service.verifyPayment("pi_test123", 25.99);

      expect(result).toEqual({
        success: true,
        paymentIntentId: "pi_test123",
        status: "succeeded",
        amount: 2599,
        cardBrand: "visa",
        cardLast4: "4242",
      });
    });

    it("should return failure for payment not found", async () => {
      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(null);

      const result = await service.verifyPayment("pi_notfound", 25.99);

      expect(result).toEqual({
        success: false,
        paymentIntentId: "pi_notfound",
        status: "not_found",
        amount: 0,
        error: "Payment not found",
      });
    });

    it("should return failure for non-succeeded payment", async () => {
      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue({
        id: "pi_test123",
        status: "requires_payment_method",
        amount: 2599,
        currency: "usd",
      });

      const result = await service.verifyPayment("pi_test123", 25.99);

      expect(result.success).toBe(false);
      expect(result.error).toContain("requires_payment_method");
    });

    it("should return failure for amount mismatch", async () => {
      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue({
        id: "pi_test123",
        status: "succeeded",
        amount: 1000, // $10.00
        currency: "usd",
      });

      const result = await service.verifyPayment("pi_test123", 25.99);

      expect(result.success).toBe(false);
      expect(result.error).toContain("amount mismatch");
    });
  });

  describe("handlePaymentSucceeded", () => {
    const mockPayment = {
      id: "payment-1",
      tenantId: mockTenantId,
      orderId: mockOrderId,
      stripePaymentIntentId: "pi_test123",
      stripeCustomerId: null,
      amount: new Decimal(25.99),
      currency: "USD",
      status: "pending",
      paymentMethod: null,
      cardBrand: null,
      cardLast4: null,
      failureCode: null,
      failureMessage: null,
      paidAt: null,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should update payment status to succeeded", async () => {
      vi.mocked(paymentRepository.getByPaymentIntentId).mockResolvedValue({
        ...mockPayment,
        order: {
          id: mockOrderId,
          orderNumber: "ORD-001",
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          merchantId: mockMerchantId as string | null,
        },
      } as unknown as Awaited<ReturnType<typeof paymentRepository.getByPaymentIntentId>> & {});
      vi.mocked(paymentRepository.updateStatus).mockResolvedValue({
        ...mockPayment,
        status: "succeeded",
      } as unknown as Awaited<ReturnType<typeof paymentRepository.updateStatus>>);

      await service.handlePaymentSucceeded({
        paymentIntentId: "pi_test123",
        status: "succeeded",
        paymentMethodType: "card",
        cardBrand: "visa",
        cardLast4: "4242",
      });

      expect(paymentRepository.updateStatus).toHaveBeenCalledWith(
        "payment-1",
        expect.objectContaining({
          status: "succeeded",
          paymentMethod: "card",
          cardBrand: "visa",
          cardLast4: "4242",
        })
      );
    });

    it("should skip if payment already succeeded (idempotency)", async () => {
      vi.mocked(paymentRepository.getByPaymentIntentId).mockResolvedValue({
        ...mockPayment,
        status: "succeeded",
        order: {
          id: mockOrderId,
          orderNumber: "ORD-001",
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          merchantId: mockMerchantId as string | null,
        },
      } as unknown as Awaited<ReturnType<typeof paymentRepository.getByPaymentIntentId>> & {});

      await service.handlePaymentSucceeded({
        paymentIntentId: "pi_test123",
        status: "succeeded",
      });

      expect(paymentRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("should handle payment not found gracefully", async () => {
      vi.mocked(paymentRepository.getByPaymentIntentId).mockResolvedValue(null);

      // Should not throw
      await expect(
        service.handlePaymentSucceeded({
          paymentIntentId: "pi_notfound",
          status: "succeeded",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("handlePaymentFailed", () => {
    const mockPaymentFailed = {
      id: "payment-1",
      tenantId: mockTenantId,
      orderId: mockOrderId,
      stripePaymentIntentId: "pi_test123",
      stripeCustomerId: null,
      amount: new Decimal(25.99),
      currency: "USD",
      status: "pending",
      paymentMethod: null,
      cardBrand: null,
      cardLast4: null,
      failureCode: null,
      failureMessage: null,
      paidAt: null,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should update payment status to failed with error info", async () => {
      vi.mocked(paymentRepository.getByPaymentIntentId).mockResolvedValue({
        ...mockPaymentFailed,
        order: {
          id: mockOrderId,
          orderNumber: "ORD-001",
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          merchantId: mockMerchantId as string | null,
        },
      } as unknown as Awaited<ReturnType<typeof paymentRepository.getByPaymentIntentId>> & {});
      vi.mocked(paymentRepository.updateStatus).mockResolvedValue({
        ...mockPaymentFailed,
        status: "failed",
      } as unknown as Awaited<ReturnType<typeof paymentRepository.updateStatus>>);

      await service.handlePaymentFailed({
        paymentIntentId: "pi_test123",
        failureCode: "card_declined",
        failureMessage: "Your card was declined.",
      });

      expect(paymentRepository.updateStatus).toHaveBeenCalledWith(
        "payment-1",
        expect.objectContaining({
          status: "failed",
          failureCode: "card_declined",
          failureMessage: "Your card was declined.",
        })
      );
    });
  });

  describe("createPaymentRecord", () => {
    it("should create a payment record", async () => {
      const mockCreatedPayment = {
        id: "payment-new",
        tenantId: mockTenantId,
        orderId: mockOrderId,
        stripePaymentIntentId: "pi_test123",
        stripeCustomerId: null,
        amount: new Decimal(25.99),
        currency: "USD",
        status: "pending",
        paymentMethod: null,
        cardBrand: null,
        cardLast4: null,
        failureCode: null,
        failureMessage: null,
        paidAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(paymentRepository.create).mockResolvedValue(mockCreatedPayment);

      const result = await service.createPaymentRecord({
        tenantId: mockTenantId,
        orderId: mockOrderId,
        stripePaymentIntentId: "pi_test123",
        amount: 25.99,
        currency: "USD",
      });

      expect(result).toEqual(mockCreatedPayment);
      expect(paymentRepository.create).toHaveBeenCalledWith(mockTenantId, {
        orderId: mockOrderId,
        stripePaymentIntentId: "pi_test123",
        stripeCustomerId: undefined,
        amount: 25.99,
        currency: "USD",
      });
    });
  });

  describe("getSavedPaymentMethods", () => {
    it("should return empty array if no Stripe customer", async () => {
      vi.mocked(stripeCustomerRepository.getByLoyaltyMemberId).mockResolvedValue(
        null
      );

      const result = await service.getSavedPaymentMethods(mockLoyaltyMemberId);

      expect(result).toEqual([]);
      expect(stripeService.listPaymentMethods).not.toHaveBeenCalled();
    });

    it("should return payment methods for existing Stripe customer", async () => {
      const mockPaymentMethods = [
        { id: "pm_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2025 },
        { id: "pm_2", brand: "mastercard", last4: "5555", expMonth: 6, expYear: 2026 },
      ];

      vi.mocked(stripeCustomerRepository.getByLoyaltyMemberId).mockResolvedValue(
        mockStripeCustomer
      );
      vi.mocked(stripeService.listPaymentMethods).mockResolvedValue(
        mockPaymentMethods
      );

      const result = await service.getSavedPaymentMethods(mockLoyaltyMemberId);

      expect(result).toEqual(mockPaymentMethods);
      expect(stripeService.listPaymentMethods).toHaveBeenCalledWith("cus_123abc");
    });
  });

  describe("deleteSavedPaymentMethod", () => {
    it("should return false if no Stripe customer", async () => {
      vi.mocked(stripeCustomerRepository.getByLoyaltyMemberId).mockResolvedValue(
        null
      );

      const result = await service.deleteSavedPaymentMethod(
        mockLoyaltyMemberId,
        "pm_123"
      );

      expect(result).toBe(false);
    });

    it("should return false if payment method not found", async () => {
      vi.mocked(stripeCustomerRepository.getByLoyaltyMemberId).mockResolvedValue(
        mockStripeCustomer
      );
      vi.mocked(stripeService.listPaymentMethods).mockResolvedValue([
        { id: "pm_other", brand: "visa", last4: "4242", expMonth: 12, expYear: 2025 },
      ]);

      const result = await service.deleteSavedPaymentMethod(
        mockLoyaltyMemberId,
        "pm_notfound"
      );

      expect(result).toBe(false);
      expect(stripeService.detachPaymentMethod).not.toHaveBeenCalled();
    });

    it("should delete payment method successfully", async () => {
      vi.mocked(stripeCustomerRepository.getByLoyaltyMemberId).mockResolvedValue(
        mockStripeCustomer
      );
      vi.mocked(stripeService.listPaymentMethods).mockResolvedValue([
        { id: "pm_123", brand: "visa", last4: "4242", expMonth: 12, expYear: 2025 },
      ]);
      vi.mocked(stripeService.detachPaymentMethod).mockResolvedValue();

      const result = await service.deleteSavedPaymentMethod(
        mockLoyaltyMemberId,
        "pm_123"
      );

      expect(result).toBe(true);
      expect(stripeService.detachPaymentMethod).toHaveBeenCalledWith("pm_123");
    });
  });
});
