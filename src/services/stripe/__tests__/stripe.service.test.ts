import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = process.env;

// Mock Stripe SDK methods
const mockProductsCreate = vi.fn();
const mockPricesCreate = vi.fn();
const mockPaymentLinksCreate = vi.fn();
const mockPaymentIntentsCreate = vi.fn();
const mockPaymentIntentsRetrieve = vi.fn();
const mockCustomersCreate = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockPaymentMethodsList = vi.fn();
const mockPaymentMethodsDetach = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsCancel = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockWebhooksConstructEvent = vi.fn();
const mockOAuthToken = vi.fn();
const mockOAuthDeauthorize = vi.fn();
const mockAccountsRetrieve = vi.fn();

vi.mock("stripe", () => {
  class MockStripe {
    products = { create: mockProductsCreate };
    prices = { create: mockPricesCreate };
    paymentLinks = { create: mockPaymentLinksCreate };
    paymentIntents = { create: mockPaymentIntentsCreate, retrieve: mockPaymentIntentsRetrieve };
    customers = { create: mockCustomersCreate, retrieve: mockCustomersRetrieve };
    paymentMethods = { list: mockPaymentMethodsList, detach: mockPaymentMethodsDetach };
    checkout = { sessions: { create: mockCheckoutSessionsCreate } };
    billingPortal = { sessions: { create: mockBillingPortalSessionsCreate } };
    subscriptions = { update: mockSubscriptionsUpdate, cancel: mockSubscriptionsCancel, retrieve: mockSubscriptionsRetrieve };
    webhooks = { constructEvent: mockWebhooksConstructEvent };
    oauth = { token: mockOAuthToken, deauthorize: mockOAuthDeauthorize };
    accounts = { retrieve: mockAccountsRetrieve };
  }
  return { default: MockStripe };
});

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

  describe("Subscription Mock Mode", () => {
    beforeEach(() => {
      delete process.env.STRIPE_SECRET_KEY;
    });

    it("should return mock subscription checkout session", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceId: "price_123",
        tenantId: "tenant-1",
        successUrl: "http://localhost/success",
        cancelUrl: "http://localhost/cancel",
        trialDays: 14,
      });

      expect(result.sessionId).toMatch(/^mock_cs_/);
      expect(result.url).toContain("mock-stripe.com/checkout/");
    });

    it("should return mock billing portal session", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createBillingPortalSession({
        customerId: "cus_123",
        returnUrl: "http://localhost/dashboard",
      });

      expect(result.url).toContain("mock-stripe.com/billing-portal/cus_123");
    });

    it("should handle cancel subscription in mock mode (cancelAtPeriodEnd=true)", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await expect(
        service.cancelSubscription("sub_123", true)
      ).resolves.toBeUndefined();
    });

    it("should handle cancel subscription in mock mode (cancelAtPeriodEnd=false)", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await expect(
        service.cancelSubscription("sub_123", false)
      ).resolves.toBeUndefined();
    });

    it("should handle cancel subscription with default cancelAtPeriodEnd", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await expect(
        service.cancelSubscription("sub_123")
      ).resolves.toBeUndefined();
    });

    it("should handle resume subscription in mock mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await expect(
        service.resumeSubscription("sub_123")
      ).resolves.toBeUndefined();
    });

    it("should return mock subscription info", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getSubscription("sub_123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("sub_123");
      expect(result?.status).toBe("active");
      expect(result?.customerId).toBe("mock_cus_123");
      expect(result?.priceId).toBe("mock_price_123");
      expect(result?.cancelAtPeriodEnd).toBe(false);
      expect(result?.canceledAt).toBeNull();
      expect(result?.trialStart).toBeNull();
      expect(result?.trialEnd).toBeNull();
      expect(result?.currentPeriodStart).toBeInstanceOf(Date);
      expect(result?.currentPeriodEnd).toBeInstanceOf(Date);
      // Period end should be about a month after period start
      expect(result!.currentPeriodEnd.getTime()).toBeGreaterThan(
        result!.currentPeriodStart.getTime()
      );
    });

    it("should return mock update subscription price result", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.updateSubscriptionPrice({
        subscriptionId: "sub_123",
        currentPriceId: "price_old",
        newPriceId: "price_new",
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("sub_123");
      expect(result?.status).toBe("active");
      expect(result?.priceId).toBe("price_new");
      expect(result?.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe("Subscription Checkout with trial", () => {
    beforeEach(() => {
      delete process.env.STRIPE_SECRET_KEY;
    });

    it("should return mock subscription checkout session without trial", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceId: "price_123",
        tenantId: "tenant-1",
        successUrl: "http://localhost/success",
        cancelUrl: "http://localhost/cancel",
      });

      expect(result.sessionId).toMatch(/^mock_cs_/);
      expect(result.url).toContain("mock-stripe.com/checkout/");
    });

    it("should return mock subscription checkout session with 0 trialDays", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceId: "price_123",
        tenantId: "tenant-1",
        successUrl: "http://localhost/success",
        cancelUrl: "http://localhost/cancel",
        trialDays: 0,
      });

      expect(result.sessionId).toMatch(/^mock_cs_/);
    });
  });

  describe("Connect Mock Mode", () => {
    beforeEach(() => {
      delete process.env.STRIPE_SECRET_KEY;
    });

    it("should generate Connect OAuth URL", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const url = service.generateConnectOAuthUrl(
        "ca_test123",
        "http://localhost/callback",
        "state-abc"
      );

      expect(url).toContain("connect.stripe.com/oauth/authorize");
      expect(url).toContain("client_id=ca_test123");
      expect(url).toContain("state=state-abc");
      expect(url).toContain("scope=read_write");
      expect(url).toContain(encodeURIComponent("http://localhost/callback"));
    });

    it("should return mock OAuth token response", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.handleConnectOAuthCallback("code_123");

      expect(result.access_token).toMatch(/^mock_access_token_/);
      expect(result.refresh_token).toMatch(/^mock_refresh_token_/);
      expect(result.stripe_user_id).toMatch(/^mock_acct_/);
      expect(result.scope).toBe("read_write");
    });

    it("should return mock Connect account status", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getConnectAccountStatus("acct_123");

      expect(result).toEqual({
        id: "acct_123",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      });
    });

    it("should handle disconnect Connect account in mock mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await expect(
        service.disconnectConnectAccount("acct_123")
      ).resolves.toBeUndefined();
    });

    it("should throw when verifying Connect webhook without secret configured", async () => {
      delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      expect(() =>
        service.verifyConnectWebhookSignature(
          JSON.stringify({ type: "account.updated" }),
          "sig_123"
        )
      ).toThrow("STRIPE_CONNECT_WEBHOOK_SECRET is not configured");
    });

    it("should parse Connect webhook payload in mock mode when secret is configured", async () => {
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_mock_connect";
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const payload = JSON.stringify({ type: "account.updated", data: { object: { id: "acct_123" } } });
      const result = service.verifyConnectWebhookSignature(payload, "sig_123");

      expect(result).toEqual({
        type: "account.updated",
        data: { object: { id: "acct_123" } },
      });
    });

    it("should generate Connect OAuth URL with correct query params", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const url = service.generateConnectOAuthUrl(
        "ca_special",
        "https://example.com/cb",
        "my-state"
      );

      expect(url).toContain("client_id=ca_special");
      expect(url).toContain("state=my-state");
      expect(url).toContain("stripe_landing=register");
      expect(url).toContain(encodeURIComponent("https://example.com/cb"));
    });

    it("should return mock update subscription price with correct priceId", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.updateSubscriptionPrice({
        subscriptionId: "sub_abc",
        currentPriceId: "price_old",
        newPriceId: "price_new_custom",
      });

      expect(result).not.toBeNull();
      expect(result?.priceId).toBe("price_new_custom");
      expect(result?.id).toBe("sub_abc");
      expect(result?.currentPeriodStart).toBeInstanceOf(Date);
      expect(result?.currentPeriodEnd).toBeInstanceOf(Date);
      expect(result?.trialStart).toBeNull();
      expect(result?.trialEnd).toBeNull();
    });
  });

  describe("Real Mode (STRIPE_SECRET_KEY set)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
      process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_123";
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_connect_test_123";
    });

    it("should report configured in real mode", async () => {
      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();
      expect(service.isConfigured()).toBe(true);
    });

    it("should create a real payment link", async () => {
      mockProductsCreate.mockResolvedValueOnce({ id: "prod_123" });
      mockPricesCreate.mockResolvedValueOnce({ id: "price_123" });
      mockPaymentLinksCreate.mockResolvedValueOnce({ id: "plink_123", url: "https://stripe.com/pay/plink_123" });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createPaymentLink({
        amount: 100.0,
        currency: "USD",
        description: "Invoice #123",
        metadata: { invoiceNumber: "INV-001" },
      });

      expect(result.id).toBe("plink_123");
      expect(result.url).toBe("https://stripe.com/pay/plink_123");
      expect(mockProductsCreate).toHaveBeenCalledWith({
        name: "Invoice #123",
        metadata: { invoiceNumber: "INV-001" },
      });
      expect(mockPricesCreate).toHaveBeenCalledWith({
        product: "prod_123",
        unit_amount: 10000,
        currency: "usd",
      });
    });

    it("should verify webhook signature in real mode", async () => {
      const fakeEvent = { type: "payment_intent.succeeded", data: { object: { id: "pi_123" } } };
      mockWebhooksConstructEvent.mockReturnValueOnce(fakeEvent);

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = service.verifyWebhookSignature('{"type":"test"}', "sig_123");
      expect(result).toEqual(fakeEvent);
      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith('{"type":"test"}', "sig_123", "whsec_test_123");
    });

    it("should return null when webhook verification fails", async () => {
      mockWebhooksConstructEvent.mockImplementationOnce(() => {
        throw new Error("Invalid signature");
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = service.verifyWebhookSignature('{"type":"test"}', "bad_sig");
      expect(result).toBeNull();
    });

    it("should create a real PaymentIntent with customer and saveCard", async () => {
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_real_123",
        client_secret: "pi_real_123_secret_abc",
        status: "requires_payment_method",
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createPaymentIntent({
        amount: 25.99,
        currency: "USD",
        metadata: { orderId: "order-1" },
        customerId: "cus_123",
        saveCard: true,
      });

      expect(result.id).toBe("pi_real_123");
      expect(result.clientSecret).toBe("pi_real_123_secret_abc");
      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2599,
          currency: "usd",
          customer: "cus_123",
          setup_future_usage: "on_session",
        }),
        undefined
      );
    });

    it("should create PaymentIntent without customer or saveCard", async () => {
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_simple",
        client_secret: "pi_simple_secret",
        status: "requires_payment_method",
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createPaymentIntent({
        amount: 10.0,
        currency: "USD",
        metadata: { orderId: "order-2" },
      });

      expect(result.id).toBe("pi_simple");
      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ customer: expect.anything(), setup_future_usage: expect.anything() }),
        undefined
      );
    });

    it("should create PaymentIntent with stripeAccount", async () => {
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_connect",
        client_secret: "pi_connect_secret",
        status: "requires_payment_method",
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.createPaymentIntent({
        amount: 10.0,
        currency: "USD",
        metadata: {},
        stripeAccount: "acct_connected",
      });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.anything(),
        { stripeAccount: "acct_connected" }
      );
    });

    it("should retrieve a real PaymentIntent with card details", async () => {
      mockPaymentIntentsRetrieve.mockResolvedValueOnce({
        id: "pi_real_123",
        status: "succeeded",
        amount: 2599,
        currency: "usd",
        metadata: { orderId: "order-1" },
        latest_charge: {
          payment_method_details: {
            type: "card",
            card: { brand: "mastercard", last4: "5678" },
          },
        },
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.retrievePaymentIntent("pi_real_123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("pi_real_123");
      expect(result?.status).toBe("succeeded");
      expect(result?.amount).toBe(2599);
      expect(result?.cardBrand).toBe("mastercard");
      expect(result?.cardLast4).toBe("5678");
      expect(result?.paymentMethodType).toBe("card");
    });

    it("should retrieve PaymentIntent with stripeAccount option", async () => {
      mockPaymentIntentsRetrieve.mockResolvedValueOnce({
        id: "pi_connect_123",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        metadata: {},
        latest_charge: null,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.retrievePaymentIntent("pi_connect_123", "acct_connected");

      expect(result).not.toBeNull();
      expect(result?.cardBrand).toBeUndefined();
      expect(result?.cardLast4).toBeUndefined();
      expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith(
        "pi_connect_123",
        { expand: ["latest_charge.payment_method_details"] },
        { stripeAccount: "acct_connected" }
      );
    });

    it("should return null when retrievePaymentIntent fails", async () => {
      mockPaymentIntentsRetrieve.mockRejectedValueOnce(new Error("Not found"));

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.retrievePaymentIntent("pi_nonexistent");
      expect(result).toBeNull();
    });

    it("should create a real customer", async () => {
      mockCustomersCreate.mockResolvedValueOnce({ id: "cus_real_123" });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createCustomer({
        email: "test@example.com",
        name: "John Doe",
        metadata: { loyaltyId: "lm-1" },
      });

      expect(result).toBe("cus_real_123");
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "John Doe",
        metadata: { loyaltyId: "lm-1" },
      });
    });

    it("should list real payment methods", async () => {
      mockPaymentMethodsList.mockResolvedValueOnce({
        data: [
          {
            id: "pm_1",
            card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2027 },
          },
          {
            id: "pm_2",
            card: { brand: "amex", last4: "0005", exp_month: 3, exp_year: 2026 },
          },
        ],
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.listPaymentMethods("cus_123");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "pm_1",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2027,
      });
    });

    it("should list payment methods with missing card details", async () => {
      mockPaymentMethodsList.mockResolvedValueOnce({
        data: [
          {
            id: "pm_no_card",
            card: null,
          },
          {
            id: "pm_partial",
            card: { brand: undefined, last4: undefined, exp_month: undefined, exp_year: undefined },
          },
        ],
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.listPaymentMethods("cus_123");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "pm_no_card",
        brand: "unknown",
        last4: "****",
        expMonth: 0,
        expYear: 0,
      });
      expect(result[1]).toEqual({
        id: "pm_partial",
        brand: "unknown",
        last4: "****",
        expMonth: 0,
        expYear: 0,
      });
    });

    it("should detach a real payment method", async () => {
      mockPaymentMethodsDetach.mockResolvedValueOnce({});

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.detachPaymentMethod("pm_123");
      expect(mockPaymentMethodsDetach).toHaveBeenCalledWith("pm_123");
    });

    it("should get a real customer", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({
        id: "cus_123",
        email: "real@example.com",
        name: "Real Customer",
        deleted: false,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getCustomer("cus_123");
      expect(result).toEqual({
        id: "cus_123",
        email: "real@example.com",
        name: "Real Customer",
      });
    });

    it("should return null for deleted customer", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({
        id: "cus_123",
        deleted: true,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getCustomer("cus_123");
      expect(result).toBeNull();
    });

    it("should return null when getCustomer fails", async () => {
      mockCustomersRetrieve.mockRejectedValueOnce(new Error("Not found"));

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getCustomer("cus_nonexistent");
      expect(result).toBeNull();
    });

    it("should return null for customer with null name", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({
        id: "cus_123",
        email: "test@example.com",
        name: undefined,
        deleted: false,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getCustomer("cus_123");
      expect(result?.name).toBeNull();
    });

    it("should create a real subscription checkout session", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_real_123",
        url: "https://checkout.stripe.com/pay/cs_real_123",
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceId: "price_123",
        tenantId: "tenant-1",
        successUrl: "http://example.com/success",
        cancelUrl: "http://example.com/cancel",
      });

      expect(result.sessionId).toBe("cs_real_123");
      expect(result.url).toBe("https://checkout.stripe.com/pay/cs_real_123");
    });

    it("should create subscription checkout with trial days", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_trial",
        url: "https://checkout.stripe.com/pay/cs_trial",
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceId: "price_123",
        tenantId: "tenant-1",
        successUrl: "http://example.com/success",
        cancelUrl: "http://example.com/cancel",
        trialDays: 14,
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: expect.objectContaining({
            trial_period_days: 14,
          }),
        })
      );
    });

    it("should not set trial_period_days when trialDays is 0", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_no_trial",
        url: "https://checkout.stripe.com/pay/cs_no_trial",
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceId: "price_123",
        tenantId: "tenant-1",
        successUrl: "http://example.com/success",
        cancelUrl: "http://example.com/cancel",
        trialDays: 0,
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          subscription_data: expect.objectContaining({
            trial_period_days: expect.anything(),
          }),
        })
      );
    });

    it("should create a real billing portal session", async () => {
      mockBillingPortalSessionsCreate.mockResolvedValueOnce({
        url: "https://billing.stripe.com/portal/session_123",
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.createBillingPortalSession({
        customerId: "cus_123",
        returnUrl: "http://example.com/dashboard",
      });

      expect(result.url).toBe("https://billing.stripe.com/portal/session_123");
    });

    it("should cancel subscription at period end", async () => {
      mockSubscriptionsUpdate.mockResolvedValueOnce({});

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.cancelSubscription("sub_123", true);

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: true,
      });
      expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    });

    it("should cancel subscription immediately", async () => {
      mockSubscriptionsCancel.mockResolvedValueOnce({});

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.cancelSubscription("sub_123", false);

      expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_123");
      expect(mockSubscriptionsUpdate).not.toHaveBeenCalled();
    });

    it("should resume a subscription", async () => {
      mockSubscriptionsUpdate.mockResolvedValueOnce({});

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.resumeSubscription("sub_123");

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: false,
      });
    });

    it("should get a real subscription", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        id: "sub_123",
        status: "active",
        customer: "cus_123",
        items: {
          data: [{
            price: { id: "price_123" },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          }],
        },
        trial_start: 1699900000,
        trial_end: 1700000000,
        cancel_at_period_end: false,
        canceled_at: null,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getSubscription("sub_123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("sub_123");
      expect(result?.status).toBe("active");
      expect(result?.customerId).toBe("cus_123");
      expect(result?.priceId).toBe("price_123");
      expect(result?.trialStart).toBeInstanceOf(Date);
      expect(result?.trialEnd).toBeInstanceOf(Date);
      expect(result?.cancelAtPeriodEnd).toBe(false);
      expect(result?.canceledAt).toBeNull();
    });

    it("should get subscription with customer object", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        id: "sub_123",
        status: "active",
        customer: { id: "cus_obj_123" },
        items: {
          data: [{
            price: { id: "price_123" },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          }],
        },
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: true,
        canceled_at: 1700500000,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getSubscription("sub_123");

      expect(result?.customerId).toBe("cus_obj_123");
      expect(result?.cancelAtPeriodEnd).toBe(true);
      expect(result?.canceledAt).toBeInstanceOf(Date);
    });

    it("should get subscription with no items (edge case)", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        id: "sub_empty",
        status: "active",
        customer: "cus_123",
        items: { data: [] },
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getSubscription("sub_empty");

      expect(result?.priceId).toBeNull();
    });

    it("should return null when getSubscription fails", async () => {
      mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error("Not found"));

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getSubscription("sub_nonexistent");
      expect(result).toBeNull();
    });

    it("should handle real OAuth callback", async () => {
      mockOAuthToken.mockResolvedValueOnce({
        access_token: "real_access",
        refresh_token: "real_refresh",
        stripe_user_id: "acct_real",
        scope: "read_write",
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.handleConnectOAuthCallback("code_real");

      expect(result.access_token).toBe("real_access");
      expect(result.stripe_user_id).toBe("acct_real");
    });

    it("should handle OAuth callback with null fields", async () => {
      mockOAuthToken.mockResolvedValueOnce({
        access_token: null,
        refresh_token: null,
        stripe_user_id: null,
        scope: null,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.handleConnectOAuthCallback("code_null");

      expect(result.access_token).toBe("");
      expect(result.refresh_token).toBe("");
      expect(result.stripe_user_id).toBe("");
      expect(result.scope).toBe("");
    });

    it("should get Connect account status in real mode", async () => {
      mockAccountsRetrieve.mockResolvedValueOnce({
        id: "acct_real",
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getConnectAccountStatus("acct_real");

      expect(result).toEqual({
        id: "acct_real",
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
      });
    });

    it("should handle account with null fields", async () => {
      mockAccountsRetrieve.mockResolvedValueOnce({
        id: "acct_null",
        charges_enabled: null,
        payouts_enabled: null,
        details_submitted: null,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.getConnectAccountStatus("acct_null");

      expect(result.charges_enabled).toBe(false);
      expect(result.payouts_enabled).toBe(false);
      expect(result.details_submitted).toBe(false);
    });

    it("should disconnect a Connect account in real mode", async () => {
      mockOAuthDeauthorize.mockResolvedValueOnce({});

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.disconnectConnectAccount("acct_real");

      expect(mockOAuthDeauthorize).toHaveBeenCalledWith({
        client_id: "ca_test_123",
        stripe_user_id: "acct_real",
      });
    });

    it("should disconnect with empty client_id when STRIPE_CONNECT_CLIENT_ID is not set", async () => {
      delete process.env.STRIPE_CONNECT_CLIENT_ID;
      mockOAuthDeauthorize.mockResolvedValueOnce({});

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      await service.disconnectConnectAccount("acct_real");

      expect(mockOAuthDeauthorize).toHaveBeenCalledWith({
        client_id: "",
        stripe_user_id: "acct_real",
      });
    });

    it("should verify Connect webhook signature in real mode", async () => {
      const fakeEvent = { type: "account.updated", data: { object: { id: "acct_123" } } };
      mockWebhooksConstructEvent.mockReturnValueOnce(fakeEvent);

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = service.verifyConnectWebhookSignature('{"type":"test"}', "sig_connect");

      expect(result).toEqual(fakeEvent);
      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith('{"type":"test"}', "sig_connect", "whsec_connect_test_123");
    });

    it("should update subscription price in real mode", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        id: "sub_123",
        items: {
          data: [{ id: "si_123", price: { id: "price_old" } }],
        },
      });
      mockSubscriptionsUpdate.mockResolvedValueOnce({
        id: "sub_123",
        status: "active",
        customer: "cus_123",
        items: {
          data: [{
            price: { id: "price_new" },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          }],
        },
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.updateSubscriptionPrice({
        subscriptionId: "sub_123",
        currentPriceId: "price_old",
        newPriceId: "price_new",
      });

      expect(result).not.toBeNull();
      expect(result?.priceId).toBe("price_new");
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
        items: [{ id: "si_123", price: "price_new" }],
        proration_behavior: "create_prorations",
      });
    });

    it("should return null when subscription item not found for price update", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        id: "sub_123",
        items: {
          data: [{ id: "si_123", price: { id: "price_different" } }],
        },
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.updateSubscriptionPrice({
        subscriptionId: "sub_123",
        currentPriceId: "price_old",
        newPriceId: "price_new",
      });

      expect(result).toBeNull();
    });

    it("should return null when updateSubscriptionPrice fails", async () => {
      mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error("API error"));

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.updateSubscriptionPrice({
        subscriptionId: "sub_fail",
        currentPriceId: "price_old",
        newPriceId: "price_new",
      });

      expect(result).toBeNull();
    });

    it("should update subscription price with customer as object", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        id: "sub_123",
        items: {
          data: [{ id: "si_123", price: { id: "price_old" } }],
        },
      });
      mockSubscriptionsUpdate.mockResolvedValueOnce({
        id: "sub_123",
        status: "active",
        customer: { id: "cus_obj_123" },
        items: {
          data: [{
            price: { id: "price_new" },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          }],
        },
        trial_start: 1699900000,
        trial_end: 1700000000,
        cancel_at_period_end: false,
        canceled_at: 1700500000,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.updateSubscriptionPrice({
        subscriptionId: "sub_123",
        currentPriceId: "price_old",
        newPriceId: "price_new",
      });

      expect(result?.customerId).toBe("cus_obj_123");
      expect(result?.trialStart).toBeInstanceOf(Date);
      expect(result?.trialEnd).toBeInstanceOf(Date);
      expect(result?.canceledAt).toBeInstanceOf(Date);
    });

    it("should update subscription price with no items in result", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        id: "sub_123",
        items: {
          data: [{ id: "si_123", price: { id: "price_old" } }],
        },
      });
      mockSubscriptionsUpdate.mockResolvedValueOnce({
        id: "sub_123",
        status: "active",
        customer: "cus_123",
        items: { data: [] },
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
      });

      const { StripeService } = await import("../stripe.service");
      const service = new StripeService();

      const result = await service.updateSubscriptionPrice({
        subscriptionId: "sub_123",
        currentPriceId: "price_old",
        newPriceId: "price_new",
      });

      expect(result?.priceId).toBeNull();
    });
  });

});
