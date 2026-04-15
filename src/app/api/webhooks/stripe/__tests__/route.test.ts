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

vi.mock("@/services/subscription", () => ({
  subscriptionService: {
    handleCheckoutSessionCompleted: vi.fn(),
    handleSubscriptionCreated: vi.fn(),
    handleSubscriptionUpdated: vi.fn(),
    handleSubscriptionDeleted: vi.fn(),
    handleInvoicePaymentSucceeded: vi.fn(),
    handleInvoicePaymentFailed: vi.fn(),
  },
}));

import { stripeService } from "@/services/stripe";
import { invoiceService } from "@/services/invoice";
import { subscriptionService } from "@/services/subscription";

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

      const response = await POST(request, { params: Promise.resolve({}) });
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

      const response = await POST(request, { params: Promise.resolve({}) });
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

      const response = await POST(request, { params: Promise.resolve({}) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(invoiceService.handlePaymentCompleted).not.toHaveBeenCalled();
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

      const response = await POST(request, { params: Promise.resolve({}) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });
  });

  describe("Subscription Events", () => {
    it("should handle checkout.session.completed with subscription", async () => {
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_sub",
            mode: "subscription",
            subscription: "sub_test123",
            metadata: { tenantId: "tenant-1" },
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(event as never);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "stripe-signature": "valid_sig" },
      });

      const response = await POST(request, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(subscriptionService.handleCheckoutSessionCompleted).toHaveBeenCalled();
    });

    it("should handle customer.subscription.created", async () => {
      const event = {
        type: "customer.subscription.created",
        data: { object: { id: "sub_created", status: "active" } },
      };
      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(event as never);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "stripe-signature": "valid_sig" },
      });

      const response = await POST(request, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(subscriptionService.handleSubscriptionCreated).toHaveBeenCalled();
    });

    it("should handle customer.subscription.updated", async () => {
      const event = {
        type: "customer.subscription.updated",
        data: { object: { id: "sub_updated", status: "past_due" } },
      };
      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(event as never);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "stripe-signature": "valid_sig" },
      });

      const response = await POST(request, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(subscriptionService.handleSubscriptionUpdated).toHaveBeenCalled();
    });

    it("should handle customer.subscription.deleted", async () => {
      const event = {
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_deleted", status: "canceled" } },
      };
      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(event as never);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "stripe-signature": "valid_sig" },
      });

      const response = await POST(request, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(subscriptionService.handleSubscriptionDeleted).toHaveBeenCalled();
    });

    it("should handle invoice.payment_succeeded for subscription", async () => {
      const event = {
        type: "invoice.payment_succeeded",
        data: { object: { id: "inv_success", subscription: "sub_123" } },
      };
      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(event as never);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "stripe-signature": "valid_sig" },
      });

      const response = await POST(request, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(subscriptionService.handleInvoicePaymentSucceeded).toHaveBeenCalled();
    });

    it("should skip invoice.payment_succeeded without subscription", async () => {
      const event = {
        type: "invoice.payment_succeeded",
        data: { object: { id: "inv_no_sub", subscription: null } },
      };
      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(event as never);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "stripe-signature": "valid_sig" },
      });

      const response = await POST(request, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(subscriptionService.handleInvoicePaymentSucceeded).not.toHaveBeenCalled();
    });

    it("should handle invoice.payment_failed for subscription", async () => {
      const event = {
        type: "invoice.payment_failed",
        data: { object: { id: "inv_fail", subscription: "sub_123" } },
      };
      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(event as never);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "stripe-signature": "valid_sig" },
      });

      const response = await POST(request, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(subscriptionService.handleInvoicePaymentFailed).toHaveBeenCalled();
    });

    it("should skip invoice.payment_failed without subscription", async () => {
      const event = {
        type: "invoice.payment_failed",
        data: { object: { id: "inv_fail_no_sub", subscription: null } },
      };
      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(event as never);

      const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "stripe-signature": "valid_sig" },
      });

      const response = await POST(request, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(subscriptionService.handleInvoicePaymentFailed).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when handler throws error", async () => {
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test123",
            metadata: {
              invoiceNumber: "INV-ERR",
            },
          },
        },
      };

      vi.mocked(stripeService.verifyWebhookSignature).mockReturnValue(
        event as never
      );
      vi.mocked(invoiceService.handlePaymentCompleted).mockRejectedValue(
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

      const response = await POST(request, { params: Promise.resolve({}) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
