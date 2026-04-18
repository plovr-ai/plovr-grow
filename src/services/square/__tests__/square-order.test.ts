import { describe, it, expect, vi, beforeEach } from "vitest";
import { squareOrderService } from "../square-order.service";
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

const mockBumpExternalVersionByOrderIdIfNewer = vi
  .fn()
  .mockResolvedValue({ count: 1 });

vi.mock("@/repositories/fulfillment.repository", () => ({
  fulfillmentRepository: {
    bumpExternalVersionByOrderIdIfNewer: (...args: unknown[]) =>
      mockBumpExternalVersionByOrderIdIfNewer(...args),
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
  taxAmount: 2.31,
  tipAmount: 3.00,
  deliveryFee: 0,
  discount: 0,
  items: [
    {
      menuItemId: "item-1",
      name: "Chicken Sandwich",
      price: 9.99,
      quantity: 2,
      selectedModifiers: [
        {
          modifierId: "mod-1",
          groupName: "Extras",
          modifierName: "Extra Cheese",
          price: 1.50,
          quantity: 1,
        },
      ],
      specialInstructions: "No pickles",
      taxes: [
        {
          taxConfigId: "tax-1",
          name: "Sales Tax",
          rate: 0.08875,
          roundingMethod: "half_up" as const,
          inclusionType: "additive" as const,
        },
      ],
    },
    {
      menuItemId: "item-2",
      name: "French Fries",
      price: 4.99,
      quantity: 1,
      selectedModifiers: [],
      taxes: [
        {
          taxConfigId: "tax-1",
          name: "Sales Tax",
          rate: 0.08875,
          roundingMethod: "half_up" as const,
          inclusionType: "additive" as const,
        },
      ],
    },
  ],
  notes: "Ring doorbell",
};

describe("SquareOrderService", () => {
  const service = squareOrderService;

  beforeEach(() => {
    vi.clearAllMocks();

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
        (_tenantId: string, _source: string, internalType: string, _ids: string[], externalType?: string) => {
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
          if (internalType === "TaxConfig" && externalType === "TAX") {
            return Promise.resolve([
              { internalId: "tax-1", externalId: "sq-tax-1" },
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
      expect(lineItem1.modifiers[0].name).toBe("Extras: Extra Cheese");
      expect(lineItem1.modifiers[0].basePriceMoney.amount).toBe(BigInt(150));

      // Check appliedTaxes on first line item (has taxes)
      expect(lineItem1.appliedTaxes).toHaveLength(1);
      expect(lineItem1.appliedTaxes[0].taxUid).toBe("tax-1");

      // Check second line item (no modifiers)
      const lineItem2 = createCall.order.lineItems[1];
      expect(lineItem2.name).toBe("French Fries");
      expect(lineItem2.quantity).toBe("1");
      expect(lineItem2.catalogObjectId).toBe("sq-var-2");
      expect(lineItem2.modifiers).toBeUndefined();

      // Check appliedTaxes on second line item (also has taxes)
      expect(lineItem2.appliedTaxes).toHaveLength(1);
      expect(lineItem2.appliedTaxes[0].taxUid).toBe("tax-1");

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

      // Check taxes (P0-2: tax configs mapped to Square catalog)
      expect(createCall.order.taxes).toHaveLength(1);
      expect(createCall.order.taxes[0]).toMatchObject({
        uid: "tax-1",
        name: "Sales Tax",
        type: "ADDITIVE",
        percentage: "8.8750",
        scope: "LINE_ITEM",
        catalogObjectId: "sq-tax-1",
      });

      // Check service charges (tip)
      expect(createCall.order.serviceCharges).toHaveLength(1);
      expect(createCall.order.serviceCharges[0]).toMatchObject({
        uid: "tip",
        name: "Tip",
        type: "CUSTOM",
        calculationPhase: "TOTAL_PHASE",
        taxable: false,
      });
      expect(createCall.order.serviceCharges[0].amountMoney.amount).toBe(BigInt(300));

      // No discounts for this input
      expect(createCall.order.discounts).toBeUndefined();

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

  // ==================== buildTaxes / buildServiceCharges / buildDiscounts ====================

  describe("order amount mapping (P0-1, P0-2)", () => {
    beforeEach(() => {
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-1", version: 1 },
      });
    });

    it("should build taxes from item tax configs with catalog mapping", async () => {
      mockGetIdMappingsByInternalIds.mockImplementation(
        (_t: string, _s: string, internalType: string, _ids: string[], externalType?: string) => {
          if (internalType === "TaxConfig" && externalType === "TAX") {
            return Promise.resolve([
              { internalId: "tax-1", externalId: "sq-tax-1" },
            ]);
          }
          return Promise.resolve([]);
        }
      );

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        items: [
          {
            menuItemId: "item-1",
            name: "Burger",
            price: 10,
            quantity: 1,
            selectedModifiers: [],
            taxes: [
              { taxConfigId: "tax-1", name: "Sales Tax", rate: 0.08875, roundingMethod: "half_up" as const, inclusionType: "additive" as const },
            ],
          },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.taxes).toHaveLength(1);
      expect(createCall.order.taxes[0]).toMatchObject({
        uid: "tax-1",
        name: "Sales Tax",
        type: "ADDITIVE",
        percentage: "8.8750",
        scope: "LINE_ITEM",
        catalogObjectId: "sq-tax-1",
      });
    });

    it("should build taxes without catalog mapping (ad-hoc taxes)", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        items: [
          {
            menuItemId: "item-1",
            name: "Burger",
            price: 10,
            quantity: 1,
            selectedModifiers: [],
            taxes: [
              { taxConfigId: "tax-99", name: "City Tax", rate: 0.025, roundingMethod: "half_up" as const, inclusionType: "additive" as const },
            ],
          },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.taxes).toHaveLength(1);
      expect(createCall.order.taxes[0].catalogObjectId).toBeUndefined();
      expect(createCall.order.taxes[0].name).toBe("City Tax");
      expect(createCall.order.taxes[0].percentage).toBe("2.5000");
    });

    it("should deduplicate taxes across items", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const sharedTax = { taxConfigId: "tax-1", name: "Sales Tax", rate: 0.08875, roundingMethod: "half_up" as const, inclusionType: "additive" as const };
      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        items: [
          { menuItemId: "i1", name: "A", price: 5, quantity: 1, selectedModifiers: [], taxes: [sharedTax] },
          { menuItemId: "i2", name: "B", price: 3, quantity: 1, selectedModifiers: [], taxes: [sharedTax] },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.taxes).toHaveLength(1);
    });

    it("should handle inclusive tax type", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        items: [
          {
            menuItemId: "i1",
            name: "A",
            price: 10,
            quantity: 1,
            selectedModifiers: [],
            taxes: [
              { taxConfigId: "tax-inc", name: "VAT", rate: 0.1, roundingMethod: "half_up" as const, inclusionType: "inclusive" as const },
            ],
          },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.taxes[0].type).toBe("INCLUSIVE");
    });

    it("should omit taxes when no items have tax info", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        taxAmount: 0,
        tipAmount: 0,
        items: [
          { menuItemId: "i1", name: "A", price: 5, quantity: 1, selectedModifiers: [] },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.taxes).toBeUndefined();
    });

    it("should only apply tax to items that carry it (mixed-tax order)", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        items: [
          {
            menuItemId: "i1",
            name: "Taxable Item",
            price: 10,
            quantity: 1,
            selectedModifiers: [],
            taxes: [
              { taxConfigId: "tax-1", name: "Sales Tax", rate: 0.08875, roundingMethod: "half_up" as const, inclusionType: "additive" as const },
            ],
          },
          {
            menuItemId: "i2",
            name: "Tax-Exempt Item",
            price: 5,
            quantity: 1,
            selectedModifiers: [],
            // No taxes
          },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      // Tax is LINE_ITEM scoped, so Square only applies it to items with appliedTaxes
      expect(createCall.order.taxes).toHaveLength(1);
      expect(createCall.order.taxes[0].scope).toBe("LINE_ITEM");

      // Taxable item has appliedTaxes reference
      expect(createCall.order.lineItems[0].appliedTaxes).toHaveLength(1);
      expect(createCall.order.lineItems[0].appliedTaxes[0].taxUid).toBe("tax-1");

      // Tax-exempt item has no appliedTaxes
      expect(createCall.order.lineItems[1].appliedTaxes).toBeUndefined();
    });

    it("should build tip service charge", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 5.5,
        deliveryFee: 0,
        items: [
          { menuItemId: "i1", name: "A", price: 10, quantity: 1, selectedModifiers: [] },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.serviceCharges).toHaveLength(1);
      expect(createCall.order.serviceCharges[0]).toMatchObject({
        uid: "tip",
        name: "Tip",
        type: "CUSTOM",
        calculationPhase: "TOTAL_PHASE",
        taxable: false,
      });
      expect(createCall.order.serviceCharges[0].amountMoney.amount).toBe(BigInt(550));
      expect(createCall.order.serviceCharges[0].amountMoney.currency).toBe("USD");
    });

    it("should build delivery fee service charge", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        deliveryFee: 3.99,
        items: [
          { menuItemId: "i1", name: "A", price: 10, quantity: 1, selectedModifiers: [] },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.serviceCharges).toHaveLength(1);
      expect(createCall.order.serviceCharges[0]).toMatchObject({
        uid: "delivery-fee",
        name: "Delivery Fee",
        type: "CUSTOM",
        calculationPhase: "TOTAL_PHASE",
        taxable: false,
      });
      expect(createCall.order.serviceCharges[0].amountMoney.amount).toBe(BigInt(399));
    });

    it("should build both tip and delivery fee", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 2,
        deliveryFee: 3.99,
        items: [
          { menuItemId: "i1", name: "A", price: 10, quantity: 1, selectedModifiers: [] },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.serviceCharges).toHaveLength(2);
      expect(createCall.order.serviceCharges[0].uid).toBe("tip");
      expect(createCall.order.serviceCharges[1].uid).toBe("delivery-fee");
    });

    it("should omit service charges when tip and delivery fee are both 0", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        deliveryFee: 0,
        items: [
          { menuItemId: "i1", name: "A", price: 10, quantity: 1, selectedModifiers: [] },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.serviceCharges).toBeUndefined();
    });

    it("should build discount", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        discount: 5.0,
        items: [
          { menuItemId: "i1", name: "A", price: 20, quantity: 1, selectedModifiers: [] },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.discounts).toHaveLength(1);
      expect(createCall.order.discounts[0]).toMatchObject({
        uid: "discount",
        name: "Discount",
        type: "FIXED_AMOUNT",
        scope: "ORDER",
      });
      expect(createCall.order.discounts[0].amountMoney.amount).toBe(BigInt(500));
    });

    it("should omit discounts when discount is 0", async () => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);

      const input: SquareOrderPushInput = {
        ...sampleInput,
        tipAmount: 0,
        discount: 0,
        items: [
          { menuItemId: "i1", name: "A", price: 10, quantity: 1, selectedModifiers: [] },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.discounts).toBeUndefined();
    });

    it("should build all amount fields together (tax + tip + delivery + discount)", async () => {
      mockGetIdMappingsByInternalIds.mockImplementation(
        (_t: string, _s: string, internalType: string, _ids: string[], externalType?: string) => {
          if (internalType === "TaxConfig" && externalType === "TAX") {
            return Promise.resolve([{ internalId: "tax-1", externalId: "sq-tax-1" }]);
          }
          return Promise.resolve([]);
        }
      );

      const input: SquareOrderPushInput = {
        ...sampleInput,
        taxAmount: 1.77,
        tipAmount: 4.0,
        deliveryFee: 3.99,
        discount: 2.5,
        items: [
          {
            menuItemId: "i1",
            name: "Combo",
            price: 20,
            quantity: 1,
            selectedModifiers: [],
            taxes: [
              { taxConfigId: "tax-1", name: "Sales Tax", rate: 0.08875, roundingMethod: "half_up" as const, inclusionType: "additive" as const },
            ],
          },
        ],
      };

      await service.createOrder(TENANT_ID, MERCHANT_ID, input);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.order.taxes).toHaveLength(1);
      expect(createCall.order.serviceCharges).toHaveLength(2);
      expect(createCall.order.discounts).toHaveLength(1);
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
      mockBumpExternalVersionByOrderIdIfNewer.mockClear();

      await service.updateOrderStatus(
        TENANT_ID,
        MERCHANT_ID,
        "order-1",
        "ready"
      );

      expect(mockBumpExternalVersionByOrderIdIfNewer).toHaveBeenCalledWith(
        "order-1",
        6
      );
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
      mockBumpExternalVersionByOrderIdIfNewer.mockClear();

      await service.cancelOrder(TENANT_ID, MERCHANT_ID, "order-1", "nope");

      expect(mockBumpExternalVersionByOrderIdIfNewer).toHaveBeenCalledWith(
        "order-1",
        8
      );
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

  describe("createOrder - modifier display name with group prefix", () => {
    it("should prepend groupName to modifier name when groupName is set", async () => {
      const inputWithGroup: SquareOrderPushInput = {
        ...sampleInput,
        items: [
          {
            menuItemId: "item-1",
            name: "Burger",
            price: 10,
            quantity: 1,
            selectedModifiers: [
              {
                modifierId: "mod-1",
                groupName: "Size",
                modifierName: "Large",
                price: 2,
                quantity: 1,
              },
            ],
          },
        ],
      };

      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-grp", version: 1 },
      });

      await service.createOrder(TENANT_ID, MERCHANT_ID, inputWithGroup);

      const createCall = mockCreate.mock.calls[0][0];
      const modifier = createCall.order.lineItems[0].modifiers[0];
      expect(modifier.name).toBe("Size: Large");
    });

    it("should use modifier name only when groupName is empty string", async () => {
      const inputNoGroup: SquareOrderPushInput = {
        ...sampleInput,
        items: [
          {
            menuItemId: "item-1",
            name: "Burger",
            price: 10,
            quantity: 1,
            selectedModifiers: [
              {
                modifierId: "mod-1",
                groupName: "",
                modifierName: "Extra Sauce",
                price: 0.5,
                quantity: 1,
              },
            ],
          },
        ],
      };

      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-nogrp", version: 1 },
      });

      await service.createOrder(TENANT_ID, MERCHANT_ID, inputNoGroup);

      const createCall = mockCreate.mock.calls[0][0];
      const modifier = createCall.order.lineItems[0].modifiers[0];
      expect(modifier.name).toBe("Extra Sauce");
    });

    it("should format multiple modifiers with different groups correctly", async () => {
      const inputMultiGroup: SquareOrderPushInput = {
        ...sampleInput,
        items: [
          {
            menuItemId: "item-1",
            name: "Coffee",
            price: 5,
            quantity: 1,
            selectedModifiers: [
              {
                modifierId: "mod-size",
                groupName: "Size",
                modifierName: "Large",
                price: 1,
                quantity: 1,
              },
              {
                modifierId: "mod-milk",
                groupName: "Milk",
                modifierName: "Oat Milk",
                price: 0.5,
                quantity: 1,
              },
              {
                modifierId: "mod-extra",
                groupName: "",
                modifierName: "Extra Shot",
                price: 0.75,
                quantity: 1,
              },
            ],
          },
        ],
      };

      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-multi", version: 1 },
      });

      await service.createOrder(TENANT_ID, MERCHANT_ID, inputMultiGroup);

      const createCall = mockCreate.mock.calls[0][0];
      const modifiers = createCall.order.lineItems[0].modifiers;
      expect(modifiers).toHaveLength(3);
      expect(modifiers[0].name).toBe("Size: Large");
      expect(modifiers[1].name).toBe("Milk: Oat Milk");
      expect(modifiers[2].name).toBe("Extra Shot");
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

    it("should resolve modifiers via ModifierOption type first, then fall back to MenuItem", async () => {
      // Simulate the new ModifierOption mapping existing for mod-1
      mockGetIdMappingsByInternalIds.mockImplementation(
        (_tenantId: string, _source: string, internalType: string, ids: string[], externalType?: string) => {
          // Menu item variations
          if (internalType === "MenuItem" && externalType === "ITEM_VARIATION") {
            return Promise.resolve([
              { internalId: "item-1", externalId: "sq-var-1" },
              { internalId: "item-2", externalId: "sq-var-2" },
            ]);
          }
          // New path: ModifierOption + MODIFIER
          if (internalType === "ModifierOption" && externalType === "MODIFIER") {
            if (ids.includes("mod-1")) {
              return Promise.resolve([
                { internalId: "mod-1", externalId: "sq-mod-new-1" },
              ]);
            }
            return Promise.resolve([]);
          }
          // ModifierOption + ITEM_VARIATION (for variation-based modifiers)
          if (internalType === "ModifierOption" && externalType === "ITEM_VARIATION") {
            return Promise.resolve([]);
          }
          // Legacy fallback: MenuItem + MODIFIER (should not be reached for mod-1)
          if (internalType === "MenuItem" && externalType === "MODIFIER") {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }
      );

      mockCreate.mockResolvedValue({
        order: { id: "sq-order-mod", version: 1 },
      });

      await service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput);

      // Verify the modifier was resolved
      const createCall = mockCreate.mock.calls[0][0];
      const lineItem1 = createCall.order.lineItems[0];
      expect(lineItem1.modifiers[0].catalogObjectId).toBe("sq-mod-new-1");
    });

    it("should fall back to legacy MenuItem mapping for unresolved modifiers", async () => {
      mockGetIdMappingsByInternalIds.mockImplementation(
        (_tenantId: string, _source: string, internalType: string, ids: string[], externalType?: string) => {
          if (internalType === "MenuItem" && externalType === "ITEM_VARIATION") {
            return Promise.resolve([
              { internalId: "item-1", externalId: "sq-var-1" },
              { internalId: "item-2", externalId: "sq-var-2" },
            ]);
          }
          // New path returns nothing
          if (internalType === "ModifierOption" && externalType === "MODIFIER") {
            return Promise.resolve([]);
          }
          if (internalType === "ModifierOption" && externalType === "ITEM_VARIATION") {
            return Promise.resolve([]);
          }
          // Legacy fallback returns the mapping
          if (internalType === "MenuItem" && externalType === "MODIFIER") {
            if (ids.includes("mod-1")) {
              return Promise.resolve([
                { internalId: "mod-1", externalId: "sq-mod-legacy-1" },
              ]);
            }
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }
      );

      mockCreate.mockResolvedValue({
        order: { id: "sq-order-legacy", version: 1 },
      });

      await service.createOrder(TENANT_ID, MERCHANT_ID, sampleInput);

      const createCall = mockCreate.mock.calls[0][0];
      const lineItem1 = createCall.order.lineItems[0];
      expect(lineItem1.modifiers[0].catalogObjectId).toBe("sq-mod-legacy-1");
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
    const baseInput: SquareOrderPushInput = {
      orderId: "o1",
      orderNumber: "ORD-1",
      customerFirstName: "Jane",
      customerLastName: "Doe",
      customerPhone: "555-0100",
      customerEmail: "jane@example.com",
      orderMode: "pickup",
      totalAmount: 12.5,
      taxAmount: 1.11,
      tipAmount: 0,
      deliveryFee: 0,
      discount: 0,
      notes: "",
      items: [
        {
          menuItemId: "item-1",
          name: "Coffee",
          price: 4.5,
          quantity: 1,
          selectedModifiers: [],
        },
      ],
    };

    it("should generate deterministic key for identical content (transient retry)", () => {
      const key1 = service.generateIdempotencyKey("t1", "m1", baseInput);
      const key2 = service.generateIdempotencyKey("t1", "m1", baseInput);
      expect(key1).toBe(key2);
    });

    it("should differ when tenant or merchant changes", () => {
      const base = service.generateIdempotencyKey("t1", "m1", baseInput);
      expect(service.generateIdempotencyKey("t2", "m1", baseInput)).not.toBe(
        base
      );
      expect(service.generateIdempotencyKey("t1", "m2", baseInput)).not.toBe(
        base
      );
    });

    it("should differ when orderId changes", () => {
      const a = service.generateIdempotencyKey("t1", "m1", baseInput);
      const b = service.generateIdempotencyKey("t1", "m1", {
        ...baseInput,
        orderId: "o2",
      });
      expect(a).not.toBe(b);
    });

    it("should differ when totalAmount changes (retry after repricing)", () => {
      const a = service.generateIdempotencyKey("t1", "m1", baseInput);
      const b = service.generateIdempotencyKey("t1", "m1", {
        ...baseInput,
        totalAmount: 13.0,
      });
      expect(a).not.toBe(b);
    });

    it("should differ when items change (retry after fixing line items)", () => {
      const a = service.generateIdempotencyKey("t1", "m1", baseInput);
      const b = service.generateIdempotencyKey("t1", "m1", {
        ...baseInput,
        items: [
          ...baseInput.items,
          {
            menuItemId: "item-2",
            name: "Muffin",
            price: 3,
            quantity: 1,
            selectedModifiers: [],
          },
        ],
      });
      expect(a).not.toBe(b);
    });

    it("should differ when a modifier changes", () => {
      const a = service.generateIdempotencyKey("t1", "m1", baseInput);
      const b = service.generateIdempotencyKey("t1", "m1", {
        ...baseInput,
        items: [
          {
            ...baseInput.items[0],
            selectedModifiers: [
              {
                modifierId: "mod-1",
                groupName: "Size",
                modifierName: "Large",
                price: 1,
                quantity: 1,
              },
            ],
          },
        ],
      });
      expect(a).not.toBe(b);
    });

    it("should differ when customerPhone changes", () => {
      const a = service.generateIdempotencyKey("t1", "m1", baseInput);
      const b = service.generateIdempotencyKey("t1", "m1", {
        ...baseInput,
        customerPhone: "555-9999",
      });
      expect(a).not.toBe(b);
    });

    it("should treat null notes and empty string as equivalent", () => {
      const a = service.generateIdempotencyKey("t1", "m1", {
        ...baseInput,
        notes: undefined,
      });
      const b = service.generateIdempotencyKey("t1", "m1", {
        ...baseInput,
        notes: "",
      });
      expect(a).toBe(b);
    });

    it("should return UUID-like format", () => {
      const key = service.generateIdempotencyKey("t1", "m1", baseInput);
      const parts = key.split("-");
      expect(parts).toHaveLength(5);
      expect(parts[0]).toHaveLength(8);
      expect(parts[1]).toHaveLength(4);
      expect(parts[2]).toHaveLength(4);
      expect(parts[3]).toHaveLength(4);
      expect(parts[4]).toHaveLength(12);
    });

    it("should differ when scheduledAt is provided vs absent", () => {
      const a = service.generateIdempotencyKey("t1", "m1", baseInput);
      const b = service.generateIdempotencyKey("t1", "m1", {
        ...baseInput,
        scheduledAt: new Date("2026-06-15T18:30:00Z"),
      });
      expect(a).not.toBe(b);
    });
  });

  // ==================== scheduled pickup (#106) ====================

  describe("createOrder - scheduled pickup (#106)", () => {
    beforeEach(() => {
      mockGetIdMappingsByInternalIds.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        order: { id: "sq-order-sched", version: 1 },
      });
    });

    it("should set scheduleType ASAP and omit pickupAt when scheduledAt is absent", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "pickup",
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.pickupDetails.scheduleType).toBe("ASAP");
      expect(fulfillment.pickupDetails.pickupAt).toBeUndefined();
    });

    it("should set scheduleType SCHEDULED and pickupAt when scheduledAt is provided", async () => {
      const scheduledTime = new Date("2026-06-15T18:30:00.000Z");

      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "pickup",
        scheduledAt: scheduledTime,
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.pickupDetails.scheduleType).toBe("SCHEDULED");
      expect(fulfillment.pickupDetails.pickupAt).toBe("2026-06-15T18:30:00.000Z");
    });

    it("should set scheduleType SCHEDULED and deliverAt for delivery orders", async () => {
      const scheduledTime = new Date("2026-06-15T19:00:00.000Z");

      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "delivery",
        scheduledAt: scheduledTime,
        deliveryAddress: {
          street: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zipCode: "94103",
        },
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.deliveryDetails.scheduleType).toBe("SCHEDULED");
      expect(fulfillment.deliveryDetails.deliverAt).toBe("2026-06-15T19:00:00.000Z");
    });

    it("should set scheduleType ASAP for delivery orders without scheduledAt", async () => {
      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "delivery",
        deliveryAddress: {
          street: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zipCode: "94103",
        },
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.deliveryDetails.scheduleType).toBe("ASAP");
      expect(fulfillment.deliveryDetails.deliverAt).toBeUndefined();
    });

    it("should set scheduleType SCHEDULED for dine_in with scheduledAt", async () => {
      const scheduledTime = new Date("2026-06-15T20:00:00.000Z");

      await service.createOrder(TENANT_ID, MERCHANT_ID, {
        ...sampleInput,
        orderMode: "dine_in",
        scheduledAt: scheduledTime,
      });

      const fulfillment = mockCreate.mock.calls[0][0].order.fulfillments[0];
      expect(fulfillment.type).toBe("PICKUP");
      expect(fulfillment.pickupDetails.scheduleType).toBe("SCHEDULED");
      expect(fulfillment.pickupDetails.pickupAt).toBe("2026-06-15T20:00:00.000Z");
    });
  });
});
