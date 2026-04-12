import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  OrderPaidEvent,
  FulfillmentStatusChangedEvent,
  OrderCancelledEvent,
} from "@/services/order/order-events.types";

const mockGetActivePosConnection = vi.fn();
const mockCreateFailedSyncRecordForRetry = vi.fn();
vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    getActivePosConnection: (...args: unknown[]) =>
      mockGetActivePosConnection(...args),
    createFailedSyncRecordForRetry: (...args: unknown[]) =>
      mockCreateFailedSyncRecordForRetry(...args),
  },
}));

const mockPushOrder = vi.fn();
const mockUpdateFulfillment = vi.fn();
const mockCancelOrder = vi.fn();
const mockGetProvider = vi.fn((_type: string) => ({
  pushOrder: (...args: unknown[]) => mockPushOrder(...args),
  updateFulfillment: (...args: unknown[]) =>
    mockUpdateFulfillment(...args),
  cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
}));
vi.mock("../pos-provider-registry", () => ({
  posProviderRegistry: {
    getProvider: (type: string) => mockGetProvider(type),
  },
}));

const mockGetOrder = vi.fn();
vi.mock("@/services/order/order.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/order/order.service")>();
  return {
    ...actual,
    orderService: {
      getOrder: (...args: unknown[]) => mockGetOrder(...args),
    },
  };
});

const mockOn = vi.fn();
vi.mock("@/services/order/order-events", () => ({
  orderEventEmitter: {
    on: (...args: unknown[]) => mockOn(...args),
  },
}));

import {
  registerOrderEventHandlers,
  unregisterOrderEventHandlers,
} from "../order-listener";

const TENANT_ID = "tenant-1";
const MERCHANT_ID = "merchant-1";

const sampleItems = [
  {
    menuItemId: "item-1",
    name: "Coffee",
    price: 4.5,
    quantity: 1,
    totalPrice: 4.5,
    selectedModifiers: [],
  },
];

/** Prisma-shaped OrderItem rows matching sampleItems (plain numbers work with Number()) */
const sampleOrderItems = [
  {
    id: "oi-1",
    orderId: "order-1",
    menuItemId: "item-1",
    name: "Coffee",
    unitPrice: 4.5,
    quantity: 1,
    totalPrice: 4.5,
    notes: null,
    imageUrl: null,
    taxes: null,
    sortOrder: 0,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    modifiers: [],
  },
];

function makeEvent(overrides: Partial<OrderPaidEvent> = {}): OrderPaidEvent {
  return {
    orderId: "order-1",
    orderNumber: "ORD-001",
    merchantId: MERCHANT_ID,
    tenantId: TENANT_ID,
    timestamp: new Date(),
    status: "completed",
    customerFirstName: "Jane",
    customerLastName: "Doe",
    customerPhone: "555-0100",
    totalAmount: 4.5,
    ...overrides,
  };
}

function getHandlerByEvent<T>(eventName: string): (event: T) => Promise<void> {
  unregisterOrderEventHandlers();
  mockOn.mockClear();
  registerOrderEventHandlers();
  const call = mockOn.mock.calls.find((c) => c[0] === eventName);
  if (!call) throw new Error(`${eventName} handler not registered`);
  return call[1] as (event: T) => Promise<void>;
}

async function getHandler(): Promise<(event: OrderPaidEvent) => Promise<void>> {
  return getHandlerByEvent<OrderPaidEvent>("order.paid");
}

describe("order-listener: handleOrderPaid giftcard guard", () => {
  beforeEach(() => {
    mockGetActivePosConnection.mockReset();
    mockPushOrder.mockReset();
    mockGetOrder.mockReset();
    mockCreateFailedSyncRecordForRetry.mockReset();
  });

  it("skips push when merchantId is missing (giftcard virtual order)", async () => {
    const handler = await getHandler();
    await handler(makeEvent({ merchantId: "" }));

    expect(mockGetOrder).not.toHaveBeenCalled();
    expect(mockGetActivePosConnection).not.toHaveBeenCalled();
    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("skips push when order.salesChannel is giftcard", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "giftcard",
    });

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockGetOrder).toHaveBeenCalledWith(TENANT_ID, "order-1");
    expect(mockGetActivePosConnection).not.toHaveBeenCalled();
    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("pushes order when salesChannel is online_order and connection is active", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockResolvedValue({ externalOrderId: "sq-1" });

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockPushOrder).toHaveBeenCalledTimes(1);
    const [, , pushInput] = mockPushOrder.mock.calls[0];
    expect(pushInput.orderId).toBe("order-1");
    expect(pushInput.items).toHaveLength(1);
  });

  it("forwards orderMode, deliveryAddress and notes from the stored order", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "delivery",
      deliveryAddress: {
        street: "1 Market",
        city: "SF",
        state: "CA",
        zipCode: "94103",
        instructions: "Gate 7",
      },
      notes: "Please hurry",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockResolvedValue({ externalOrderId: "sq-1" });

    const handler = await getHandler();
    await handler(makeEvent());

    const [, , pushInput] = mockPushOrder.mock.calls[0];
    expect(pushInput.orderMode).toBe("delivery");
    expect(pushInput.deliveryAddress).toMatchObject({
      street: "1 Market",
      instructions: "Gate 7",
    });
    expect(pushInput.notes).toBe("Please hurry");
  });

  it("forwards dine_in orderMode so buildFulfillmentNote adds the Dine-in prefix", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "dine_in",
      notes: "Table 7",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockResolvedValue({ externalOrderId: "sq-1" });

    const handler = await getHandler();
    await handler(makeEvent());

    const [, , pushInput] = mockPushOrder.mock.calls[0];
    expect(pushInput.orderMode).toBe("dine_in");
    expect(pushInput.notes).toBe("Table 7");
  });

  it("skips push when order is not found", async () => {
    mockGetOrder.mockResolvedValue(null);

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockGetActivePosConnection).not.toHaveBeenCalled();
    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("skips push when order has no items", async () => {
    mockGetOrder.mockResolvedValue({ orderItems: [], salesChannel: "online_order" });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("skips push when no active POS connection", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
    });
    mockGetActivePosConnection.mockResolvedValue(null);

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("swallows errors from pushOrder without throwing", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockRejectedValue(new Error("POS down"));

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();
  });
});

describe("order-listener: handleFulfillmentChanged", () => {
  beforeEach(() => {
    mockGetActivePosConnection.mockReset();
    mockUpdateFulfillment.mockReset();
    mockCreateFailedSyncRecordForRetry.mockReset();
  });

  function makeFulfillmentEvent(): FulfillmentStatusChangedEvent {
    return {
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      fulfillmentId: "test-fulfillment-id",
      fulfillmentStatus: "ready",
    };
  }

  it("forwards status update to POS when connection is active", async () => {
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockUpdateFulfillment.mockResolvedValue(undefined);

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await handler(makeFulfillmentEvent());

    expect(mockUpdateFulfillment).toHaveBeenCalledWith(
      TENANT_ID,
      MERCHANT_ID,
      "order-1",
      "ready"
    );
  });

  it("skips when no connection", async () => {
    mockGetActivePosConnection.mockResolvedValue(null);

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await handler(makeFulfillmentEvent());

    expect(mockUpdateFulfillment).not.toHaveBeenCalled();
  });

  it("swallows errors from updateFulfillment", async () => {
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockUpdateFulfillment.mockRejectedValue(new Error("network"));

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await expect(handler(makeFulfillmentEvent())).resolves.toBeUndefined();
  });
});

describe("order-listener: handleOrderCancelled", () => {
  beforeEach(() => {
    mockGetActivePosConnection.mockReset();
    mockCancelOrder.mockReset();
    mockCreateFailedSyncRecordForRetry.mockReset();
  });

  function makeCancelEvent(): OrderCancelledEvent {
    return {
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      status: "canceled",
      cancelReason: "Customer request",
    };
  }

  it("calls cancelOrder when connection is active", async () => {
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockCancelOrder.mockResolvedValue(undefined);

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler(makeCancelEvent());

    expect(mockCancelOrder).toHaveBeenCalledWith(
      TENANT_ID,
      MERCHANT_ID,
      "order-1",
      "Customer request"
    );
  });

  it("skips when no connection", async () => {
    mockGetActivePosConnection.mockResolvedValue(null);

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler(makeCancelEvent());

    expect(mockCancelOrder).not.toHaveBeenCalled();
  });

  it("swallows errors from cancelOrder", async () => {
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockCancelOrder.mockRejectedValue(new Error("boom"));

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await expect(handler(makeCancelEvent())).resolves.toBeUndefined();
  });

  it("returns false when getActivePosConnection throws", async () => {
    mockGetActivePosConnection.mockRejectedValue(new Error("db down"));

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler(makeCancelEvent());

    expect(mockCancelOrder).not.toHaveBeenCalled();
  });
});

describe("order-listener: retry record creation", () => {
  beforeEach(() => {
    mockGetActivePosConnection.mockReset();
    mockPushOrder.mockReset();
    mockUpdateFulfillment.mockReset();
    mockCancelOrder.mockReset();
    mockGetOrder.mockReset();
    mockCreateFailedSyncRecordForRetry.mockReset();
  });

  it("creates retry record when pushOrder fails", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockRejectedValue(new Error("POS down"));
    mockCreateFailedSyncRecordForRetry.mockResolvedValue(undefined);

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockCreateFailedSyncRecordForRetry).toHaveBeenCalledWith(
      TENANT_ID,
      "conn-1",
      "ORDER_PUSH",
      expect.objectContaining({
        operation: "CREATE",
        tenantId: TENANT_ID,
        merchantId: MERCHANT_ID,
        input: expect.objectContaining({ orderId: "order-1" }),
      }),
      "POS down"
    );
  });

  it("creates retry record when updateFulfillment fails", async () => {
    // First call: findActivePosConnection (success then throws)
    // Second call: getActivePosConnection for retry
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce({ id: "conn-1" });
    mockUpdateFulfillment.mockRejectedValue(new Error("network"));
    mockCreateFailedSyncRecordForRetry.mockResolvedValue(undefined);

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await handler({
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      fulfillmentId: "test-fulfillment-id",
      fulfillmentStatus: "ready",
    });

    expect(mockCreateFailedSyncRecordForRetry).toHaveBeenCalledWith(
      TENANT_ID,
      "conn-1",
      "ORDER_PUSH",
      expect.objectContaining({
        operation: "UPDATE_STATUS",
        orderId: "order-1",
        fulfillmentStatus: "ready",
      }),
      "network"
    );
  });

  it("creates retry record when cancelOrder fails", async () => {
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce({ id: "conn-1" });
    mockCancelOrder.mockRejectedValue(new Error("timeout"));
    mockCreateFailedSyncRecordForRetry.mockResolvedValue(undefined);

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler({
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      status: "canceled",
      cancelReason: "Customer request",
    });

    expect(mockCreateFailedSyncRecordForRetry).toHaveBeenCalledWith(
      TENANT_ID,
      "conn-1",
      "ORDER_PUSH",
      expect.objectContaining({
        operation: "CANCEL",
        orderId: "order-1",
        cancelReason: "Customer request",
      }),
      "timeout"
    );
  });

  it("skips retry record when connection lookup returns null after failure", async () => {
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce(null);
    mockUpdateFulfillment.mockRejectedValue(new Error("network"));

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await handler({
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      fulfillmentId: "test-fulfillment-id",
      fulfillmentStatus: "ready",
    });

    expect(mockCreateFailedSyncRecordForRetry).not.toHaveBeenCalled();
  });

  it("swallows non-Error retry record creation failure for fulfillment", async () => {
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce({ id: "conn-1" });
    mockUpdateFulfillment.mockRejectedValue(new Error("network"));
    mockCreateFailedSyncRecordForRetry.mockRejectedValue("db error string");

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await expect(
      handler({
        orderId: "order-1",
        orderNumber: "ORD-001",
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        timestamp: new Date(),
        fulfillmentId: "test-fulfillment-id",
        fulfillmentStatus: "ready",
      })
    ).resolves.toBeUndefined();
  });

  it("swallows non-Error retry record creation failure for cancel", async () => {
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce({ id: "conn-1" });
    mockCancelOrder.mockRejectedValue(new Error("timeout"));
    mockCreateFailedSyncRecordForRetry.mockRejectedValue("db error string");

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await expect(
      handler({
        orderId: "order-1",
        orderNumber: "ORD-001",
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        timestamp: new Date(),
        status: "canceled",
      })
    ).resolves.toBeUndefined();
  });

  it("does not throw when retry record creation itself fails", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockRejectedValue(new Error("POS down"));
    mockCreateFailedSyncRecordForRetry.mockRejectedValue(
      new Error("DB write failed")
    );

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();
  });

  it("skips retry record when connection has no id (pushOrder)", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockRejectedValue(new Error("POS down"));

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockCreateFailedSyncRecordForRetry).not.toHaveBeenCalled();
  });

  it("skips retry record when cancel connection lookup returns null", async () => {
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce(null);
    mockCancelOrder.mockRejectedValue(new Error("timeout"));

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler({
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      status: "canceled",
    });

    expect(mockCreateFailedSyncRecordForRetry).not.toHaveBeenCalled();
  });

  it("swallows Error retry record creation failure for cancel", async () => {
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce({ id: "conn-1" });
    mockCancelOrder.mockRejectedValue(new Error("timeout"));
    mockCreateFailedSyncRecordForRetry.mockRejectedValue(
      new Error("DB write failed")
    );

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await expect(
      handler({
        orderId: "order-1",
        orderNumber: "ORD-001",
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        timestamp: new Date(),
        status: "canceled",
      })
    ).resolves.toBeUndefined();
  });

  it("swallows non-Error retry record creation failure for pushOrder", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockRejectedValue(new Error("POS down"));
    mockCreateFailedSyncRecordForRetry.mockRejectedValue("db error string");

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();
  });

  it("swallows Error retry record creation failure for fulfillment (Error branch)", async () => {
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce({ id: "conn-1" });
    mockUpdateFulfillment.mockRejectedValue(new Error("network"));
    mockCreateFailedSyncRecordForRetry.mockRejectedValue(
      new Error("DB write failed")
    );

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await expect(
      handler({
        orderId: "order-1",
        orderNumber: "ORD-001",
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        timestamp: new Date(),
        fulfillmentId: "test-fulfillment-id",
        fulfillmentStatus: "ready",
      })
    ).resolves.toBeUndefined();
  });

  it("strips undefined fields from retry payload before persisting", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "pickup",
      deliveryAddress: null,
      notes: null,
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockRejectedValue(new Error("POS down"));
    mockCreateFailedSyncRecordForRetry.mockResolvedValue(undefined);

    const handler = await getHandler();
    await handler(makeEvent({ customerEmail: undefined }));

    const savedPayload =
      mockCreateFailedSyncRecordForRetry.mock.calls[0][3];
    expect(savedPayload).not.toHaveProperty("input.customerEmail");
    expect(savedPayload).not.toHaveProperty("input.notes");
    expect(savedPayload.input.orderId).toBe("order-1");
    expect(savedPayload.operation).toBe("CREATE");
  });

  it("strips undefined cancelReason from cancel retry payload", async () => {
    mockGetActivePosConnection
      .mockResolvedValueOnce({
        id: "conn-1",
        type: "POS_SQUARE",
        status: "active",
      })
      .mockResolvedValueOnce({ id: "conn-1" });
    mockCancelOrder.mockRejectedValue(new Error("timeout"));
    mockCreateFailedSyncRecordForRetry.mockResolvedValue(undefined);

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler({
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      status: "canceled",
    });

    const savedPayload =
      mockCreateFailedSyncRecordForRetry.mock.calls[0][3];
    expect(savedPayload).not.toHaveProperty("cancelReason");
    expect(savedPayload.operation).toBe("CANCEL");
    expect(savedPayload.orderId).toBe("order-1");
  });
});

describe("order-listener: loop prevention", () => {
  beforeEach(() => {
    mockGetActivePosConnection.mockReset();
    mockPushOrder.mockReset();
    mockUpdateFulfillment.mockReset();
    mockCancelOrder.mockReset();
    mockGetOrder.mockReset();
  });

  it("handleOrderPaid skips push when source is square_webhook", async () => {
    const handler = await getHandler();
    await handler({ ...makeEvent(), source: "square_webhook" });

    expect(mockGetOrder).not.toHaveBeenCalled();
    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("handleFulfillmentChanged skips push when source is square_webhook", async () => {
    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await handler({
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      fulfillmentId: "test-fulfillment-id",
      fulfillmentStatus: "ready",
      source: "square_webhook",
    });

    expect(mockGetActivePosConnection).not.toHaveBeenCalled();
    expect(mockUpdateFulfillment).not.toHaveBeenCalled();
  });

  it("handleOrderCancelled skips push when source is square_webhook", async () => {
    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler({
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      status: "canceled",
      cancelReason: "Canceled on Square POS",
      source: "square_webhook",
    });

    expect(mockGetActivePosConnection).not.toHaveBeenCalled();
    expect(mockCancelOrder).not.toHaveBeenCalled();
  });
});

describe("order-listener: misc coverage", () => {
  beforeEach(() => {
    mockGetActivePosConnection.mockReset();
    mockPushOrder.mockReset();
    mockGetOrder.mockReset();
    mockCancelOrder.mockReset();
    mockCreateFailedSyncRecordForRetry.mockReset();
  });

  it("registerOrderEventHandlers is idempotent", () => {
    unregisterOrderEventHandlers();
    mockOn.mockClear();
    registerOrderEventHandlers();
    const firstCount = mockOn.mock.calls.length;
    registerOrderEventHandlers();
    expect(mockOn.mock.calls.length).toBe(firstCount);
  });

  it("maps selectedModifiers when pushing order", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: [
        {
          id: "oi-2",
          orderId: "order-1",
          menuItemId: "item-1",
          name: "Coffee",
          unitPrice: 4.5,
          quantity: 1,
          totalPrice: 4.5,
          notes: "extra hot",
          imageUrl: null,
          taxes: null,
          sortOrder: 0,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          modifiers: [
            {
              id: "om-1",
              orderItemId: "oi-2",
              modifierGroupId: "g1",
              modifierOptionId: "m1",
              groupName: "Size",
              name: "Large",
              price: 1,
              quantity: 1,
              deleted: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ],
      salesChannel: "online_order",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockResolvedValue({ externalOrderId: "sq-2" });

    const handler = await getHandler();
    await handler(makeEvent());

    const [, , pushInput] = mockPushOrder.mock.calls[0];
    expect(pushInput.items[0].selectedModifiers).toHaveLength(1);
    expect(pushInput.items[0].selectedModifiers[0].modifierId).toBe("m1");
  });

  it("getOrderForPush returns null when orderService throws", async () => {
    mockGetOrder.mockRejectedValue(new Error("DB fail"));

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockGetActivePosConnection).not.toHaveBeenCalled();
    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("uses fallback defaults when customer fields are undefined", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockResolvedValue({ externalOrderId: "sq-3" });

    const handler = await getHandler();
    await handler({
      orderId: "order-3",
      orderNumber: "ORD-003",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      status: "completed",
    });

    const [, , pushInput] = mockPushOrder.mock.calls[0];
    expect(pushInput.customerFirstName).toBe("");
    expect(pushInput.customerLastName).toBe("");
    expect(pushInput.customerPhone).toBe("");
    expect(pushInput.totalAmount).toBe(0);
  });

  it("handles non-Error exceptions in handleOrderPaid catch", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockPushOrder.mockRejectedValue("string error");

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();
  });

  it("handles non-Error exceptions in handleFulfillmentChanged catch", async () => {
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockUpdateFulfillment.mockRejectedValue("oops");

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await expect(
      handler({
        orderId: "x",
        orderNumber: "X",
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        timestamp: new Date(),
        fulfillmentId: "test-fulfillment-id",
        fulfillmentStatus: "ready",
      })
    ).resolves.toBeUndefined();
  });

  it("handles non-Error exceptions in handleOrderCancelled catch", async () => {
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockCancelOrder.mockRejectedValue("nope");

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await expect(
      handler({
        orderId: "x",
        orderNumber: "X",
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        timestamp: new Date(),
        status: "canceled",
      })
    ).resolves.toBeUndefined();
  });

  it("outer catch handles errors during push data preparation", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: [
        {
          id: "oi-bad",
          orderId: "order-1",
          menuItemId: "item-1",
          name: "Coffee",
          unitPrice: 4.5,
          quantity: 1,
          totalPrice: 4.5,
          notes: null,
          imageUrl: null,
          taxes: null,
          sortOrder: 0,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          modifiers: undefined, // malformed — triggers outer catch
        },
      ],
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();

    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("outer catch handles non-Error thrown after getOrderForPush", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    // Make getProvider throw a non-Error string to reach the outer catch
    // with a non-Error value (line 167 + non-Error branch at line 169)
    mockGetProvider.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw "unexpected string error";
    });

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();

    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("outer catch handles Error thrown after getOrderForPush", async () => {
    mockGetOrder.mockResolvedValue({
      orderItems: sampleOrderItems,
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockGetProvider.mockImplementationOnce(() => {
      throw new Error("provider unavailable");
    });

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();

    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("getOrderForPush treats missing orderItems as empty array", async () => {
    mockGetOrder.mockResolvedValue({
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });

    const handler = await getHandler();
    await handler(makeEvent());

    // orderItems undefined → items=[] → skipped at "no items" guard
    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it("handleOrderCancelled passes undefined cancelReason through", async () => {
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
      status: "active",
    });
    mockCancelOrder.mockResolvedValue(undefined);

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler({
      orderId: "order-2",
      orderNumber: "ORD-002",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      status: "canceled",
    });

    expect(mockCancelOrder).toHaveBeenCalledWith(
      TENANT_ID,
      MERCHANT_ID,
      "order-2",
      undefined
    );
  });
});
