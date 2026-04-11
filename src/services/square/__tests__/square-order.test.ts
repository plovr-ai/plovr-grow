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

const mockOrderUpdate = vi.fn().mockResolvedValue({});
const mockOrderFindUnique = vi
  .fn()
  .mockResolvedValue({ squareOrderVersion: null });
vi.mock("@/lib/db", () => ({
  default: {
    order: {
      update: (...args: unknown[]) => mockOrderUpdate(...args),
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
    },
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

    it("should persist new Square version after successful update (#109)", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 5,
          fulfillments: [{ uid: "ff-uid-1" }],
        },
      });
      mockUpdate.mockResolvedValue({
        order: { id: "sq-order-1", version: 6 },
      });
      mockOrderFindUnique.mockResolvedValue({ squareOrderVersion: 5 });
      mockOrderUpdate.mockClear();

      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "ready"
      );

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { squareOrderVersion: 6 },
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

    it("should persist new Square version after successful cancel (#109)", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 7,
          fulfillments: [{ uid: "ff-uid-1", type: "PICKUP" }],
        },
      });
      mockUpdate.mockResolvedValue({
        order: { id: "sq-order-1", version: 8 },
      });
      mockOrderFindUnique.mockResolvedValue({ squareOrderVersion: 7 });
      mockOrderUpdate.mockClear();

      await service.cancelOrder(TENANT_ID, MERCHANT_ID, "order-1", "nope");

      expect(mockOrderUpdate).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { squareOrderVersion: 8 },
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

  describe("updateOrderStatus - edge cases", () => {
    it("should skip update when Square order has no fulfillment UID", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [{ uid: null }],
        },
      });

      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "preparing"
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should skip update when Square order has no fulfillments array", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [],
        },
      });

      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "preparing"
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should re-throw AppError when Square API throws AppError", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockRejectedValue(
        new AppError(ErrorCodes.SQUARE_ORDER_NOT_FOUND, undefined, 404)
      );

      await expect(
        service.updateOrderStatus(
          TENANT_ID,
          MERCHANT_ID,
          "order-1",
          "preparing"
        )
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_NOT_FOUND,
      });
    });

    it("should throw SQUARE_ORDER_NOT_FOUND when get returns no order", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({ order: null });

      await expect(
        service.updateOrderStatus(
          TENANT_ID,
          MERCHANT_ID,
          "order-1",
          "preparing"
        )
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_NOT_FOUND,
      });
    });
  });

  describe("cancelOrder - edge cases", () => {
    it("should skip cancel when Square order has no fulfillment UID", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [{ uid: null }],
        },
      });

      await service.cancelOrder(TENANT_ID, MERCHANT_ID, "order-1", "No reason");

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should throw SQUARE_ORDER_NOT_FOUND when get returns no order", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({ order: null });

      await expect(
        service.cancelOrder(TENANT_ID, MERCHANT_ID, "order-1")
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_NOT_FOUND,
      });
    });

    it("should re-throw AppError when cancel throws AppError", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockRejectedValue(
        new AppError(ErrorCodes.SQUARE_ORDER_NOT_FOUND, undefined, 404)
      );

      await expect(
        service.cancelOrder(TENANT_ID, MERCHANT_ID, "order-1")
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_NOT_FOUND,
      });
    });

    it("should not add pickupDetails for non-PICKUP fulfillment type", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [{ uid: "ff-uid-1", type: "DELIVERY" }],
        },
      });
      mockUpdate.mockResolvedValue({ order: { id: "sq-order-1" } });

      await service.cancelOrder(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "Customer requested"
      );

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.order.fulfillments[0].state).toBe("CANCELED");
      // pickupDetails should not be added for non-PICKUP types
      expect(updateCall.order.fulfillments[0].pickupDetails).toBeUndefined();
    });
  });

  describe("createOrder - edge cases", () => {
    it("should handle Square API returning no order ID", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({ order: { id: null } });

      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput)
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_PUSH_FAILED,
      });

      expect(mockUpdateSyncRecord).toHaveBeenCalledWith("sync-1", {
        status: "failed",
        errorMessage: "Square API returned no order ID",
      });
    });

    it("should re-throw AppError during order creation", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockRejectedValue(
        new AppError(ErrorCodes.SQUARE_MISSING_LOCATION, undefined, 400)
      );

      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput)
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_MISSING_LOCATION,
      });
    });

    it("should handle order with no version from Square", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-3", version: undefined },
      });

      const result = await service.createOrder(
        TENANT_ID,
        MERCHANT_ID,
        sampleInput
      );

      expect(result.squareOrderId).toBe("sq-order-3");
      expect(result.squareVersion).toBe(1); // defaults to 1
    });

    it("should build fulfillment with trimmed displayName when only firstName", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-4", version: 1 },
      });

      const inputNoLastName: SquareOrderPushInput = {
        ...sampleInput,
        customerLastName: "",
        customerEmail: undefined,
        notes: undefined,
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, inputNoLastName);

      const createCall = mockCreate.mock.calls[0][0];
      const fulfillment = createCall.order.fulfillments[0];
      expect(fulfillment.pickupDetails.recipient.displayName).toBe("John");
      expect(fulfillment.pickupDetails.recipient.emailAddress).toBeUndefined();
      expect(fulfillment.pickupDetails.note).toBeUndefined();
    });
  });

  describe("createOrder - production environment", () => {
    it("should use production environment when configured", async () => {
      const { squareConfig: configMock } = await import("../square.config");
      const origEnv = configMock.environment;
      (configMock as Record<string, unknown>).environment = "production";

      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-prod", version: 1 },
      });

      await service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput);

      (configMock as Record<string, unknown>).environment = origEnv;
    });
  });

  describe("createOrder - sync record non-Error thrown", () => {
    it("should handle non-Error thrown during createOrder", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockRejectedValue("string error");

      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput)
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_ORDER_PUSH_FAILED,
      });

      expect(mockUpdateSyncRecord).toHaveBeenCalledWith("sync-1", {
        status: "failed",
        errorMessage: "Unknown error",
      });
    });
  });

  describe("createOrder - resolveExternalIds branches", () => {
    it("should skip modifier lookup when no modifiers in any item", async () => {
      const inputNoModifiers: SquareOrderPushInput = {
        ...sampleInput,
        items: [
          {
            menuItemId: "item-1",
            name: "Simple Item",
            price: 5.00,
            quantity: 1,
            selectedModifiers: [],
          },
        ],
      };

      mockGetIdMappingsByInternalIds.mockResolvedValue([
        { internalId: "item-1", externalId: "sq-var-1" },
      ]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-5", version: 1 },
      });

      await service.createOrder(TENANT_ID, MERCHANT_ID, inputNoModifiers);

      // Should only be called once (for menu items), not twice (no modifiers to look up)
      expect(mockGetIdMappingsByInternalIds).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== orderMode → fulfillment type ====================

  describe("createOrder - fulfillment type by orderMode", () => {
    beforeEach(() => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-mode", version: 1 },
      });
    });

    it("should map pickup to PICKUP with pickupDetails", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "pickup",
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.type).toBe("PICKUP");
      expect(fulfillment.pickupDetails).toBeDefined();
      expect(fulfillment.deliveryDetails).toBeUndefined();
      expect(fulfillment.pickupDetails.note).toBe("Ring doorbell");
    });

    it("should map delivery to DELIVERY with recipient address", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "delivery",
        deliveryAddress: {
          street: "123 Main St",
          apt: "Apt 4B",
          city: "San Francisco",
          state: "CA",
          zipCode: "94103",
        },
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.type).toBe("DELIVERY");
      expect(fulfillment.deliveryDetails).toBeDefined();
      expect(fulfillment.pickupDetails).toBeUndefined();

      const recipient = fulfillment.deliveryDetails.recipient;
      expect(recipient.displayName).toBe("John Doe");
      expect(recipient.phoneNumber).toBe("(555) 123-4567");
      expect(recipient.emailAddress).toBe("john@example.com");
      expect(recipient.address.addressLine1).toBe("123 Main St");
      expect(recipient.address.addressLine2).toBe("Apt 4B");
      expect(recipient.address.locality).toBe("San Francisco");
      expect(recipient.address.administrativeDistrictLevel1).toBe("CA");
      expect(recipient.address.postalCode).toBe("94103");
      expect(recipient.address.country).toBe("US");
      expect(fulfillment.deliveryDetails.note).toBe("Ring doorbell");
    });

    it("should throw SQUARE_MISSING_DELIVERY_ADDRESS for delivery without address", async () => {
      await expect(
        service.createOrder(TENANT_ID, MERCHANT_ID, {
          ...sampleInput,
          orderMode: "delivery",
          deliveryAddress: null,
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.SQUARE_MISSING_DELIVERY_ADDRESS,
      });

      // The Square API should not be called on validation failure
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should map dine_in to PICKUP with 'Dine-in' note prefix", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "dine_in",
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.type).toBe("PICKUP");
      expect(fulfillment.pickupDetails.note).toBe("Dine-in: Ring doorbell");
    });

    it("should set 'Dine-in' note when dine_in order has no notes", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "dine_in",
        notes: undefined,
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.pickupDetails.note).toBe("Dine-in");
    });

    it("should append deliveryAddress.instructions to the delivery fulfillment note", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "delivery",
        notes: "Ring doorbell",
        deliveryAddress: {
          street: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zipCode: "94103",
          instructions: "Gate code 1234, leave at door",
        },
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.deliveryDetails.note).toBe(
        "Ring doorbell | Gate code 1234, leave at door"
      );
    });

    it("should fall back to only deliveryAddress.instructions when order notes missing", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "delivery",
        notes: undefined,
        deliveryAddress: {
          street: "123 Main St",
          city: "SF",
          state: "CA",
          zipCode: "94103",
          instructions: "Apt 4B back entrance",
        },
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.deliveryDetails.note).toBe("Apt 4B back entrance");
    });

    it("should handle delivery without optional apt field", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "delivery",
        deliveryAddress: {
          street: "456 Market St",
          city: "San Francisco",
          state: "CA",
          zipCode: "94103",
        },
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(
        fulfillment.deliveryDetails.recipient.address.addressLine2
      ).toBeUndefined();
    });
  });

  // ==================== cancel for DELIVERY ====================

  describe("cancelOrder - delivery fulfillment", () => {
    it("should attach cancelReason to deliveryDetails for DELIVERY fulfillment", async () => {
      mockGetIdMappingByInternalId.mockResolvedValue({
        externalId: "sq-order-1",
      });
      mockGet.mockResolvedValue({
        order: {
          id: "sq-order-1",
          locationId: "sq-loc-1",
          version: 2,
          fulfillments: [{ uid: "ff-uid-1", type: "DELIVERY" }],
        },
      });
      mockUpdate.mockResolvedValue({ order: { id: "sq-order-1" } });

      await service.cancelOrder(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "Driver unavailable"
      );

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.order.fulfillments[0].state).toBe("CANCELED");
      expect(updateCall.order.fulfillments[0].deliveryDetails.cancelReason).toBe(
        "Driver unavailable"
      );
      expect(updateCall.order.fulfillments[0].pickupDetails).toBeUndefined();
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
