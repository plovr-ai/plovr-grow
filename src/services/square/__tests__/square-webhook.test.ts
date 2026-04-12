import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockGetIdMappingByExternalId = vi.fn();
const mockMarkWebhookEventProcessed = vi.fn();
const mockFindRetryableWebhookEvents = vi.fn();
const mockClaimWebhookEventForRetry = vi.fn();
const mockScheduleWebhookEventRetry = vi.fn();
const mockMarkWebhookEventDeadLetter = vi.fn();

vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    getIdMappingByExternalId: (...args: unknown[]) =>
      mockGetIdMappingByExternalId(...args),
    markWebhookEventProcessed: (...args: unknown[]) =>
      mockMarkWebhookEventProcessed(...args),
    findRetryableWebhookEvents: (...args: unknown[]) =>
      mockFindRetryableWebhookEvents(...args),
    claimWebhookEventForRetry: (...args: unknown[]) =>
      mockClaimWebhookEventForRetry(...args),
    scheduleWebhookEventRetry: (...args: unknown[]) =>
      mockScheduleWebhookEventRetry(...args),
    markWebhookEventDeadLetter: (...args: unknown[]) =>
      mockMarkWebhookEventDeadLetter(...args),
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
    webhookNotificationUrl: "https://example.com/api/integration/webhook/square",
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

const mockUpdatePaymentStatus = vi.fn();
const mockCancelOrder = vi.fn();

vi.mock("@/services/order/order.service", () => ({
  orderService: {
    updatePaymentStatus: (...args: unknown[]) => mockUpdatePaymentStatus(...args),
    cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
  },
}));

const mockGetFulfillmentByOrderId = vi.fn();
const mockTransitionStatus = vi.fn();
const mockBumpExternalVersion = vi.fn();

vi.mock("@/services/order/fulfillment.service", () => ({
  fulfillmentService: {
    getFulfillmentByOrderId: (...args: unknown[]) => mockGetFulfillmentByOrderId(...args),
    transitionStatus: (...args: unknown[]) => mockTransitionStatus(...args),
    bumpExternalVersion: (...args: unknown[]) => mockBumpExternalVersion(...args),
  },
}));

import { SquareWebhookService } from "../square-webhook.service";
import type { SquareWebhookPayload } from "../square.types";

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
): SquareWebhookPayload {
  return {
    merchant_id: "sq-merchant-1",
    type: "catalog.version.updated",
    event_id: "evt-1",
    created_at: "2026-04-09T00:00:00Z",
    data: { type: "catalog", id: "cat-1" },
    ...overrides,
  } as SquareWebhookPayload;
}

describe("SquareWebhookService", () => {
  let service: SquareWebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SquareWebhookService();

    // Default mocks
    mockFindRetryableWebhookEvents.mockResolvedValue([]);
    mockClaimWebhookEventForRetry.mockResolvedValue(true);
    mockScheduleWebhookEventRetry.mockResolvedValue({});
    mockMarkWebhookEventDeadLetter.mockResolvedValue({});
    mockMarkWebhookEventProcessed.mockResolvedValue({});
    mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
    mockSyncCatalog.mockResolvedValue({});
    mockGetIdMappingByExternalId.mockResolvedValue(null);
    mockOrderUpdate.mockResolvedValue({});
    mockOrderFindUnique.mockResolvedValue({
      status: "completed",
    });
    mockGetFulfillmentByOrderId.mockResolvedValue({
      id: "ful-1",
      status: "pending",
      externalVersion: null,
      merchantId: MERCHANT_ID,
      orderId: "internal-order-1",
    });
    mockTransitionStatus.mockResolvedValue(undefined);
    mockBumpExternalVersion.mockResolvedValue(undefined);
    mockUpdatePaymentStatus.mockResolvedValue(undefined);
    mockCancelOrder.mockResolvedValue(undefined);
  });

  // ==================== routeEvent (catalog) ====================

  describe("catalog.version.updated handler", () => {
    it("should trigger syncCatalog when merchant is found", async () => {
      const payload = buildPayload({ type: "catalog.version.updated" });
      await service.routeEvent("catalog.version.updated", payload, mockConnection);

      expect(mockMerchantFindFirst).toHaveBeenCalledWith({
        where: { id: MERCHANT_ID },
        select: { tenantId: true },
      });
      expect(mockSyncCatalog).toHaveBeenCalledWith(
        TENANT_ID,
        MERCHANT_ID,
        true
      );
    });

    it("should skip sync when merchant not found", async () => {
      mockMerchantFindFirst.mockResolvedValue(null);

      const payload = buildPayload({ type: "catalog.version.updated" });
      await service.routeEvent("catalog.version.updated", payload, mockConnection);

      expect(mockSyncCatalog).not.toHaveBeenCalled();
    });

    it("should suppress ALREADY_RUNNING error from syncCatalog", async () => {
      mockSyncCatalog.mockRejectedValue(
        new Error("ALREADY_RUNNING: sync in progress")
      );

      const payload = buildPayload({ type: "catalog.version.updated" });
      // Should not throw
      await service.routeEvent("catalog.version.updated", payload, mockConnection);
    });

    it("should re-throw non-ALREADY_RUNNING errors", async () => {
      mockSyncCatalog.mockRejectedValue(new Error("some other error"));

      const payload = buildPayload({ type: "catalog.version.updated" });
      await expect(
        service.routeEvent("catalog.version.updated", payload, mockConnection)
      ).rejects.toThrow("some other error");
    });
  });

  // ==================== routeEvent (order) ====================

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

      await service.routeEvent("order.updated", orderPayload, mockConnection);

      expect(mockGetIdMappingByExternalId).toHaveBeenCalledWith(
        TENANT_ID,
        "SQUARE",
        "sq-order-1"
      );
      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "ready",
          source: "square_webhook",
        })
      );
    });

    it("should skip when no mapping found for order", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue(null);

      await service.routeEvent("order.updated", orderPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
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

      await service.routeEvent("order.updated", noFulfillmentPayload, mockConnection);

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

      await service.routeEvent("order.updated", unknownStatePayload, mockConnection);

      expect(mockGetIdMappingByExternalId).not.toHaveBeenCalled();
      expect(mockOrderUpdate).not.toHaveBeenCalled();
    });

    it("should not regress fulfillment status when stale webhook arrives", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "confirmed",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
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

      await service.routeEvent("order.updated", staleProposedPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
    });

    it("should not rewrite when incoming status matches current", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "ready",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });

      await service.routeEvent("order.updated", orderPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
    });

    it("should not re-advance confirmed order when Square echoes RESERVED", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "confirmed",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
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

      await service.routeEvent("order.updated", reservedPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
    });

    it("should not regress preparing to confirmed when Square echoes RESERVED", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "preparing",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
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

      await service.routeEvent("order.updated", reservedPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
    });

    it("should advance pending -> confirmed when Square accepts order", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "pending",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
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

      await service.routeEvent("order.updated", reservedPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "confirmed",
          source: "square_webhook",
        })
      );
    });

    it("should skip when internal order row is missing", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue(null);

      await service.routeEvent("order.updated", orderPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
    });

    it("should treat unknown current status as -1 rank (always advances)", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "weird-legacy-value",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      await service.routeEvent("order.updated", orderPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalled();
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

      await service.routeEvent("order.updated", canceledPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "canceled",
          source: "square_webhook",
          metadata: { cancelReason: "Customer no-show" },
        })
      );
      expect(mockCancelOrder).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        "Customer no-show",
        expect.objectContaining({ source: "square_webhook" })
      );
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

      await service.routeEvent("order.updated", canceledPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "canceled",
          source: "square_webhook",
          metadata: { cancelReason: "Canceled on Square POS" },
        })
      );
      expect(mockCancelOrder).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        "Canceled on Square POS",
        expect.objectContaining({ source: "square_webhook" })
      );
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

      await service.routeEvent("order.updated", failedPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "canceled",
          source: "square_webhook",
          metadata: { cancelReason: "Fulfillment failed on Square" },
        })
      );
      expect(mockCancelOrder).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        "Fulfillment failed on Square",
        expect.objectContaining({ source: "square_webhook" })
      );
    });

    it("should honor cancellation even when order was already ready (overrides rank)", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "ready",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
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

      await service.routeEvent("order.updated", canceledPayload, mockConnection);

      expect(mockCancelOrder).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        "Canceled on Square POS",
        expect.objectContaining({ source: "square_webhook" })
      );
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

      await service.routeEvent("order.updated", canceledPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
      expect(mockCancelOrder).not.toHaveBeenCalled();
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

      await service.routeEvent("order.updated", canceledPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
      expect(mockCancelOrder).not.toHaveBeenCalled();
    });

    it("should not resurrect a canceled order via forward-progress webhook", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "pending",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "canceled",
      });

      await service.routeEvent("order.updated", orderPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
    });

    // ==================== Out-of-order / version guard (#109) ====================

    it("should drop a webhook whose version is <= stored version", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "preparing",
        externalVersion: 5,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      const staleVersionPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 3,
              fulfillments: [{ state: "PREPARED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", staleVersionPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
    });

    it("should drop a webhook whose version equals stored version", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "pending",
        externalVersion: 5,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      const samePayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 5,
              fulfillments: [{ state: "PREPARED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", samePayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
    });

    it("should apply webhook when incoming version > stored version and bump the stored version", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "preparing",
        externalVersion: 5,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      const freshPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 8,
              fulfillments: [{ state: "PREPARED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", freshPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "ready",
          source: "square_webhook",
          externalVersion: 8,
        })
      );
    });

    it("should bump stored version even on equal-rank no-op when incoming version is newer", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "ready",
        externalVersion: 5,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      const samePayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 7,
              fulfillments: [{ state: "PREPARED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", samePayload, mockConnection);

      expect(mockBumpExternalVersion).toHaveBeenCalledWith("ful-1", 7);
    });

    it("should fall back to legacy behavior when payload omits version", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "preparing",
        externalVersion: 5,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      await service.routeEvent("order.updated", orderPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "ready",
          source: "square_webhook",
        })
      );
    });

    it("should accept any valid version when stored version is null", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "preparing",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      const payloadWithVersion = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 2,
              fulfillments: [{ state: "PREPARED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", payloadWithVersion, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "ready",
          source: "square_webhook",
          externalVersion: 2,
        })
      );
    });

    it("should apply CANCELED with version bump", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "confirmed",
        externalVersion: 3,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      const cancelPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 4,
              fulfillments: [{ state: "CANCELED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", cancelPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "canceled",
          source: "square_webhook",
          externalVersion: 4,
        })
      );
      expect(mockCancelOrder).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        "Canceled on Square POS",
        expect.objectContaining({ source: "square_webhook" })
      );
    });

    it("should drop stale CANCELED webhook", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "ready",
        externalVersion: 10,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      const staleCancelPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 4,
              fulfillments: [{ state: "CANCELED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", staleCancelPayload, mockConnection);

      expect(mockTransitionStatus).not.toHaveBeenCalled();
      expect(mockCancelOrder).not.toHaveBeenCalled();
    });

    // ==================== Version bump on no-op branches ====================

    it("should bump squareOrderVersion on regressive-rank skip", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "ready",
        externalVersion: 5,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
      });

      const regressivePayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 10,
              fulfillments: [{ state: "PROPOSED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", regressivePayload, mockConnection);

      expect(mockBumpExternalVersion).toHaveBeenCalledTimes(1);
      expect(mockBumpExternalVersion).toHaveBeenCalledWith("ful-1", 10);
    });

    it("should bump squareOrderVersion when dropping a CANCELED on already-canceled order", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "ready",
        externalVersion: 5,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "canceled",
      });

      const cancelPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 9,
              fulfillments: [{ state: "CANCELED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", cancelPayload, mockConnection);

      expect(mockBumpExternalVersion).toHaveBeenCalledTimes(1);
      expect(mockBumpExternalVersion).toHaveBeenCalledWith("ful-1", 9);
    });

    it("should bump squareOrderVersion when dropping forward-progress webhook for canceled order", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "pending",
        externalVersion: 5,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "canceled",
      });

      const forwardPayload = buildPayload({
        type: "order.updated",
        data: {
          type: "order",
          id: "sq-order-1",
          object: {
            order: {
              id: "sq-order-1",
              version: 11,
              fulfillments: [{ state: "PREPARED" }],
            },
          },
        },
      });

      await service.routeEvent("order.updated", forwardPayload, mockConnection);

      expect(mockBumpExternalVersion).toHaveBeenCalledTimes(1);
      expect(mockBumpExternalVersion).toHaveBeenCalledWith("ful-1", 11);
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

      await service.routeEvent("payment.completed", paymentPayload, mockConnection);

      expect(mockUpdatePaymentStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        "completed",
        expect.objectContaining({ source: "square_webhook" })
      );
    });

    it("should mark order as payment_failed when payment is FAILED", async () => {
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

      await service.routeEvent("payment.completed", failedPayload, mockConnection);

      expect(mockUpdatePaymentStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        "payment_failed",
        expect.objectContaining({ source: "square_webhook" })
      );
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

      await service.routeEvent("payment.completed", noOrderPayload, mockConnection);

      expect(mockGetIdMappingByExternalId).not.toHaveBeenCalled();
      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    });

    it("should skip when no mapping found for order", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue(null);

      await service.routeEvent("payment.completed", paymentPayload, mockConnection);

      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
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

      await service.routeEvent("payment.updated", pendingPayload, mockConnection);

      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe("unhandled event type", () => {
    it("should not throw for unhandled event types", async () => {
      const payload = buildPayload({ type: "unknown.event.type" });
      await service.routeEvent("unknown.event.type", payload, mockConnection);
      // No assertion needed — just verifying it doesn't throw.
    });
  });

  describe("order.updated handler - no timestamp field", () => {
    it("should delegate pending status update to FulfillmentService even without timestamp field", async () => {
      mockGetIdMappingByExternalId.mockResolvedValue({
        internalId: "internal-order-1",
      });
      // Current status is unknown (rank -1) so incoming pending still advances.
      mockGetFulfillmentByOrderId.mockResolvedValue({
        id: "ful-1",
        status: "legacy-unknown",
        externalVersion: null,
        merchantId: MERCHANT_ID,
        orderId: "internal-order-1",
      });
      mockOrderFindUnique.mockResolvedValue({
        status: "completed",
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

      await service.routeEvent("order.updated", proposedPayload, mockConnection);

      expect(mockTransitionStatus).toHaveBeenCalledWith(
        TENANT_ID,
        "internal-order-1",
        expect.objectContaining({
          fulfillmentStatus: "pending",
          source: "square_webhook",
        })
      );
    });
  });

  // ==================== retryFailedEvents ====================

  describe("retryFailedEvents()", () => {
    const FAILED_CATALOG_EVENT = {
      id: "we-failed-1",
      tenantId: TENANT_ID,
      merchantId: MERCHANT_ID,
      connectionId: CONNECTION_ID,
      eventId: "evt-failed-1",
      eventType: "catalog.version.updated",
      payload: {
        merchant_id: "sq-merchant-1",
        type: "catalog.version.updated",
        event_id: "evt-failed-1",
        created_at: "2026-04-11T00:00:00Z",
        data: { type: "catalog", id: "cat-1" },
      },
      status: "failed",
      retryCount: 0,
      nextRetryAt: new Date("2026-04-11T00:01:00Z"),
      errorMessage: "boom",
    };

    it("should return zeros when there are no retryable events", async () => {
      mockFindRetryableWebhookEvents.mockResolvedValue([]);

      const result = await service.retryFailedEvents();

      expect(result).toEqual({ processed: 0, retried: 0, deadLettered: 0 });
      expect(mockClaimWebhookEventForRetry).not.toHaveBeenCalled();
    });

    it("should mark event as processed on successful retry", async () => {
      mockFindRetryableWebhookEvents.mockResolvedValue([FAILED_CATALOG_EVENT]);
      mockClaimWebhookEventForRetry.mockResolvedValue(true);
      mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
      mockSyncCatalog.mockResolvedValue({});

      const result = await service.retryFailedEvents();

      expect(mockClaimWebhookEventForRetry).toHaveBeenCalledWith(
        "we-failed-1",
        expect.any(Date)
      );
      expect(mockSyncCatalog).toHaveBeenCalledWith(TENANT_ID, MERCHANT_ID, true);
      expect(mockMarkWebhookEventProcessed).toHaveBeenCalledWith("we-failed-1");
      expect(result).toEqual({ processed: 1, retried: 0, deadLettered: 0 });
    });

    it("should skip events that cannot be claimed (concurrent worker)", async () => {
      mockFindRetryableWebhookEvents.mockResolvedValue([FAILED_CATALOG_EVENT]);
      mockClaimWebhookEventForRetry.mockResolvedValue(false);

      const result = await service.retryFailedEvents();

      expect(mockSyncCatalog).not.toHaveBeenCalled();
      expect(mockMarkWebhookEventProcessed).not.toHaveBeenCalled();
      expect(mockScheduleWebhookEventRetry).not.toHaveBeenCalled();
      expect(result).toEqual({ processed: 0, retried: 0, deadLettered: 0 });
    });

    it("should reschedule retry with incremented retryCount when handler still fails", async () => {
      mockFindRetryableWebhookEvents.mockResolvedValue([
        { ...FAILED_CATALOG_EVENT, retryCount: 2 },
      ]);
      mockClaimWebhookEventForRetry.mockResolvedValue(true);
      mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
      mockSyncCatalog.mockRejectedValue(new Error("still broken"));

      const result = await service.retryFailedEvents();

      expect(mockScheduleWebhookEventRetry).toHaveBeenCalledWith(
        "we-failed-1",
        3,
        expect.any(Date),
        "still broken"
      );
      expect(mockMarkWebhookEventDeadLetter).not.toHaveBeenCalled();
      expect(result).toEqual({ processed: 0, retried: 1, deadLettered: 0 });
    });

    it("should move to dead_letter after reaching MAX_RETRIES", async () => {
      mockFindRetryableWebhookEvents.mockResolvedValue([
        { ...FAILED_CATALOG_EVENT, retryCount: 4 },
      ]);
      mockClaimWebhookEventForRetry.mockResolvedValue(true);
      mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
      mockSyncCatalog.mockRejectedValue(new Error("still broken"));

      const result = await service.retryFailedEvents();

      expect(mockMarkWebhookEventDeadLetter).toHaveBeenCalledWith(
        "we-failed-1",
        "still broken"
      );
      expect(mockScheduleWebhookEventRetry).not.toHaveBeenCalled();
      expect(result).toEqual({ processed: 0, retried: 0, deadLettered: 1 });
    });

    it("should pass a future lease expiry to claimWebhookEventForRetry", async () => {
      mockFindRetryableWebhookEvents.mockResolvedValue([FAILED_CATALOG_EVENT]);
      mockClaimWebhookEventForRetry.mockResolvedValue(true);
      mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
      mockSyncCatalog.mockResolvedValue({});

      const before = Date.now();
      await service.retryFailedEvents();
      const after = Date.now();

      expect(mockClaimWebhookEventForRetry).toHaveBeenCalledTimes(1);
      const call = mockClaimWebhookEventForRetry.mock.calls[0];
      expect(call[0]).toBe("we-failed-1");
      const leaseExpiresAt = call[1] as Date;
      expect(leaseExpiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 10 * 60 * 1000
      );
      expect(leaseExpiresAt.getTime()).toBeLessThanOrEqual(
        after + 10 * 60 * 1000 + 1000
      );
    });

    it("should retry a stuck 'processing' event surfaced by findRetryableWebhookEvents", async () => {
      const staleEvent = {
        ...FAILED_CATALOG_EVENT,
        id: "we-stuck",
        status: "processing",
        retryCount: 1,
      };
      mockFindRetryableWebhookEvents.mockResolvedValue([staleEvent]);
      mockClaimWebhookEventForRetry.mockResolvedValue(true);
      mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
      mockSyncCatalog.mockResolvedValue({});

      const result = await service.retryFailedEvents();

      expect(mockClaimWebhookEventForRetry).toHaveBeenCalledWith(
        "we-stuck",
        expect.any(Date)
      );
      expect(mockMarkWebhookEventProcessed).toHaveBeenCalledWith("we-stuck");
      expect(result).toEqual({ processed: 1, retried: 0, deadLettered: 0 });
    });

    it("should handle a mixed batch (success + retry + dead_letter)", async () => {
      const successEvent = { ...FAILED_CATALOG_EVENT, id: "we-a", retryCount: 0 };
      const retryEvent = { ...FAILED_CATALOG_EVENT, id: "we-b", retryCount: 1 };
      const deadEvent = { ...FAILED_CATALOG_EVENT, id: "we-c", retryCount: 4 };
      mockFindRetryableWebhookEvents.mockResolvedValue([
        successEvent,
        retryEvent,
        deadEvent,
      ]);
      mockClaimWebhookEventForRetry.mockResolvedValue(true);
      mockMerchantFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
      mockSyncCatalog
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockRejectedValueOnce(new Error("fail 3"));

      const result = await service.retryFailedEvents();

      expect(result).toEqual({ processed: 1, retried: 1, deadLettered: 1 });
      expect(mockMarkWebhookEventProcessed).toHaveBeenCalledWith("we-a");
      expect(mockScheduleWebhookEventRetry).toHaveBeenCalledWith(
        "we-b",
        2,
        expect.any(Date),
        "fail 2"
      );
      expect(mockMarkWebhookEventDeadLetter).toHaveBeenCalledWith(
        "we-c",
        "fail 3"
      );
    });
  });

  // ==================== computeNextRetryAt ====================

  describe("computeNextRetryAt", () => {
    it("should use exponential backoff capped at MAX_DELAY_MS", async () => {
      const { computeNextRetryAt, WEBHOOK_RETRY_POLICY } = await import(
        "../square.types"
      );
      const now = new Date("2026-04-11T12:00:00Z");

      expect(
        computeNextRetryAt(0, now).getTime() - now.getTime()
      ).toBe(WEBHOOK_RETRY_POLICY.BASE_DELAY_MS);
      expect(
        computeNextRetryAt(1, now).getTime() - now.getTime()
      ).toBe(WEBHOOK_RETRY_POLICY.BASE_DELAY_MS * 2);
      expect(
        computeNextRetryAt(4, now).getTime() - now.getTime()
      ).toBe(WEBHOOK_RETRY_POLICY.BASE_DELAY_MS * 16);
      expect(
        computeNextRetryAt(20, now).getTime() - now.getTime()
      ).toBe(WEBHOOK_RETRY_POLICY.MAX_DELAY_MS);
    });
  });
});
