import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { PaymentService } from "../payment.service";
import { paymentRepository } from "@/repositories/payment.repository";

const { mockCreatePaymentIntent, mockRetrievePaymentIntent, mockGetConnectAccount } = vi.hoisted(() => ({
  mockCreatePaymentIntent: vi.fn(),
  mockRetrievePaymentIntent: vi.fn(),
  mockGetConnectAccount: vi.fn(),
}));

vi.mock("@/services/stripe-connect", () => {
  class MockStripeConnectStandardProvider {
    createPaymentIntent = mockCreatePaymentIntent;
    retrievePaymentIntent = mockRetrievePaymentIntent;
  }
  return {
    stripeConnectService: {
      getConnectAccount: mockGetConnectAccount,
    },
    StripeConnectStandardProvider: MockStripeConnectStandardProvider,
  };
});

vi.mock("@/repositories/payment.repository", () => ({
  paymentRepository: {
    create: vi.fn(),
    getById: vi.fn(),
    getByPaymentIntentId: vi.fn(),
    getByOrderId: vi.fn(),
    getSuccessfulPaymentByOrderId: vi.fn(),
    updateStatus: vi.fn(),
    updateByPaymentIntentId: vi.fn(),
    atomicUpdateStatus: vi.fn(),
  },
}));

describe("PaymentService", () => {
  let service: PaymentService;

  const mockTenantId = "tenant-1";
  const mockCompanyId = "company-1";
  const mockMerchantId = "merchant-1";
  const mockOrderId = "order-1";
  const mockStripeAccountId = "acct_test123";

  const mockConnectAccount = {
    id: "ca-1",
    tenantId: mockTenantId,
    stripeAccountId: mockStripeAccountId,
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    accessToken: "tok_xxx" as string | null,
    refreshToken: "ref_xxx" as string | null,
    scope: "read_write" as string | null,
    connectedAt: null as Date | null,
    disconnectedAt: null as Date | null,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService();
  });

  describe("createPaymentIntent", () => {
    it("should create a PaymentIntent via provider using connect account", async () => {
      mockGetConnectAccount.mockResolvedValue(
        mockConnectAccount
      );
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: "pi_test123",
        clientSecret: "pi_test123_secret_abc",
        stripeAccountId: mockStripeAccountId,
      });

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
        stripeAccountId: mockStripeAccountId,
      });

      expect(mockGetConnectAccount).toHaveBeenCalledWith(
        mockTenantId
      );
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith({
        amount: 25.99,
        currency: "USD",
        stripeAccountId: mockStripeAccountId,
        metadata: {
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          merchantId: mockMerchantId,
        },
      });
    });

    it("should use default currency USD when not specified", async () => {
      mockGetConnectAccount.mockResolvedValue(
        mockConnectAccount
      );
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: "pi_test123",
        clientSecret: "pi_test123_secret_abc",
        stripeAccountId: mockStripeAccountId,
      });

      await service.createPaymentIntent({
        tenantId: mockTenantId,
        companyId: mockCompanyId,
        amount: 10.0,
      });

      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ currency: "USD" })
      );
    });

    it("should throw STRIPE_CONNECT_CHARGES_NOT_ENABLED when connect account not found", async () => {
      mockGetConnectAccount.mockResolvedValue(null);

      await expect(
        service.createPaymentIntent({
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          amount: 25.99,
        })
      ).rejects.toThrow();
    });

    it("should throw STRIPE_CONNECT_CHARGES_NOT_ENABLED when charges not enabled", async () => {
      mockGetConnectAccount.mockResolvedValue({
        ...mockConnectAccount,
        chargesEnabled: false,
      });

      await expect(
        service.createPaymentIntent({
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          amount: 25.99,
        })
      ).rejects.toThrow();
    });

    it("should not include undefined fields in metadata", async () => {
      mockGetConnectAccount.mockResolvedValue(
        mockConnectAccount
      );
      mockCreatePaymentIntent.mockResolvedValue({
        paymentIntentId: "pi_test123",
        clientSecret: "pi_test123_secret_abc",
        stripeAccountId: mockStripeAccountId,
      });

      await service.createPaymentIntent({
        tenantId: mockTenantId,
        companyId: mockCompanyId,
        amount: 10.0,
      });

      const callArg = mockCreatePaymentIntent.mock.calls[0][0];
      expect(callArg.metadata).not.toHaveProperty("merchantId");
      expect(callArg.metadata).not.toHaveProperty("orderId");
    });
  });

  describe("verifyPayment", () => {
    it("should return success for succeeded payment with correct amount", async () => {
      mockRetrievePaymentIntent.mockResolvedValue({
        id: "pi_test123",
        status: "succeeded",
        amount: 2599, // $25.99 in cents
        currency: "usd",
        cardBrand: "visa",
        cardLast4: "4242",
      });

      const result = await service.verifyPayment(
        "pi_test123",
        25.99,
        mockStripeAccountId
      );

      expect(result).toEqual({
        success: true,
        paymentIntentId: "pi_test123",
        status: "succeeded",
        amount: 2599,
        cardBrand: "visa",
        cardLast4: "4242",
      });

      expect(mockRetrievePaymentIntent).toHaveBeenCalledWith(
        "pi_test123",
        mockStripeAccountId
      );
    });

    it("should return failure for payment not found", async () => {
      mockRetrievePaymentIntent.mockResolvedValue(null);

      const result = await service.verifyPayment(
        "pi_notfound",
        25.99,
        mockStripeAccountId
      );

      expect(result).toEqual({
        success: false,
        paymentIntentId: "pi_notfound",
        status: "not_found",
        amount: 0,
        error: "Payment not found",
      });
    });

    it("should return failure for non-succeeded payment", async () => {
      mockRetrievePaymentIntent.mockResolvedValue({
        id: "pi_test123",
        status: "requires_payment_method",
        amount: 2599,
        currency: "usd",
      });

      const result = await service.verifyPayment(
        "pi_test123",
        25.99,
        mockStripeAccountId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("requires_payment_method");
    });

    it("should return failure for amount mismatch", async () => {
      mockRetrievePaymentIntent.mockResolvedValue({
        id: "pi_test123",
        status: "succeeded",
        amount: 1000, // $10.00
        currency: "usd",
      });

      const result = await service.verifyPayment(
        "pi_test123",
        25.99,
        mockStripeAccountId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("amount mismatch");
    });
  });

  describe("handlePaymentSucceeded", () => {
    it("should update payment status to succeeded via atomic CAS", async () => {
      vi.mocked(paymentRepository.atomicUpdateStatus).mockResolvedValue(1);

      await service.handlePaymentSucceeded({
        paymentIntentId: "pi_test123",
        status: "succeeded",
        paymentMethodType: "card",
        cardBrand: "visa",
        cardLast4: "4242",
      });

      expect(paymentRepository.atomicUpdateStatus).toHaveBeenCalledWith(
        "pi_test123",
        "pending",
        expect.objectContaining({
          status: "succeeded",
          paymentMethod: "card",
          cardBrand: "visa",
          cardLast4: "4242",
        })
      );
    });

    it("should skip if payment already processed or not found (atomic CAS returns 0)", async () => {
      vi.mocked(paymentRepository.atomicUpdateStatus).mockResolvedValue(0);

      await expect(
        service.handlePaymentSucceeded({
          paymentIntentId: "pi_test123",
          status: "succeeded",
        })
      ).resolves.not.toThrow();

      expect(paymentRepository.atomicUpdateStatus).toHaveBeenCalledWith(
        "pi_test123",
        "pending",
        expect.objectContaining({ status: "succeeded" })
      );
    });
  });

  describe("handlePaymentFailed", () => {
    it("should update payment status to failed with error info via atomic CAS", async () => {
      vi.mocked(paymentRepository.atomicUpdateStatus).mockResolvedValue(1);

      await service.handlePaymentFailed({
        paymentIntentId: "pi_test123",
        failureCode: "card_declined",
        failureMessage: "Your card was declined.",
      });

      expect(paymentRepository.atomicUpdateStatus).toHaveBeenCalledWith(
        "pi_test123",
        "pending",
        expect.objectContaining({
          status: "failed",
          failureCode: "card_declined",
          failureMessage: "Your card was declined.",
        })
      );
    });

    it("should skip if payment already processed or not found (atomic CAS returns 0)", async () => {
      vi.mocked(paymentRepository.atomicUpdateStatus).mockResolvedValue(0);

      await expect(
        service.handlePaymentFailed({
          paymentIntentId: "pi_test123",
          failureCode: "card_declined",
          failureMessage: "Your card was declined.",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("createPaymentRecord", () => {
    it("should create a payment record with stripeAccountId", async () => {
      const mockCreatedPayment = {
        id: "payment-new",
        tenantId: mockTenantId,
        orderId: mockOrderId,
        stripePaymentIntentId: "pi_test123",
        stripeCustomerId: null,
        stripeAccountId: mockStripeAccountId,
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
        stripeAccountId: mockStripeAccountId,
        amount: 25.99,
        currency: "USD",
      });

      expect(result).toEqual(mockCreatedPayment);
      expect(paymentRepository.create).toHaveBeenCalledWith(
        mockTenantId,
        {
          orderId: mockOrderId,
          stripePaymentIntentId: "pi_test123",
          stripeAccountId: mockStripeAccountId,
          stripeCustomerId: undefined,
          amount: 25.99,
          currency: "USD",
        },
        undefined
      );
    });
  });
});
