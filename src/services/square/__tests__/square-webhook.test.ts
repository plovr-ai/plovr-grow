import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Mock dependencies
const mockGetConnectionByExternalAccountId = vi.fn();
const mockFindWebhookEventByEventId = vi.fn();
const mockCreateWebhookEvent = vi.fn();
const mockUpdateWebhookEventStatus = vi.fn();
const mockGetIdMappingByExternalId = vi.fn();

vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    getConnectionByExternalAccountId: (...args: unknown[]) =>
      mockGetConnectionByExternalAccountId(...args),
    findWebhookEventByEventId: (...args: unknown[]) =>
      mockFindWebhookEventByEventId(...args),
    createWebhookEvent: (...args: unknown[]) =>
      mockCreateWebhookEvent(...args),
    updateWebhookEventStatus: (...args: unknown[]) =>
      mockUpdateWebhookEventStatus(...args),
    getIdMappingByExternalId: (...args: unknown[]) =>
      mockGetIdMappingByExternalId(...args),
  },
}));

const mockSyncCatalog = vi.fn();

vi.mock("../square.service", () => ({
  squareService: {
    syncCatalog: (...args: unknown[]) => mockSyncCatalog(...args),
  },
}));

vi.mock("../square.config", () => ({
  squareConfig: {
    webhookSignatureKey: "test-webhook-key",
    webhookNotificationUrl: "https://example.com/api/integration/square/webhook",
  },
}));

const mockMerchantFindFirst = vi.fn();
const mockOrderUpdate = vi.fn();
const mockOrderFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  default: {
    merchant: {
      findFirst: (...args: unknown[]) => mockMerchantFindFirst(...args),
    },
    order: {
      update: (...args: unknown[]) => mockOrderUpdate(...args),
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
    },
  },
}));

import { SquareWebhookService } from "../square-webhook.service";

const TENANT_ID = "tenant-1";
const MERCHANT_ID = "merchant-1";
const CONNECTION_ID = "conn-1";

const mockConnection = {
  id: CONNECTION_ID,
  tenantId: TENANT_ID,
  merchantId: MERCHANT_ID,
};

function buildPayload(
  overrides: Partial<{
    merchant_id: string;
    type: string;
    event_id: string;
    data: Record<string, unknown>;
  }> = {}
) {
  return {
    merchant_id: "sq-merchant-1",
    type: "catalog.version.updated",
    event_id: "evt-1",
    created_at: "2026-04-09T00:00:00Z",
    data: { type: "catalog", id: "cat-1" },
    ...overrides,
  };
}

function computeSignature(rawBody: string): string {
  const hmac = crypto.createHmac("sha256", "test-webhook-key");
  hmac.update("https://example.com/api/integration/square/webhook" + rawBody);
  return hmac.digest("base64");
}

describe("SquareWebhookService", () => {
  let service: SquareWebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SquareWebhookService();

    // Default mocks
    mockFindWebhookEventByEventId.mockResolvedValue(null);
    mockGetConnectionByExternalAccountId.mockResolvedValue(mockConnection);
    mockCreateWebhookEvent.mockResolvedValue({
      id: "we-1",
      eventId: "evt-1",
    });
    mockUpdateWebhookEventStatus.mockResolvedValue({});
    mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
    mockSyncCatalog.mockResolvedValue({});
    mockGetIdMappingByExternalId.mockResolvedValue(null);
    mockOrderUpdate.mockResolvedValue({});
    mockOrderFindUnique.mockResolvedValue({
      fulfillmentStatus: "pending",
      status: "completed",
    });
  });

  // ==================== verifySignature ====================

  describe("verifySignature()", () => {
    it("should return true for a valid signature", () => {
      const body = '{"test":"data"}';
      const sig = computeSignature(body);
      expect(service.verifySignature(body, sig)).toBe(true);
    });

    it("should return false for an invalid signature", () => {
      const body = '{"test":"data"}';
      const wrongSig = Buffer.from("wrong-signature").toString("base64");
      expect(service.verifySignature(body, wrongSig)).toBe(false);
    });

    it("should return false when body is tampered", () => {
      const body = '{"test":"data"}';
      const sig = computeSignature(body);
      expect(service.verifySignature('{"test":"tampered"}', sig)).toBe(false);
    });

    it("should return false for empty signature", () => {
      expect(service.verifySignature('{"test":"data"}', "")).toBe(false);
    });

    it("should return false when crypto throws (catch branch)", async () => {
      const { squareConfig } = await import("../square.config");
      const origKey = squareConfig.webhookSignatureKey;
      // Setting key to null forces createHmac to throw
      (squareConfig as Record<string, unknown>).webhookSignatureKey = null;

      const result = service.verifySignature('{"test":"data"}', "somesig");

      expect(result).toBe(false);

      (squareConfig as Record<string, unknown>).webhookSignatureKey = origKey;
    });
  });

  // ==================== handleWebhook ====================

  describe("handleWebhook()", () => {
    it("should return deduplicated when event already exists", async () => {
      mockFindWebhookEventByEventId.mockResolvedValue({
        id: "we-existing",
        eventId: "evt-1",
      });

      const payload = buildPayload();
      const result = await service.handleWebhook(JSON.stringify(payload));

      expect(result).toEqual({ deduplicated: true });
      expect(mockCreateWebhookEvent).not.toHaveBeenCalled();
    });

    it("should return error when connection not found", async () => {
      mockGetConnectionByExternalAccountId.mockResolvedValue(null);

      const payload = buildPayload();
      const result = await service.handleWebhook(JSON.stringify(payload));

      expect(result).toEqual({ error: "connection_not_found" });
      expect(mockCreateWebhookEvent).not.toHaveBeenCalled();
    });

    it("should store event and process successfully", async () => {
      const payload = buildPayload();
      const result = await service.handleWebhook(JSON.stringify(payload));

      expect(result).toEqual({ deduplicated: false });
      expect(mockCreateWebhookEvent).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        merchantId: MERCHANT_ID,
        connectionId: CONNECTION_ID,
        eventId: "evt-1",
        eventType: "catalog.version.updated",
        payload,
      });
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "processed"
      );
    });

    it("should mark event as failed when handler throws", async () => {
      mockMerchantFindFirst.mockResolvedValue(null);
      mockSyncCatalog.mockRejectedValue(new Error("sync failed"));

      // Use catalog event but merchant not found won't throw, so use a different scenario
      // Force syncCatalog to throw a non-ALREADY_RUNNING error
      mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
      mockSyncCatalog.mockRejectedValue(new Error("sync failed"));

      const payload = buildPayload({
        type: "catalog.version.updated",
      });
      const result = await service.handleWebhook(JSON.stringify(payload));

      expect(result).toEqual({ deduplicated: false });
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "failed",
        "sync failed"
      );
    });

    it("should process unhandled event types without error", async () => {
      const payload = buildPayload({ type: "unknown.event.type" });
      const result = await service.handleWebhook(JSON.stringify(payload));

      expect(result).toEqual({ deduplicated: false });
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "processed"
      );
    });
  });

  // ==================== handleCatalogChange ====================

  describe("catalog.version.updated handler", () => {
    it("should trigger syncCatalog when merchant is found", async () => {
      const payload = buildPayload({ type: "catalog.version.updated" });
      await service.handleWebhook(JSON.stringify(payload));

      expect(mockMerchantFindFirst).toHaveBeenCalledWith({
        where: { id: MERCHANT_ID },
        select: { tenantId: true },
      });
      expect(mockSyncCatalog).toHaveBeenCalledWith(
        TENANT_ID,
        MERCHANT_ID
      );
    });

    it("should skip sync when merchant not found", async () => {
      mockMerchantFindFirst.mockResolvedValue(null);

      const payload = buildPayload({ type: "catalog.version.updated" });
      await service.handleWebhook(JSON.stringify(payload));

      expect(mockSyncCatalog).not.toHaveBeenCalled();
      // Should still mark as processed (no throw)
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "processed"
      );
    });

    it("should suppress ALREADY_RUNNING error from syncCatalog", async () => {
      mockSyncCatalog.mockRejectedValue(
        new Error("ALREADY_RUNNING: sync in progress")
      );

      const payload = buildPayload({ type: "catalog.version.updated" });
      await service.handleWebhook(JSON.stringify(payload));

      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "processed"
      );
    });
  });

  // ==================== handleOrderUpdate ====================

  describe("order.updated handler", () => {
    const orderPayload = buildPayload({
      type: "order.updated",
      data: {
        type: "order",
        id: "sq-order-1",
        object: {
          order: {
            id: "sq-order-1",
            fulfillments: [{ state: "PREPARED" }],
          },
        },
      },
    });

    it("should update fulfillment status when mapping exists", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });

      await service.handleWebhook(JSON.stringify(orderPayload));

      expect(mockGetIdMappingByExternalId).toHaveBeenCalledWith(
        TENANT_ID,
        "SQUARE",
        "sq-order-1"
      );
      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: expect.objectContaining({
          fulfillmentStatus: "ready",
          readyAt: expect.any(Date),
        }),
      });
    });

    it("should skip when no mapping found for order", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue(null);

      await service.handleWebhook(JSON.stringify(orderPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "processed"
      );
    });

    it("should skip when no fulfillment state present", async () => {
      const noFulfillmentPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: { id: "sq-order-1" },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(noFulfillmentPayload));

      expect(mockGetIdMappingByExternalId).not.toHaveBeenCalled();
      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should skip when fulfillment state is unknown", async () => {
      const unknownStatePayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "UNKNOWN_STATE" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(unknownStatePayload));

      expect(mockGetIdMappingByExternalId).not.toHaveBeenCalled();
      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should not regress fulfillment status when stale webhook arrives", async () => {
      // Order is already confirmed; a stale PROPOSED (→ pending) webhook
      // must not walk it back to pending.
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "confirmed",
      });

      const staleProposedPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "PROPOSED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(staleProposedPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should not rewrite when incoming status matches current", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "ready",
      });

      // Incoming PREPARED maps to ready — same as current.
      await service.handleWebhook(JSON.stringify(orderPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should not re-advance confirmed order when Square echoes RESERVED", async () => {
      // After plovr sets confirmed and pushes RESERVED to Square, Square will
      // echo the state back via order.updated. Reverse-mapping to confirmed
      // + equal-rank guard ensures we don't spuriously promote the order to
      // preparing or rewrite confirmedAt.
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "confirmed",
      });

      const reservedPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "RESERVED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(reservedPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should not regress preparing to confirmed when Square echoes RESERVED", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "preparing",
      });

      const reservedPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "RESERVED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(reservedPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should advance pending → confirmed when Square accepts order", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "pending",
      });

      const reservedPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "RESERVED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(reservedPayload));

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: expect.objectContaining({
          fulfillmentStatus: "confirmed",
          confirmedAt: expect.any(Date),
        }),
      });
    });

    it("should skip when internal order row is missing", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue(null);

      await service.handleWebhook(JSON.stringify(orderPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should treat unknown current status as -1 rank (always advances)", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "weird-legacy-value",
        status: "completed",
      });

      await service.handleWebhook(JSON.stringify(orderPayload));

      expect(mockOrderUpdate).toHaveBeenCalled();
    });

    it("should mark order canceled on CANCELED fulfillment state", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({ status: "completed" });

      const canceledPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [
                {
                  state: "CANCELED",
                  pickup_details: { cancel_reason: "Customer no-show" },
                },
              ],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(canceledPayload));

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: {
          status: "canceled",
          cancelledAt: expect.any(Date),
          cancelReason: "Customer no-show",
        },
      });
    });

    it("should default cancel reason when pickup_details.cancel_reason missing", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({ status: "completed" });

      const canceledPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "CANCELED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(canceledPayload));

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: expect.objectContaining({
          status: "canceled",
          cancelReason: "Canceled on Square POS",
        }),
      });
    });

    it("should mark order canceled on FAILED fulfillment state", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({ status: "completed" });

      const failedPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "FAILED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(failedPayload));

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: expect.objectContaining({
          status: "canceled",
          cancelReason: "Fulfillment failed on Square",
        }),
      });
    });

    it("should honor cancellation even when order was already ready (overrides rank)", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "ready",
        status: "completed",
      });

      const canceledPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "CANCELED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(canceledPayload));

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: expect.objectContaining({ status: "canceled" }),
      });
    });

    it("should be idempotent: no write when order already canceled", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({ status: "canceled" });

      const canceledPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "CANCELED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(canceledPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should skip CANCELED when internal order row is missing", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue(null);

      const canceledPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "CANCELED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(canceledPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should not resurrect a canceled order via forward-progress webhook", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "pending",
        status: "canceled",
      });

      // PREPARED → ready would advance rank — but order is canceled.
      await service.handleWebhook(JSON.stringify(orderPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });
  });

  // ==================== handlePaymentEvent ====================

  describe("payment.completed handler", () => {
    const paymentPayload = buildPayload({
      type: "payment.completed",
      data: {
        type: "payment",
        id: "sq-payment-1",
        object: {
          payment: {
            id: "sq-payment-1",
            order_id: "sq-order-1",
            status: "COMPLETED",
          },
        },
      },
    });

    it("should mark order as completed when payment is COMPLETED", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });

      await service.handleWebhook(JSON.stringify(paymentPayload));

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: expect.objectContaining({
          status: "completed",
          paidAt: expect.any(Date),
        }),
      });
    });

    it("should mark order as canceled when payment is FAILED", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });

      const failedPayload = buildPayload({
        type: "payment.completed",
        data: {
          type: "payment",
          id: "sq-payment-1",
          object: {
            payment: {
              id: "sq-payment-1",
              order_id: "sq-order-1",
              status: "FAILED",
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(failedPayload));

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: expect.objectContaining({
          status: "canceled",
          cancelledAt: expect.any(Date),
          cancelReason: "Payment failed on Square",
        }),
      });
    });

    it("should skip when no order_id in payment event", async () => {
      const noOrderPayload = buildPayload({
        type: "payment.completed",
        data: {
          type: "payment",
          id: "sq-payment-1",
          object: {
            payment: {
              id: "sq-payment-1",
              status: "COMPLETED",
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(noOrderPayload));

      expect(mockGetIdMappingByExternalId).not.toHaveBeenCalled();
      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should skip when no mapping found for order", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue(null);

      await service.handleWebhook(JSON.stringify(paymentPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "processed"
      );
    });

    it("should not update order when payment status is neither COMPLETED nor FAILED", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });

      const pendingPayload = buildPayload({
        type: "payment.updated",
        data: {
          type: "payment",
          id: "sq-payment-1",
          object: {
            payment: {
              id: "sq-payment-1",
              order_id: "sq-order-1",
              status: "PENDING",
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(pendingPayload));

      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });
  });

  describe("handler error branch coverage", () => {
    it("should handle non-Error thrown by handler (Unknown error)", async () => {
      mockMerchantFindFirst.mockResolvedValue({ tenantId: "tenant-1" });
      mockSyncCatalog.mockRejectedValue("string-error");

      const payload = buildPayload({ type: "catalog.version.updated" });
      await service.handleWebhook(JSON.stringify(payload));

      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "failed",
        "Unknown error"
      );
    });

    it("should re-throw non-Error from syncCatalog if not ALREADY_RUNNING", async () => {
      mockMerchantFindFirst.mockResolvedValue({ tenantId: "tenant-1" });
      mockSyncCatalog.mockRejectedValue("some non-Error");

      const payload = buildPayload({ type: "catalog.version.updated" });

      // The non-Error thrown from handleCatalogChange gets caught by handleWebhook's outer catch
      // Since "some non-Error" is a string (not instanceof Error), message becomes ""
      // "" does not include "ALREADY_RUNNING", so it re-throws
      // Then the outer catch in handleWebhook catches it with "Unknown error"
      await service.handleWebhook(JSON.stringify(payload));

      expect(mockUpdateWebhookEventStatus).toHaveBeenCalledWith(
        "we-1",
        "failed",
        "Unknown error"
      );
    });
  });

  describe("order.updated handler - no timestamp field", () => {
    it("should not set timestamp field when status has no corresponding timestamp", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      // Current status is unknown (rank -1) so incoming pending still advances.
      mockOrderFindUnique.mockResolvedValue({
        fulfillmentStatus: "legacy-unknown",
      });

      const proposedPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              fulfillments: [{ state: "PROPOSED" }],
            },
          },
        },
      });

      await service.handleWebhook(JSON.stringify(proposedPayload));

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "internal-order-1" },
        data: { fulfillmentStatus: "pending" },
      });
    });
  });
});
