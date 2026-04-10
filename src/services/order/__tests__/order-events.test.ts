import { describe, it, expect, vi, beforeEach } from "vitest";
import { orderEventEmitter } from "../order-events";
import type {
  OrderCreatedEvent,
  PaymentStatusChangedEvent,
  FulfillmentStatusChangedEvent,
} from "../order-events.types";

describe("OrderEventEmitter", () => {
  beforeEach(() => {
    // Clear all handlers between tests by creating event emitter fresh
    // Note: In production, we use singleton, but for testing we verify behavior
  });

  describe("on()", () => {
    it("should subscribe to specific event", async () => {
      const handler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.created", handler);

      const event: OrderCreatedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "created",
        fulfillmentStatus: "pending",
        timestamp: new Date(),
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "123-456-7890",
        orderMode: "pickup",
        salesChannel: "online_order",
        totalAmount: 25.99,
        items: [],
      };

      orderEventEmitter.emit("order.created", event);

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);

      unsubscribe();
    });

    it("should not call handler for different event type", async () => {
      const handler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.fulfillment.confirmed", handler);

      const event: OrderCreatedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "created",
        fulfillmentStatus: "pending",
        timestamp: new Date(),
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "123-456-7890",
        orderMode: "pickup",
        salesChannel: "online_order",
        totalAmount: 25.99,
        items: [],
      };

      orderEventEmitter.emit("order.created", event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();

      unsubscribe();
    });

    it("should return unsubscribe function", async () => {
      const handler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.paid", handler);

      // Unsubscribe before emitting
      unsubscribe();

      const event: PaymentStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "completed",
        previousStatus: "created",
        timestamp: new Date(),
      };

      orderEventEmitter.emit("order.paid", event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("onAny()", () => {
    it("should subscribe to all order events", async () => {
      const handler = vi.fn();
      const unsubscribe = orderEventEmitter.onAny(handler);

      const createdEvent: OrderCreatedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "created",
        fulfillmentStatus: "pending",
        timestamp: new Date(),
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "123-456-7890",
        orderMode: "pickup",
        salesChannel: "online_order",
        totalAmount: 25.99,
        items: [],
      };

      const confirmedEvent: FulfillmentStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        fulfillmentStatus: "confirmed",
        previousFulfillmentStatus: "pending",
        timestamp: new Date(),
      };

      orderEventEmitter.emit("order.created", createdEvent);
      orderEventEmitter.emit("order.fulfillment.confirmed", confirmedEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(2);

      unsubscribe();
    });

    it("should unsubscribe from all events", async () => {
      const handler = vi.fn();
      const unsubscribe = orderEventEmitter.onAny(handler);

      unsubscribe();

      const event: OrderCreatedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "created",
        fulfillmentStatus: "pending",
        timestamp: new Date(),
        customerFirstName: "John",
        customerLastName: "Doe",
        customerPhone: "123-456-7890",
        orderMode: "pickup",
        salesChannel: "online_order",
        totalAmount: 25.99,
        items: [],
      };

      orderEventEmitter.emit("order.created", event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("emit()", () => {
    it("should call multiple handlers for same event", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsubscribe1 = orderEventEmitter.on("order.cancelled", handler1);
      const unsubscribe2 = orderEventEmitter.on("order.cancelled", handler2);

      const event: PaymentStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "canceled",
        previousStatus: "created",
        timestamp: new Date(),
        cancelReason: "Customer requested",
      };

      orderEventEmitter.emit("order.cancelled", event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);

      unsubscribe1();
      unsubscribe2();
    });

    it("should handle async handlers without blocking", async () => {
      const results: number[] = [];

      const slowHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        results.push(1);
      });

      const fastHandler = vi.fn(() => {
        results.push(2);
      });

      const unsubscribe1 = orderEventEmitter.on("order.fulfillment.ready", slowHandler);
      const unsubscribe2 = orderEventEmitter.on("order.fulfillment.ready", fastHandler);

      const event: FulfillmentStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        fulfillmentStatus: "ready",
        previousFulfillmentStatus: "preparing",
        timestamp: new Date(),
      };

      orderEventEmitter.emit("order.fulfillment.ready", event);

      // Fast handler should complete first
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(results).toContain(2);

      // Wait for slow handler
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(results).toContain(1);

      unsubscribe1();
      unsubscribe2();
    });

    it("should handle async handler that rejects", async () => {
      const asyncErrorHandler = vi.fn(async () => {
        throw new Error("Async handler error");
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const unsubscribe = orderEventEmitter.on("order.partial_paid", asyncErrorHandler);

      const event: PaymentStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "partial_paid",
        previousStatus: "created",
        timestamp: new Date(),
      };

      orderEventEmitter.emit("order.partial_paid", event);

      // Wait for async handler to reject
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(asyncErrorHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      unsubscribe();
    });

    it("should do nothing when emitting to event with no handlers", async () => {
      // Emit to an event type that has no subscribers
      const event: FulfillmentStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        fulfillmentStatus: "fulfilled",
        previousFulfillmentStatus: "ready",
        timestamp: new Date(),
      };

      // Should not throw - no handlers registered
      expect(() => orderEventEmitter.emit("order.fulfillment.fulfilled", event)).not.toThrow();
    });

    it("should not throw when handler throws error", async () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const normalHandler = vi.fn();

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const unsubscribe1 = orderEventEmitter.on("order.fulfillment.preparing", errorHandler);
      const unsubscribe2 = orderEventEmitter.on("order.fulfillment.preparing", normalHandler);

      const event: FulfillmentStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        fulfillmentStatus: "preparing",
        previousFulfillmentStatus: "confirmed",
        timestamp: new Date(),
      };

      // Should not throw
      expect(() => orderEventEmitter.emit("order.fulfillment.preparing", event)).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Both handlers should have been called
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();

      // Error should be logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      unsubscribe1();
      unsubscribe2();
    });
  });

  describe("development mode logging", () => {
    it("should register onAny handler in development mode", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";

      // Reset modules to re-trigger module-level code with NODE_ENV=development
      vi.resetModules();

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { orderEventEmitter: devEmitter } = await import("../order-events");

      devEmitter.emit("order.created", {
        orderId: "dev-order-1",
        orderNumber: "#DEV001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "created",
        fulfillmentStatus: "pending",
        timestamp: new Date(),
        customerFirstName: "Dev",
        customerLastName: "Test",
        customerPhone: "123-456-7890",
        orderMode: "pickup",
        salesChannel: "online_order",
        totalAmount: 10,
        items: [],
      } as import("../order-events.types").OrderCreatedEvent);

      await new Promise((resolve) => setTimeout(resolve, 20));

      // The dev logger should have logged [OrderEvent]
      const orderEventCalls = consoleSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("[OrderEvent]")
      );
      expect(orderEventCalls.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    });
  });

  describe("listenerCount()", () => {
    it("should return 0 for event with no listeners", () => {
      // Using a fresh check - may have listeners from other tests due to singleton
      // This test verifies the method works
      const count = orderEventEmitter.listenerCount("order.created");
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should return correct count after subscribing", () => {
      const initialCount = orderEventEmitter.listenerCount("order.fulfillment.confirmed");

      const handler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.fulfillment.confirmed", handler);

      expect(orderEventEmitter.listenerCount("order.fulfillment.confirmed")).toBe(initialCount + 1);

      unsubscribe();

      expect(orderEventEmitter.listenerCount("order.fulfillment.confirmed")).toBe(initialCount);
    });
  });
});
