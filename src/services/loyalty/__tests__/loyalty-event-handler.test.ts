import { describe, it, expect, vi, beforeEach } from "vitest";
import { orderEventEmitter } from "@/services/order/order-events";
import type { OrderPaidEvent } from "@/services/order/order-events.types";

vi.mock("@/services/order/order-events", () => {
  const handlers: Array<(event: OrderPaidEvent) => Promise<void>> = [];
  return {
    orderEventEmitter: {
      on: vi.fn((event: string, handler: (event: OrderPaidEvent) => Promise<void>) => {
        handlers.push(handler);
        return () => {};
      }),
      _getHandlers: () => handlers,
      _clearHandlers: () => { handlers.length = 0; },
    },
  };
});

vi.mock("../loyalty.service", () => ({
  loyaltyService: {
    processOrderCompletion: vi.fn(),
  },
}));

import { loyaltyService } from "../loyalty.service";
import {
  registerLoyaltyEventHandlers,
  unregisterLoyaltyEventHandlers,
} from "../loyalty-event-handler";

describe("loyalty-event-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unregisterLoyaltyEventHandlers();
    // Clear accumulated handlers
    const emitter = orderEventEmitter as unknown as {
      _clearHandlers: () => void;
    };
    emitter._clearHandlers();
  });

  function getLastRegisteredHandler(): (event: OrderPaidEvent) => Promise<void> {
    const emitter = orderEventEmitter as unknown as {
      _getHandlers: () => Array<(event: OrderPaidEvent) => Promise<void>>;
    };
    const handlers = emitter._getHandlers();
    return handlers[handlers.length - 1];
  }

  it("should register order.paid handler", () => {
    registerLoyaltyEventHandlers();

    expect(orderEventEmitter.on).toHaveBeenCalledWith(
      "order.paid",
      expect.any(Function)
    );
  });

  it("should only register handlers once", () => {
    registerLoyaltyEventHandlers();
    registerLoyaltyEventHandlers();

    expect(orderEventEmitter.on).toHaveBeenCalledTimes(1);
  });

  it("should pass giftCardPayment and loyaltyMemberId to processOrderCompletion", async () => {
    registerLoyaltyEventHandlers();
    const handler = getLastRegisteredHandler();

    vi.mocked(loyaltyService.processOrderCompletion).mockResolvedValue({
      pointsEarned: 30,
      newBalance: 130,
      transactionId: "tx-1",
    });

    const event: OrderPaidEvent = {
      orderId: "order-1",
      orderNumber: "20260413-0001",
      merchantId: "merchant-1",
      tenantId: "tenant-1",
      timestamp: new Date(),
      status: "completed",
      customerPhone: "+12025551234",
      customerFirstName: "John",
      customerLastName: "Doe",
      customerEmail: "john@example.com",
      totalAmount: 50,
      giftCardPayment: 20,
      loyaltyMemberId: "member-42",
    };

    await handler(event);

    expect(loyaltyService.processOrderCompletion).toHaveBeenCalledWith(
      "tenant-1",
      "order-1",
      expect.objectContaining({
        merchantId: "merchant-1",
        customerPhone: "+12025551234",
        totalAmount: 50,
        giftCardPayment: 20,
        loyaltyMemberId: "member-42",
      })
    );
  });

  it("should skip when customerPhone is missing", async () => {
    registerLoyaltyEventHandlers();
    const handler = getLastRegisteredHandler();

    const event: OrderPaidEvent = {
      orderId: "order-1",
      orderNumber: "20260413-0001",
      merchantId: "merchant-1",
      tenantId: "tenant-1",
      timestamp: new Date(),
      status: "completed",
      totalAmount: 50,
    };

    await handler(event);

    expect(loyaltyService.processOrderCompletion).not.toHaveBeenCalled();
  });

  it("should skip when totalAmount is undefined", async () => {
    registerLoyaltyEventHandlers();
    const handler = getLastRegisteredHandler();

    const event: OrderPaidEvent = {
      orderId: "order-1",
      orderNumber: "20260413-0001",
      merchantId: "merchant-1",
      tenantId: "tenant-1",
      timestamp: new Date(),
      status: "completed",
      customerPhone: "+12025551234",
    };

    await handler(event);

    expect(loyaltyService.processOrderCompletion).not.toHaveBeenCalled();
  });

  it("should not throw when processOrderCompletion fails", async () => {
    registerLoyaltyEventHandlers();
    const handler = getLastRegisteredHandler();

    vi.mocked(loyaltyService.processOrderCompletion).mockRejectedValue(
      new Error("Service unavailable")
    );

    const event: OrderPaidEvent = {
      orderId: "order-1",
      orderNumber: "20260413-0001",
      merchantId: "merchant-1",
      tenantId: "tenant-1",
      timestamp: new Date(),
      status: "completed",
      customerPhone: "+12025551234",
      totalAmount: 50,
    };

    // Should not throw
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it("should handle event without giftCardPayment (cash-only order)", async () => {
    registerLoyaltyEventHandlers();
    const handler = getLastRegisteredHandler();

    vi.mocked(loyaltyService.processOrderCompletion).mockResolvedValue({
      pointsEarned: 50,
      newBalance: 150,
      transactionId: "tx-cash",
    });

    const event: OrderPaidEvent = {
      orderId: "order-2",
      orderNumber: "20260413-0002",
      merchantId: "merchant-1",
      tenantId: "tenant-1",
      timestamp: new Date(),
      status: "completed",
      customerPhone: "+12025551234",
      totalAmount: 50,
      // no giftCardPayment, no loyaltyMemberId
    };

    await handler(event);

    expect(loyaltyService.processOrderCompletion).toHaveBeenCalledWith(
      "tenant-1",
      "order-2",
      expect.objectContaining({
        totalAmount: 50,
        giftCardPayment: undefined,
        loyaltyMemberId: undefined,
      })
    );
  });
});
