import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";

// Mock services
vi.mock("@/services/stripe", () => ({
  stripeService: {
    verifyConnectWebhookSignature: vi.fn(),
  },
}));

vi.mock("@/services/payment", () => ({
  paymentService: {
    handlePaymentSucceeded: vi.fn(),
    handlePaymentFailed: vi.fn(),
    getPaymentByIntentId: vi.fn(),
  },
}));

vi.mock("@/services/order", () => ({
  orderService: {
    updatePaymentStatus: vi.fn(),
  },
}));

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    handleAccountUpdated: vi.fn(),
  },
}));

import { stripeService } from "@/services/stripe";
import { paymentService } from "@/services/payment";
import { orderService } from "@/services/order";
import { stripeConnectService } from "@/services/stripe-connect";

function makeRequest(body: unknown, signature?: string): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe-connect", {
    method: "POST",
    body: JSON.stringify(body),
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

describe("POST /api/webhooks/stripe-connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: getPaymentByIntentId returns a succeeded payment with order info
    vi.mocked(paymentService.getPaymentByIntentId).mockResolvedValue({
      id: "pay-1",
      status: "succeeded",
      order: { id: "order-1", orderNumber: "ORD-001", tenantId: "tenant-1", merchantId: "merchant-1" },
    } as never);
    vi.mocked(orderService.updatePaymentStatus).mockResolvedValue(undefined);
  });

  describe("Signature Verification", () => {
    it("should return 400 when stripe-signature header is missing", async () => {
      const request = makeRequest({ type: "test" });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing signature");
      expect(stripeService.verifyConnectWebhookSignature).not.toHaveBeenCalled();
    });

    it("should return 400 when signature verification fails", async () => {
      vi.mocked(stripeService.verifyConnectWebhookSignature).mockImplementation(
        () => {
          throw new Error("Signature verification failed");
        }
      );

      const request = makeRequest({ type: "test" }, "invalid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid signature");
    });
  });

  describe("payment_intent.succeeded", () => {
    it("should call handlePaymentSucceeded with card details", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test123",
            status: "succeeded",
            charges: {
              data: [
                {
                  payment_method_details: {
                    type: "card",
                    card: {
                      brand: "visa",
                      last4: "4242",
                    },
                  },
                },
              ],
            },
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(paymentService.handlePaymentSucceeded).toHaveBeenCalledWith({
        provider: "stripe",
        providerPaymentId: "pi_test123",
        status: "succeeded",
        paymentMethodType: "card",
        cardBrand: "visa",
        cardLast4: "4242",
      });
    });

    it("should call handlePaymentSucceeded without card details when charges are empty", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test123",
            status: "succeeded",
            charges: { data: [] },
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(paymentService.handlePaymentSucceeded).toHaveBeenCalledWith({
        provider: "stripe",
        providerPaymentId: "pi_test123",
        status: "succeeded",
        paymentMethodType: undefined,
        cardBrand: undefined,
        cardLast4: undefined,
      });
    });
  });

  describe("payment_intent.payment_failed", () => {
    it("should call handlePaymentFailed with failure details", async () => {
      const event = {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_test456",
            last_payment_error: {
              code: "card_declined",
              message: "Your card was declined.",
            },
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentFailed).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(paymentService.handlePaymentFailed).toHaveBeenCalledWith({
        provider: "stripe",
        providerPaymentId: "pi_test456",
        failureCode: "card_declined",
        failureMessage: "Your card was declined.",
      });
    });

    it("should call handlePaymentFailed without error details when not present", async () => {
      const event = {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_test456",
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentFailed).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(paymentService.handlePaymentFailed).toHaveBeenCalledWith({
        provider: "stripe",
        providerPaymentId: "pi_test456",
        failureCode: undefined,
        failureMessage: undefined,
      });
    });
  });

  describe("account.updated", () => {
    it("should call handleAccountUpdated with correct status using event.account", async () => {
      const event = {
        type: "account.updated",
        account: "acct_test123",
        data: {
          object: {
            id: "acct_test123",
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(stripeConnectService.handleAccountUpdated).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(stripeConnectService.handleAccountUpdated).toHaveBeenCalledWith(
        "acct_test123",
        {
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        }
      );
    });

    it("should fallback to account.id when event.account is missing", async () => {
      const event = {
        type: "account.updated",
        // No 'account' field on the event
        data: {
          object: {
            id: "acct_fallback",
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(stripeConnectService.handleAccountUpdated).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(stripeConnectService.handleAccountUpdated).toHaveBeenCalledWith(
        "acct_fallback",
        expect.objectContaining({ chargesEnabled: true })
      );
    });

    it("should call handleAccountUpdated with false values when disabled", async () => {
      const event = {
        type: "account.updated",
        account: "acct_test456",
        data: {
          object: {
            id: "acct_test456",
            charges_enabled: false,
            payouts_enabled: false,
            details_submitted: false,
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(stripeConnectService.handleAccountUpdated).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(stripeConnectService.handleAccountUpdated).toHaveBeenCalledWith(
        "acct_test456",
        {
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        }
      );
    });
  });

  describe("nullable fields", () => {
    it("should use fallback status 'succeeded' when status is undefined", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_no_status",
            status: undefined,
            charges: { data: [] },
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(paymentService.handlePaymentSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "stripe", status: "succeeded" })
      );
    });

    it("should default account fields to false when undefined", async () => {
      const event = {
        type: "account.updated",
        account: "acct_null",
        data: {
          object: {
            id: "acct_null",
            charges_enabled: undefined,
            payouts_enabled: undefined,
            details_submitted: undefined,
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(stripeConnectService.handleAccountUpdated).mockResolvedValue(
        undefined
      );

      const request = makeRequest(event, "valid_sig");
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(stripeConnectService.handleAccountUpdated).toHaveBeenCalledWith(
        "acct_null",
        {
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        }
      );
    });
  });

  describe("Unhandled Events", () => {
    it("should acknowledge unhandled event types", async () => {
      const event = {
        type: "customer.created",
        data: {
          object: { id: "cus_test123" },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );

      const request = makeRequest(event, "valid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });
  });

  describe("Order status update on payment events", () => {
    it("should update order to completed when payment_intent.succeeded", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_order",
            status: "succeeded",
            charges: { data: [] },
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(event as never);
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(undefined);

      const request = makeRequest(event, "valid_sig");
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(paymentService.getPaymentByIntentId).toHaveBeenCalledWith("pi_test_order");
      expect(orderService.updatePaymentStatus).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "completed",
        { source: "internal" }
      );
    });

    it("should update order to payment_failed when payment_intent.payment_failed", async () => {
      // Override default to return failed status for this test
      vi.mocked(paymentService.getPaymentByIntentId).mockResolvedValue({
        id: "pay-1",
        status: "failed",
        order: { id: "order-1", orderNumber: "ORD-001", tenantId: "tenant-1", merchantId: "merchant-1" },
      } as never);

      const event = {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_test_fail",
            last_payment_error: { code: "card_declined", message: "Declined" },
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(event as never);
      vi.mocked(paymentService.handlePaymentFailed).mockResolvedValue(undefined);

      const request = makeRequest(event, "valid_sig");
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(paymentService.getPaymentByIntentId).toHaveBeenCalledWith("pi_test_fail");
      expect(orderService.updatePaymentStatus).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "payment_failed",
        { source: "internal" }
      );
    });

    it("should skip order update when payment record has no order", async () => {
      vi.mocked(paymentService.getPaymentByIntentId).mockResolvedValue({
        id: "pay-1",
        order: null,
      } as never);

      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: { id: "pi_no_order", status: "succeeded", charges: { data: [] } },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(event as never);
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(undefined);

      const request = makeRequest(event, "valid_sig");
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(orderService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it("should skip order update when payment CAS failed (status still pending/failed)", async () => {
      // Simulates Stripe retry: payment_failed then succeeded, but CAS only does pending->succeeded
      // If payment is still 'failed' after handlePaymentSucceeded CAS no-op, don't complete the order
      vi.mocked(paymentService.getPaymentByIntentId).mockResolvedValue({
        id: "pay-1",
        status: "failed", // CAS didn't flip because expected "pending" but found "failed"
        order: { id: "order-1", orderNumber: "ORD-001", tenantId: "tenant-1", merchantId: "merchant-1" },
      } as never);

      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: { id: "pi_retry", status: "succeeded", charges: { data: [] } },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(event as never);
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(undefined);

      const request = makeRequest(event, "valid_sig");
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(orderService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it("should skip order update when payment record not found", async () => {
      vi.mocked(paymentService.getPaymentByIntentId).mockResolvedValue(null);

      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: { id: "pi_missing", status: "succeeded", charges: { data: [] } },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(event as never);
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(undefined);

      const request = makeRequest(event, "valid_sig");
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(orderService.updatePaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when handler throws error", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test123",
            status: "succeeded",
            charges: { data: [] },
          },
        },
      };

      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentSucceeded).mockRejectedValue(
        new Error("Database error")
      );

      const request = makeRequest(event, "valid_sig");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Webhook handler failed");
    });
  });
});
