import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const mockRouteEvent = vi.fn();

vi.mock("../square-webhook.service", () => ({
  squareWebhookService: {
    routeEvent: (...args: unknown[]) => mockRouteEvent(...args),
  },
}));

vi.mock("../square.config", () => ({
  squareConfig: {
    webhookSignatureKey: "test-webhook-key",
    webhookNotificationUrl: "https://example.com/api/integration/webhook/square",
  },
}));

import { SquareWebhookProvider } from "../square-webhook-provider";

function computeSignature(rawBody: string): string {
  const hmac = crypto.createHmac("sha256", "test-webhook-key");
  hmac.update("https://example.com/api/integration/webhook/square" + rawBody);
  return hmac.digest("base64");
}

describe("SquareWebhookProvider", () => {
  let provider: SquareWebhookProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new SquareWebhookProvider();
    mockRouteEvent.mockResolvedValue(undefined);
  });

  describe("type", () => {
    it("should be POS_SQUARE", () => {
      expect(provider.type).toBe("POS_SQUARE");
    });
  });

  // ==================== verifyWebhook ====================

  describe("verifyWebhook()", () => {
    it("should return true for a valid signature", () => {
      const body = '{"test":"data"}';
      const sig = computeSignature(body);
      const headers = { "x-square-hmacsha256-signature": sig };

      expect(provider.verifyWebhook(body, headers)).toBe(true);
    });

    it("should return false for an invalid signature", () => {
      const body = '{"test":"data"}';
      const wrongSig = Buffer.from("wrong-signature").toString("base64");
      const headers = { "x-square-hmacsha256-signature": wrongSig };

      expect(provider.verifyWebhook(body, headers)).toBe(false);
    });

    it("should return false when signature header is missing", () => {
      expect(provider.verifyWebhook('{"test":"data"}', {})).toBe(false);
    });

    it("should return false when body is tampered", () => {
      const body = '{"test":"data"}';
      const sig = computeSignature(body);
      const headers = { "x-square-hmacsha256-signature": sig };

      expect(provider.verifyWebhook('{"test":"tampered"}', headers)).toBe(false);
    });

    it("should return false when crypto throws (catch branch)", async () => {
      const { squareConfig } = await import("../square.config");
      const origKey = squareConfig.webhookSignatureKey;
      (squareConfig as Record<string, unknown>).webhookSignatureKey = null;

      const result = provider.verifyWebhook('{"test":"data"}', {
        "x-square-hmacsha256-signature": "somesig",
      });

      expect(result).toBe(false);
      (squareConfig as Record<string, unknown>).webhookSignatureKey = origKey;
    });
  });

  // ==================== parseWebhookEvent ====================

  describe("parseWebhookEvent()", () => {
    it("should parse Square payload into ParsedWebhookEvent", () => {
      const payload = {
        merchant_id: "sq-merchant-1",
        type: "catalog.version.updated",
        event_id: "evt-123",
        created_at: "2026-04-12T00:00:00Z",
        data: { type: "catalog", id: "cat-1" },
      };

      const result = provider.parseWebhookEvent(JSON.stringify(payload));

      expect(result).toEqual({
        eventId: "evt-123",
        eventType: "catalog.version.updated",
        externalAccountId: "sq-merchant-1",
        rawPayload: payload,
      });
    });
  });

  // ==================== handleWebhookEvent ====================

  describe("handleWebhookEvent()", () => {
    it("should delegate to squareWebhookService.routeEvent", async () => {
      const rawPayload = {
        merchant_id: "sq-merchant-1",
        type: "order.updated",
        event_id: "evt-456",
        created_at: "2026-04-12T00:00:00Z",
        data: { type: "order", id: "order-1" },
      };

      const event = {
        eventId: "evt-456",
        eventType: "order.updated",
        externalAccountId: "sq-merchant-1",
        rawPayload,
      };

      const connection = {
        tenantId: "tenant-1",
        merchantId: "merchant-1",
        id: "conn-1",
      };

      await provider.handleWebhookEvent(event, connection);

      expect(mockRouteEvent).toHaveBeenCalledWith(
        "order.updated",
        rawPayload,
        connection
      );
    });
  });
});
