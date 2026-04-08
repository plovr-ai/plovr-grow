import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquareOrderService } from "../square-order.service";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { SquareOrderPushInput } from "../square.types";

// Mock Square SDK
const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("square", () => {
  class MockSquareClient {
    orders = {
      create: mockCreate,
      get: mockGet,
      update: mockUpdate,
    };
  }
  return {
    SquareClient: MockSquareClient,
    SquareEnvironment: {
      Sandbox: "sandbox",
      Production: "production",
    },
  };
});

// Mock integration repository
const mockGetConnection = vi.fn();
const mockUpsertIdMapping = vi.fn();
const mockCreateSyncRecord = vi.fn();
const mockUpdateSyncRecord = vi.fn();
const mockGetIdMappingByInternalId = vi.fn();
const mockGetIdMappingsByInternalIds = vi.fn();

vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
    upsertIdMapping: (...args: unknown[]) => mockUpsertIdMapping(...args),
    createSyncRecord: (...args: unknown[]) => mockCreateSyncRecord(...args),
    updateSyncRecord: (...args: unknown[]) => mockUpdateSyncRecord(...args),
    getIdMappingByInternalId: (...args: unknown[]) => mockGetIdMappingByInternalId(...args),
    getIdMappingsByInternalIds: (...args: unknown[]) => mockGetIdMappingsByInternalIds(...args),
  },
}));

vi.mock("../square.config", () => ({
  squareConfig: {
    environment: "sandbox",
    appId: "test-app-id",
    appSecret: "test-secret",
  },
}));

const TENANT_ID = "tenant-1";
const MERCHANT_ID = "merchant-1";

const mockConnection = {
  id: "conn-1",
  externalLocationId: "sq-loc-1",
  accessToken: "access-token-123",
  refreshToken: "refresh-token-456",
  tokenExpiresAt: new Date("2026-12-31"),
  status: "active",
};

const sampleInput: SquareOrderPushInput = {
  orderId: "order-1",
  orderNumber: "ORD-001",
  customerFirstName: "John",
  customerLastName: "Doe",
  customerPhone: "(555) 123-4567",
  customerEmail: "john@example.com",
  orderMode: "pickup",
  totalAmount: 25.99,
  items: [
    {
      menuItemId: "item-1",
      name: "Chicken Sandwich",
      price: 9.99,
      quantity: 2,
      selectedModifiers: [
        {
          modifierId: "mod-1",
          modifierName: "Extra Cheese",
          price: 1.50,
          quantity: 1,
        },
      ],
      specialInstructions: "No pickles",
    },
    {
      menuItemId: "item-2",
      name: "French Fries",
      price: 4.99,
      quantity: 1,
      selectedModifiers: [],
    },
  ],
  notes: "Ring doorbell",
};

describe("SquareOrderService", () => {
  let service: SquareOrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SquareOrderService();

    // Default mock setup
    mockGetConnection.mockResolvedValue(mockConnection);
    mockCreateSyncRecord.mockResolvedValue({ id: "sync-1" });
    mockUpdateSyncRecord.mockResolvedValue(undefined);
    mockUpsertIdMapping.mockResolvedValue(undefined);
    mockGetIdMappingsByInternalIds.mockResolvedValue([]);
  });

  // ==================== createOrder ====================

  describe("createOrder", () => {
    it("should create a Square order with correct line items and fulfillment", async () => {
      mockGetIdMappingsByInternalIds.mockImplementation(
        (_tenantId: string, _source: string, _type: string, _ids: string[], externalType?: string) => {
          if (externalType === "ITEM_VARIATION") {
            return Promise.resolve([
              { internalId: "item-1", externalId: "sq-var-1" },
              { internalId: "item-2", externalId: "sq-var-2" },
            ]);
          }
          if (externalType === "MODIFIER") {
            return Promise.resolve([
              { internalId: "mod-1", externalId: "sq-mod-1" },
            ]);
          }
          return Promise.resolve([]);
        }
      );

      mockCreate.mockResolvedValue({
        order: {
          id: "sq-order-1",
          version: 1,
        },
      });

      const result = await service.createOrder(
        TENANT_ID,
        MERCHANT_ID,
        sampleInput
      );

      expect(result).toEqual({
        squareOrderId: "sq-order-1",
        squareVersion: 1,
      });

      // Verify Square API was called correctly
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.locationId).toBe("sq-loc-1");
      expect(createCall.order.referenceId).toBe("order-1");
      expect(createCall.order.ticketName).toBe("ORD-001");
      expect(createCall.order.lineItems).toHaveLength(2);

      // Check first line item
      const lineItem1 = createCall.order.lineItems[0];
      expect(lineItem1.name).toBe("Chicken Sandwich");
      expect(lineItem1.quantity).toBe("2");
      expect(lineItem1.basePriceMoney.amount).toBe(BigInt(999));
      expect(lineItem1.catalogObjectId).toBe("sq-var-1");
      expect(lineItem1.note).toBe("No pickles");
      expect(lineItem1.modifiers).toHaveLength(1);
      expect(lineItem1.modifiers[0].catalogObjectId).toBe("sq-mod-1");
      expect(lineItem1.modifiers[0].name).toBe("Extra Cheese");
      expect(lineItem1.modifiers[0].basePriceMoney.amount).toBe(BigInt(150));

      // Check second line item (no modifiers)
      const lineItem2 = createCall.order.lineItems[1];
      expect(lineItem2.name).toBe("French Fries");
      expect(lineItem2.quantity).toBe("1");
      expect(lineItem2.catalogObjectId).toBe("sq-var-2");
      expect(lineItem2.modifiers).toBeUndefined();

      // Check fulfillment
      const fulfillment = createCall.order.fulfillments[0];
      expect(fulfillment.type).toBe("PICKUP");
      expect(fulfillment.state).toBe("PROPOSED");
      expect(fulfillment.pickupDetails.recipient.displayName).toBe("John Doe");
      expect(fulfillment.pickupDetails.recipient.phoneNumber).toBe(
        "(555) 123-4567"
      );
      expect(fulfillment.pickupDetails.recipient.emailAddress).toBe(
        "john@example.com"
      );

      // Verify idempotency key is set
      expect(createCall.idempotencyKey).toBeTruthy();

      // Verify ID mapping was stored
      expect(mockUpsertIdMapping).toHaveBeenCalledWith(TENANT_ID, {
        internalType: "Order",
        internalId: "order-1",
        externalSource: "SQUARE",
        externalType: "ORDER",
        externalId: "sq-order-1",
      });

      // Verify sync record was updated as success
      expect(mockUpdateSyncRecord).toHaveBeenCalledWith("sync-1", {
        status: "success",
        objectsSynced: 1,
        objectsMapped: 1,
      });
    });

    it("should handle items without catalog mapping (ad-hoc line items)", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-2", version: 1 },
      });

      const result = await service.createOrder(
        TENANT_ID,
        MERCHANT_ID,
        sampleInput
      );

      expect(result.squareOrderId).toBe("sq-order-2");

      const createCall = mockCreate.mock.calls[0][0];
      // Line items should still be created without catalogObjectId
      expect(createCall.order.lineItems[0].catalogObjectId).toBeUndefined();
      expect(createCall.order.lineItems[0].name).toBe("Chicken Sandwich");
    });

    it("should throw when no Square connection exists", async () => {
      mockGetConnection.mockResolvedValue(null);

      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput)
      ).rejects.toThrow(AppError);

      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput)
      ).rejects.toMatchObject({
        code: ErrorCodes.INTEGRATION_NOT_CONNECTED,
      });
    });

    it("should throw when no access token", async () => {
      mockGetConnection.mockResolvedValue({
        ...mockConnection,
        accessToken: null,
      });

      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput)
      ).rejects.toThrow(AppError);
    });

    it("should throw when no location configured", async () => {
      mockGetConnection.mockResolvedValue({
        ...mockConnection,
        externalLocationId: null,
      });

      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput)
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_MISSING_LOCATION,
      });
    });

    it("should handle Square API failure and update sync record", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockRejectedValue(new Error("Square API error"));

      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput)
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_PUSH_FAILED,
      });

      // Sync record should be marked as failed
      expect(mockUpdateSyncRecord).toHaveBeenCalledWith("sync-1", {
        status: "failed",
        errorMessage: "Square API error",
      });
    });
  });

  // ==================== updateOrderStatus ====================

  describe("updateOrderStatus", () => {
    it("should update fulfillment state to RESERVED for preparing status", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [{ uid: "ff-uid-1", state: "PROPOSED" }],
        },
      });
      mockUpdate.mockResolvedValue({ order: { id: "sq-order-1" } });

      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "preparing"
      );

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.orderId).toBe("sq-order-1");
      expect(updateCall.order.version).toBe(2);
      expect(updateCall.order.fulfillments[0].uid).toBe("ff-uid-1");
      expect(updateCall.order.fulfillments[0].state).toBe("RESERVED");
    });

    it("should map ready status to PREPARED", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 3,
          fulfillments: [{ uid: "ff-uid-1" }],
        },
      });
      mockUpdate.mockResolvedValue({ order: { id: "sq-order-1" } });

      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "ready"
      );

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.order.fulfillments[0].state).toBe("PREPARED");
    });

    it("should map fulfilled status to COMPLETED", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 4,
          fulfillments: [{ uid: "ff-uid-1" }],
        },
      });
      mockUpdate.mockResolvedValue({ order: { id: "sq-order-1" } });

      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "fulfilled"
      );

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.order.fulfillments[0].state).toBe("COMPLETED");
    });

    it("should skip if order was never pushed to Square", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue(null);

      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "preparing"
      );

      expect(mockGet).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should skip for unknown status", async () => {
      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "unknown_status"
      );

      expect(mockGetIdMappingByInternalId).not.toHaveBeenCalled();
    });

    it("should throw on Square API failure", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockRejectedValue(new Error("API error"));

      await expect(
        service.updateOrderStatus(
          TENANT_ID,
          MERCHANT_ID,
          "order-1",
          "preparing"
        )
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_UPDATE_FAILED,
      });
    });
  });

  // ==================== cancelOrder ====================

  describe("cancelOrder", () => {
    it("should cancel order with reason", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [{ uid: "ff-uid-1", type: "PICKUP" }],
        },
      });
      mockUpdate.mockResolvedValue({ order: { id: "sq-order-1" } });

      await service.cancelOrder(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "Customer requested cancellation"
      );

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.order.fulfillments[0].state).toBe("CANCELED");
      expect(updateCall.order.fulfillments[0].pickupDetails.cancelReason).toBe(
        "Customer requested cancellation"
      );
    });

    it("should cancel order without reason", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [{ uid: "ff-uid-1", type: "PICKUP" }],
        },
      });
      mockUpdate.mockResolvedValue({ order: { id: "sq-order-1" } });

      await service.cancelOrder(TENANT_ID, MERCHANT_ID, "order-1");

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.order.fulfillments[0].state).toBe("CANCELED");
    });

    it("should skip if order was never pushed to Square", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue(null);

      await service.cancelOrder(TENANT_ID, MERCHANT_ID, "order-1");

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should throw on Square API failure", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockRejectedValue(new Error("API error"));

      await expect(
        service.cancelOrder(TENANT_ID, MERCHANT_ID, "order-1")
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_CANCEL_FAILED,
      });
    });

    it("should truncate cancel reason to 100 characters", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [{ uid: "ff-uid-1", type: "PICKUP" }],
        },
      });
      mockUpdate.mockResolvedValue({ order: { id: "sq-order-1" } });

      const longReason = "A".repeat(200);
      await service.cancelOrder(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        longReason
      );

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(
        updateCall.order.fulfillments[0].pickupDetails.cancelReason.length
      ).toBe(100);
    });
  });

  // ==================== generateIdempotencyKey ====================

  describe("generateIdempotencyKey", () => {
    it("should generate deterministic key for same inputs", () => {
      const key1 = service.generateIdempotencyKey("t1", "m1", "o1");
      const key2 = service.generateIdempotencyKey("t1", "m1", "o1");
      expect(key1).toBe(key2);
    });

    it("should generate different keys for different inputs", () => {
      const key1 = service.generateIdempotencyKey("t1", "m1", "o1");
      const key2 = service.generateIdempotencyKey("t1", "m1", "o2");
      const key3 = service.generateIdempotencyKey("t2", "m1", "o1");
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it("should return UUID-like format", () => {
      const key = service.generateIdempotencyKey("t1", "m1", "o1");
      const parts = key.split("-");
      expect(parts).toHaveLength(5);
      expect(parts[0]).toHaveLength(8);
      expect(parts[1]).toHaveLength(4);
      expect(parts[2]).toHaveLength(4);
      expect(parts[3]).toHaveLength(4);
      expect(parts[4]).toHaveLength(12);
    });
  });
});
