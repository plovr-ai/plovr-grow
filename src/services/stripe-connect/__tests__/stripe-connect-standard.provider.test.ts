import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// Mock @/services/stripe before importing the provider
vi.mock("@/services/stripe", () => ({
  stripeService: {
    createPaymentIntent: vi.fn(),
    retrievePaymentIntent: vi.fn(),
    verifyConnectWebhookSignature: vi.fn(),
  },
}));

import { stripeService } from "@/services/stripe";
import { StripeConnectStandardProvider } from "../stripe-connect-standard.provider";

const mockStripeService = vi.mocked(stripeService);

describe("StripeConnectStandardProvider", () => {
  let provider: StripeConnectStandardProvider;

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new StripeConnectStandardProvider();
  });

  describe("type", () => {
    it('should have type "stripe_connect_standard"', () => {
      expect(provider.type).toBe("stripe_connect_standard");
    });
  });

  describe("createPaymentIntent", () => {
    it("should map input correctly and return mapped result", async () => {
      const mockResult = {
        id: "pi_test_123",
        clientSecret: "pi_test_123_secret_abc",
        status: "requires_payment_method",
      };
      mockStripeService.createPaymentIntent.mockResolvedValue(mockResult);

      const input = {
        amount: 2500,
        currency: "usd",
        stripeAccountId: "acct_test_456",
        metadata: { orderId: "order-789" },
      };

      const result = await provider.createPaymentIntent(input);

      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith({
        amount: input.amount,
        currency: input.currency,
        stripeAccount: input.stripeAccountId,
        metadata: input.metadata,
      });

      expect(result).toEqual({
        paymentIntentId: mockResult.id,
        clientSecret: mockResult.clientSecret,
        stripeAccountId: input.stripeAccountId,
      });
    });

    it("should pass metadata as undefined when not provided", async () => {
      mockStripeService.createPaymentIntent.mockResolvedValue({
        id: "pi_test_456",
        clientSecret: "pi_test_456_secret_xyz",
        status: "requires_payment_method",
      });

      await provider.createPaymentIntent({
        amount: 1000,
        currency: "usd",
        stripeAccountId: "acct_test_789",
      });

      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith({
        amount: 1000,
        currency: "usd",
        stripeAccount: "acct_test_789",
        metadata: undefined,
      });
    });
  });

  describe("retrievePaymentIntent", () => {
    it("should pass stripeAccountId to stripeService and return result", async () => {
      const mockRetrieved = {
        id: "pi_test_123",
        status: "succeeded",
        amount: 2500,
        currency: "usd",
        paymentMethodType: "card",
        cardBrand: "visa",
        cardLast4: "4242",
      };
      mockStripeService.retrievePaymentIntent.mockResolvedValue(mockRetrieved);

      const result = await provider.retrievePaymentIntent("pi_test_123", "acct_test_456");

      expect(mockStripeService.retrievePaymentIntent).toHaveBeenCalledWith(
        "pi_test_123",
        "acct_test_456"
      );
      expect(result).toEqual(mockRetrieved);
    });
  });

  describe("verifyWebhookSignature", () => {
    it("should delegate to verifyConnectWebhookSignature and return result", () => {
      const mockEvent = { type: "payment_intent.succeeded", id: "evt_test_123" } as unknown as Stripe.Event;
      mockStripeService.verifyConnectWebhookSignature.mockReturnValue(mockEvent);

      const result = provider.verifyWebhookSignature("raw-payload", "stripe-signature");

      expect(mockStripeService.verifyConnectWebhookSignature).toHaveBeenCalledWith(
        "raw-payload",
        "stripe-signature"
      );
      expect(result).toEqual(mockEvent);
    });
  });
});
