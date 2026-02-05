import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock services
vi.mock("@/services/stripe", () => ({
  stripeService: {
    verifyWebhookSignature: vi.fn(),
  },
}));

vi.mock("@/services/invoice", () => ({
  invoiceService: {
    handlePaymentCompleted: vi.fn(),
  },
}));

vi.mock("@/services/payment", () => ({
  paymentService: {
    handlePaymentSucceeded: vi.fn(),
    handlePaymentFailed: vi.fn(),
  },
}));

import { stripeService } from "@/services/stripe";
import { invoiceService } from "@/services/invoice";
import { paymentService } from "@/services/payment";

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Signature Verification", () => {
    it("should return 400 for invalid signature", async () => {
      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify({ type: "test" }),
          headers: {
            "stripe-signature": "invalid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid signature");
    });
  });

  describe("checkout.session.completed", () => {
    it("should handle invoice payment from checkout session", async () => {
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test123",
            metadata: {
              invoiceNumber: "INV-001",
            },
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(invoiceService.handlePaymentCompleted).mockResolvedValue(
        undefined
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(invoiceService.handlePaymentCompleted).toHaveBeenCalledWith(
        "INV-001"
      );
    });

    it("should skip invoice handling if no invoiceNumber", async () => {
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test123",
            metadata: {},
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(invoiceService.handlePaymentCompleted).not.toHaveBeenCalled();
    });
  });

  describe("payment_intent.succeeded", () => {
    it("should handle invoice payment from payment intent", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test123",
            status: "succeeded",
            metadata: {
              invoiceNumber: "INV-002",
            },
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

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(invoiceService.handlePaymentCompleted).mockResolvedValue(
        undefined
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(invoiceService.handlePaymentCompleted).toHaveBeenCalledWith(
        "INV-002"
      );
      // paymentService should NOT be called for invoice payments
      expect(paymentService.handlePaymentSucceeded).not.toHaveBeenCalled();
    });

    it("should handle order payment from payment intent", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test123",
            status: "succeeded",
            metadata: {
              // No invoiceNumber - this is an order payment
            },
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

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(
        undefined
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(paymentService.handlePaymentSucceeded).toHaveBeenCalledWith({
        paymentIntentId: "pi_test123",
        status: "succeeded",
        paymentMethodType: "card",
        cardBrand: "visa",
        cardLast4: "4242",
      });
    });

    it("should handle payment without card details", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test123",
            status: "succeeded",
            metadata: {},
            charges: {
              data: [],
            },
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentSucceeded).mockResolvedValue(
        undefined
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(paymentService.handlePaymentSucceeded).toHaveBeenCalledWith({
        paymentIntentId: "pi_test123",
        status: "succeeded",
        paymentMethodType: undefined,
        cardBrand: undefined,
        cardLast4: undefined,
      });
    });
  });

  describe("payment_intent.payment_failed", () => {
    it("should handle payment failure", async () => {
      const event = {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_test123",
            last_payment_error: {
              code: "card_declined",
              message: "Your card was declined.",
            },
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentFailed).mockResolvedValue(
        undefined
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(paymentService.handlePaymentFailed).toHaveBeenCalledWith({
        paymentIntentId: "pi_test123",
        failureCode: "card_declined",
        failureMessage: "Your card was declined.",
      });
    });

    it("should handle payment failure without error details", async () => {
      const event = {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_test123",
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentFailed).mockResolvedValue(
        undefined
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(paymentService.handlePaymentFailed).toHaveBeenCalledWith({
        paymentIntentId: "pi_test123",
        failureCode: undefined,
        failureMessage: undefined,
      });
    });
  });

  describe("Unhandled Events", () => {
    it("should acknowledge unhandled event types", async () => {
      const event = {
        type: "customer.created",
        data: {
          object: {
            id: "cus_test123",
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
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
            metadata: {},
            charges: { data: [] },
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(paymentService.handlePaymentSucceeded).mockRejectedValue(
        new Error("Database error")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/stripe",
        {
          method: "POST",
          body: JSON.stringify(event),
          headers: {
            "stripe-signature": "valid_sig",
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Webhook handler failed");
    });
  });
});
