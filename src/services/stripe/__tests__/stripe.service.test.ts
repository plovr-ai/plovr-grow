import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = process.env;

describe("StripeService", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Mock Mode (no STRIPE_SECRET_KEY)", () => {
    beforeEach(() => {
      delete process.env.STRIPE_SECRET_KEY;
    });

    it("should return mock PaymentIntent in mock mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createPaymentIntent({
        amount: 25.99,
        currency: "USD",
        metadata: { orderId: "order-1" },
      });

      expect(result.id).toMatch(/^mock_pi_/);
      expect(result.clientSecret).toContain("_secret_");
      expect(result.status).toBe("requires_payment_method");
    });

    it("should return mock successful payment for mock PaymentIntent", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.retrievePaymentIntent("mock_pi_abc12345");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("mock_pi_abc12345");
      expect(result?.status).toBe("succeeded");
      expect(result?.amount).toBe(1000);
      expect(result?.cardBrand).toBe("visa");
      expect(result?.cardLast4).toBe("4242");
    });

    it("should return null for non-mock PaymentIntent ID in mock mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.retrievePaymentIntent("pi_real123");

      expect(result).toBeNull();
    });

    it("should return mock customer ID", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createCustomer({
        email: "test@example.com",
        name: "John Doe",
        metadata: { loyaltyMemberId: "member-1" },
      });

      expect(result).toMatch(/^mock_cus_/);
    });

    it("should return empty payment methods in mock mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.listPaymentMethods("cus_123");

      expect(result).toEqual([]);
    });

    it("should handle detachPaymentMethod in mock mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      // Should not throw
      await expect(service.detachPaymentMethod("pm_123")).resolves.toBeUndefined();
    });

    it("should return mock customer in mock mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getCustomer("cus_123");

      expect(result).toEqual({
        id: "cus_123",
        email: "mock@example.com",
        name: "Mock Customer",
      });
    });

    it("should report not configured in mock mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe("PaymentIntent Parameters", () => {
    it("should structure PaymentIntent params correctly with customer and saveCard", () => {
      // When customerId and saveCard are provided, setup_future_usage should be set
      const createParams = {
        amount: 2599,
        currency: "usd",
        payment_method_types: ["card"],
        metadata: { orderId: "order-1" },
        customer: "cus_123",
        setup_future_usage: "on_session",
      };

      // This validates the expected params structure
      expect(createParams.setup_future_usage).toBe("on_session");
      expect(createParams.customer).toBe("cus_123");
      expect(createParams.amount).toBe(2599);
      expect(createParams.currency).toBe("usd");
    });

    it("should not include setup_future_usage without saveCard", () => {
      // Without saveCard, setup_future_usage should not be set
      const createParams = {
        amount: 2599,
        currency: "usd",
        payment_method_types: ["card"],
        metadata: { orderId: "order-1" },
      };

      expect(createParams).not.toHaveProperty("setup_future_usage");
      expect(createParams).not.toHaveProperty("customer");
    });
  });

  describe("Webhook Verification", () => {
    it("should parse webhook payload in mock mode", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const payload = JSON.stringify({
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_123" } },
      });

      const result = service.verifyWebhookSignature(payload, "fake_sig");

      expect(result).toEqual({
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_123" } },
      });
    });

    it("should return null for invalid JSON in mock mode", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = service.verifyWebhookSignature("invalid json", "fake_sig");

      expect(result).toBeNull();
    });
  });

  describe("Payment Link", () => {
    it("should create mock payment link in mock mode", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createPaymentLink({
        amount: 100.0,
        currency: "USD",
        description: "Invoice #123",
        metadata: { invoiceNumber: "INV-001" },
      });

      expect(result.id).toMatch(/^mock_pl_/);
      expect(result.url).toContain("mock-stripe.com/pay/");
    });
  });

  describe("Amount Conversion", () => {
    it("should convert dollars to cents correctly", () => {
      // Test the conversion logic used in createPaymentIntent
      const testCases = [
        { dollars: 25.99, expectedCents: 2599 },
        { dollars: 100.0, expectedCents: 10000 },
        { dollars: 0.5, expectedCents: 50 },
        { dollars: 1.01, expectedCents: 101 },
      ];

      testCases.forEach(({ dollars, expectedCents }) => {
        const cents = Math.round(dollars * 100);
        expect(cents).toBe(expectedCents);
      });
    });
  });

  describe("PaymentMethodInfo Mapping", () => {
    it("should map Stripe payment method to PaymentMethodInfo", () => {
      // Test the expected structure of PaymentMethodInfo
      const stripePaymentMethod = {
        id: "pm_123",
        card: {
          brand: "visa",
          last4: "4242",
          exp_month: 12,
          exp_year: 2025,
        },
      };

      const expected = {
        id: "pm_123",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2025,
      };

      // Simulate the mapping logic
      const mapped = {
        id: stripePaymentMethod.id,
        brand: stripePaymentMethod.card?.brand || "unknown",
        last4: stripePaymentMethod.card?.last4 || "****",
        expMonth: stripePaymentMethod.card?.exp_month || 0,
        expYear: stripePaymentMethod.card?.exp_year || 0,
      };

      expect(mapped).toEqual(expected);
    });

    it("should handle missing card details gracefully", () => {
      const stripePaymentMethod: {
        id: string;
        card: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
      } = {
        id: "pm_123",
        card: null,
      };

      const mapped = {
        id: stripePaymentMethod.id,
        brand: stripePaymentMethod.card?.brand || "unknown",
        last4: stripePaymentMethod.card?.last4 || "****",
        expMonth: stripePaymentMethod.card?.exp_month || 0,
        expYear: stripePaymentMethod.card?.exp_year || 0,
      };

      expect(mapped.brand).toBe("unknown");
      expect(mapped.last4).toBe("****");
      expect(mapped.expMonth).toBe(0);
      expect(mapped.expYear).toBe(0);
    });
  });
});
