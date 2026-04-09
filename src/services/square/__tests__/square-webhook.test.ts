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

vi.mock("@/lib/db", () => ({
  default: {
    merchant: {
      findFirst: (...args: unknown[]) => mockMerchantFindFirst(...args),
    },
    order: {
      update: (...args: unknown[]) => mockOrderUpdate(...args),
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
  hmac.update("https://example.com/api/webhooks/square" + rawBody);
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
    mockMerchantFindFirst.mockResolvedValue({ companyId: "company-1" });
    mockSyncCatalog.mockResolvedValue({});
    mockGetIdMappingByExternalId.mockResolvedValue(null);
    mockOrderUpdate.mockResolvedValue({});
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
      mockMerchantFindFirst.mockResolvedValue({ companyId: "company-1" });
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
        select: { companyId: true },
      });
      expect(mockSyncCatalog).toHaveBeenCalledWith(
        TENANT_ID,
        MERCHANT_ID,
        "company-1"
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
  });
});
