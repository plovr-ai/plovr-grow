import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  OrderPaidEvent,
  FulfillmentStatusChangedEvent,
  OrderCancelledEvent,
} from "@/services/order/order-events.types";

const mockGetConnection = vi.fn();
vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
  },
}));

const mockCreateOrder = vi.fn();
const mockUpdateOrderStatus = vi.fn();
const mockCancelOrder = vi.fn();
vi.mock("../square-order.service", () => ({
  squareOrderService: {
    createOrder: (...args: unknown[]) => mockCreateOrder(...args),
    updateOrderStatus: (...args: unknown[]) => mockUpdateOrderStatus(...args),
    cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
  },
}));

const mockGetOrder = vi.fn();
vi.mock("@/services/order/order.service", () => ({
  orderService: {
    getOrder: (...args: unknown[]) => mockGetOrder(...args),
  },
}));

const mockOn = vi.fn();
vi.mock("@/services/order/order-events", () => ({
  orderEventEmitter: {
    on: (...args: unknown[]) => mockOn(...args),
  },
}));

import {
  registerSquareOrderEventHandlers,
  unregisterSquareOrderEventHandlers,
} from "../square-order-listener";

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
  unregisterSquareOrderEventHandlers();
  mockOn.mockClear();
  registerSquareOrderEventHandlers();
  const call = mockOn.mock.calls.find((c) => c[0] === eventName);
  if (!call) throw new Error(`${eventName} handler not registered`);
  return call[1] as (event: T) => Promise<void>;
}

async function getHandler(): Promise<(event: OrderPaidEvent) => Promise<void>> {
  return getHandlerByEvent<OrderPaidEvent>("order.paid");
}

describe("square-order-listener: handleOrderPaid giftcard guard", () => {
  beforeEach(() => {
    mockGetConnection.mockReset();
    mockCreateOrder.mockReset();
    mockGetOrder.mockReset();
  });

  it("skips push when merchantId is missing (giftcard virtual order)", async () => {
    const handler = await getHandler();
    await handler(makeEvent({ merchantId: "" }));

    expect(mockGetOrder).not.toHaveBeenCalled();
    expect(mockGetConnection).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("skips push when order.salesChannel is giftcard", async () => {
    mockGetOrder.mockResolvedValue({
      items: sampleItems,
      salesChannel: "giftcard",
    });

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockGetOrder).toHaveBeenCalledWith(TENANT_ID, "order-1");
    expect(mockGetConnection).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("pushes order when salesChannel is online_order and connection is active", async () => {
    mockGetOrder.mockResolvedValue({
      items: sampleItems,
      salesChannel: "online_order",
      orderMode: "pickup",
    });
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockCreateOrder.mockResolvedValue({ squareOrderId: "sq-1" });

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    const [, , pushInput] = mockCreateOrder.mock.calls[0];
    expect(pushInput.orderId).toBe("order-1");
    expect(pushInput.items).toHaveLength(1);
  });

  it("forwards orderMode, deliveryAddress and notes from the stored order", async () => {
    mockGetOrder.mockResolvedValue({
      items: sampleItems,
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
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockCreateOrder.mockResolvedValue({ squareOrderId: "sq-1" });

    const handler = await getHandler();
    await handler(makeEvent());

    const [, , pushInput] = mockCreateOrder.mock.calls[0];
    expect(pushInput.orderMode).toBe("delivery");
    expect(pushInput.deliveryAddress).toMatchObject({
      street: "1 Market",
      instructions: "Gate 7",
    });
    expect(pushInput.notes).toBe("Please hurry");
  });

  it("forwards dine_in orderMode so buildFulfillmentNote adds the Dine-in prefix", async () => {
    mockGetOrder.mockResolvedValue({
      items: sampleItems,
      salesChannel: "online_order",
      orderMode: "dine_in",
      notes: "Table 7",
    });
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockCreateOrder.mockResolvedValue({ squareOrderId: "sq-1" });

    const handler = await getHandler();
    await handler(makeEvent());

    const [, , pushInput] = mockCreateOrder.mock.calls[0];
    expect(pushInput.orderMode).toBe("dine_in");
    expect(pushInput.notes).toBe("Table 7");
  });

  it("skips push when order is not found", async () => {
    mockGetOrder.mockResolvedValue(null);

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockGetConnection).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("skips push when order has no items", async () => {
    mockGetOrder.mockResolvedValue({ items: [], salesChannel: "online_order" });
    mockGetConnection.mockResolvedValue({ status: "active" });

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("skips push when no active Square connection", async () => {
    mockGetOrder.mockResolvedValue({
      items: sampleItems,
      salesChannel: "online_order",
    });
    mockGetConnection.mockResolvedValue(null);

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("swallows errors from createOrder without throwing", async () => {
    mockGetOrder.mockResolvedValue({
      items: sampleItems,
      salesChannel: "online_order",
    });
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockCreateOrder.mockRejectedValue(new Error("Square down"));

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();
  });
});

describe("square-order-listener: handleFulfillmentChanged", () => {
  beforeEach(() => {
    mockGetConnection.mockReset();
    mockUpdateOrderStatus.mockReset();
  });

  function makeFulfillmentEvent(): FulfillmentStatusChangedEvent {
    return {
      orderId: "order-1",
      orderNumber: "ORD-001",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      fulfillmentStatus: "ready",
    };
  }

  it("forwards status update to Square when connection is active", async () => {
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockUpdateOrderStatus.mockResolvedValue(undefined);

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await handler(makeFulfillmentEvent());

    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      TENANT_ID,
      MERCHANT_ID,
      "order-1",
      "ready"
    );
  });

  it("skips when no connection", async () => {
    mockGetConnection.mockResolvedValue(null);

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await handler(makeFulfillmentEvent());

    expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
  });

  it("swallows errors from updateOrderStatus", async () => {
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockUpdateOrderStatus.mockRejectedValue(new Error("network"));

    const handler = getHandlerByEvent<FulfillmentStatusChangedEvent>(
      "order.fulfillment.ready"
    );
    await expect(handler(makeFulfillmentEvent())).resolves.toBeUndefined();
  });
});

describe("square-order-listener: handleOrderCancelled", () => {
  beforeEach(() => {
    mockGetConnection.mockReset();
    mockCancelOrder.mockReset();
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
    mockGetConnection.mockResolvedValue({ status: "active" });
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
    mockGetConnection.mockResolvedValue(null);

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler(makeCancelEvent());

    expect(mockCancelOrder).not.toHaveBeenCalled();
  });

  it("swallows errors from cancelOrder", async () => {
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockCancelOrder.mockRejectedValue(new Error("boom"));

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await expect(handler(makeCancelEvent())).resolves.toBeUndefined();
  });

  it("returns false when getConnection throws (checkSquareConnection catch)", async () => {
    mockGetConnection.mockRejectedValue(new Error("db down"));

    const handler = getHandlerByEvent<OrderCancelledEvent>("order.cancelled");
    await handler(makeCancelEvent());

    expect(mockCancelOrder).not.toHaveBeenCalled();
  });
});

describe("square-order-listener: misc coverage", () => {
  beforeEach(() => {
    mockGetConnection.mockReset();
    mockCreateOrder.mockReset();
    mockGetOrder.mockReset();
    mockCancelOrder.mockReset();
  });

  it("registerSquareOrderEventHandlers is idempotent", () => {
    unregisterSquareOrderEventHandlers();
    mockOn.mockClear();
    registerSquareOrderEventHandlers();
    const firstCount = mockOn.mock.calls.length;
    registerSquareOrderEventHandlers();
    expect(mockOn.mock.calls.length).toBe(firstCount);
  });

  it("maps selectedModifiers when pushing order", async () => {
    mockGetOrder.mockResolvedValue({
      items: [
        {
          menuItemId: "item-1",
          name: "Coffee",
          price: 4.5,
          quantity: 1,
          totalPrice: 4.5,
          specialInstructions: "extra hot",
          selectedModifiers: [
            {
              groupId: "g1",
              groupName: "Size",
              modifierId: "m1",
              modifierName: "Large",
              price: 1,
              quantity: 1,
            },
          ],
        },
      ],
      salesChannel: "online_order",
    });
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockCreateOrder.mockResolvedValue({ squareOrderId: "sq-2" });

    const handler = await getHandler();
    await handler(makeEvent());

    const [, , pushInput] = mockCreateOrder.mock.calls[0];
    expect(pushInput.items[0].selectedModifiers).toHaveLength(1);
    expect(pushInput.items[0].selectedModifiers[0].modifierId).toBe("m1");
  });

  it("getOrderForPush returns null when orderService throws", async () => {
    mockGetOrder.mockRejectedValue(new Error("DB fail"));

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockGetConnection).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("uses fallback defaults when customer fields are undefined", async () => {
    mockGetOrder.mockResolvedValue({
      items: sampleItems,
      salesChannel: "online_order",
    });
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockCreateOrder.mockResolvedValue({ squareOrderId: "sq-3" });

    const handler = await getHandler();
    await handler({
      orderId: "order-3",
      orderNumber: "ORD-003",
      merchantId: MERCHANT_ID,
      tenantId: TENANT_ID,
      timestamp: new Date(),
      status: "completed",
      // customerFirstName / customerLastName / customerPhone / customerEmail / totalAmount all undefined
    });

    const [, , pushInput] = mockCreateOrder.mock.calls[0];
    expect(pushInput.customerFirstName).toBe("");
    expect(pushInput.customerLastName).toBe("");
    expect(pushInput.customerPhone).toBe("");
    expect(pushInput.totalAmount).toBe(0);
  });

  it("handles non-Error exceptions in handleOrderPaid catch", async () => {
    mockGetOrder.mockResolvedValue({
      items: sampleItems,
      salesChannel: "online_order",
    });
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockCreateOrder.mockRejectedValue("string error");

    const handler = await getHandler();
    await expect(handler(makeEvent())).resolves.toBeUndefined();
  });

  it("handles non-Error exceptions in handleFulfillmentChanged catch", async () => {
    mockGetConnection.mockResolvedValue({ status: "active" });
    mockUpdateOrderStatus.mockRejectedValue("oops");

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
        fulfillmentStatus: "ready",
      })
    ).resolves.toBeUndefined();
  });

  it("handles non-Error exceptions in handleOrderCancelled catch", async () => {
    mockGetConnection.mockResolvedValue({ status: "active" });
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

  it("handleOrderCancelled passes undefined cancelReason through", async () => {
    mockGetConnection.mockResolvedValue({ status: "active" });
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
