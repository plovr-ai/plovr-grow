import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrderPaidEvent } from "@/services/order/order-events.types";

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

async function getHandler(): Promise<(event: OrderPaidEvent) => Promise<void>> {
  unregisterSquareOrderEventHandlers();
  mockOn.mockClear();
  registerSquareOrderEventHandlers();
  const call = mockOn.mock.calls.find((c) => c[0] === "order.paid");
  if (!call) throw new Error("order.paid handler not registered");
  return call[1] as (event: OrderPaidEvent) => Promise<void>;
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

  it("skips push when order is not found", async () => {
    mockGetOrder.mockResolvedValue(null);

    const handler = await getHandler();
    await handler(makeEvent());

    expect(mockGetConnection).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
});
