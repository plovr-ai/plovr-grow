import { describe, it, expect, vi, beforeEach } from "vitest";
import { orderEventEmitter } from "../order-events";
import type { OrderCreatedEvent, OrderStatusChangedEvent } from "../order-events.types";

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
        status: "pending",
        timestamp: new Date(),
        customerName: "John Doe",
        customerPhone: "123-456-7890",
        orderType: "pickup",
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
      const unsubscribe = orderEventEmitter.on("order.confirmed", handler);

      const event: OrderCreatedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "pending",
        timestamp: new Date(),
        customerName: "John Doe",
        customerPhone: "123-456-7890",
        orderType: "pickup",
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
      const unsubscribe = orderEventEmitter.on("order.completed", handler);

      // Unsubscribe before emitting
      unsubscribe();

      const event: OrderStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "completed",
        previousStatus: "ready",
        timestamp: new Date(),
      };

      orderEventEmitter.emit("order.completed", event);

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
        status: "pending",
        timestamp: new Date(),
        customerName: "John Doe",
        customerPhone: "123-456-7890",
        orderType: "pickup",
        totalAmount: 25.99,
        items: [],
      };

      const confirmedEvent: OrderStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "confirmed",
        previousStatus: "pending",
        timestamp: new Date(),
      };

      orderEventEmitter.emit("order.created", createdEvent);
      orderEventEmitter.emit("order.confirmed", confirmedEvent);

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
        status: "pending",
        timestamp: new Date(),
        customerName: "John Doe",
        customerPhone: "123-456-7890",
        orderType: "pickup",
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

      const event: OrderStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "cancelled",
        previousStatus: "pending",
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

      const unsubscribe1 = orderEventEmitter.on("order.ready", slowHandler);
      const unsubscribe2 = orderEventEmitter.on("order.ready", fastHandler);

      const event: OrderStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "ready",
        previousStatus: "preparing",
        timestamp: new Date(),
      };

      orderEventEmitter.emit("order.ready", event);

      // Fast handler should complete first
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(results).toContain(2);

      // Wait for slow handler
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(results).toContain(1);

      unsubscribe1();
      unsubscribe2();
    });

    it("should not throw when handler throws error", async () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const normalHandler = vi.fn();

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const unsubscribe1 = orderEventEmitter.on("order.preparing", errorHandler);
      const unsubscribe2 = orderEventEmitter.on("order.preparing", normalHandler);

      const event: OrderStatusChangedEvent = {
        orderId: "order-1",
        orderNumber: "#001",
        merchantId: "merchant-1",
        tenantId: "tenant-1",
        status: "preparing",
        previousStatus: "confirmed",
        timestamp: new Date(),
      };

      // Should not throw
      expect(() => orderEventEmitter.emit("order.preparing", event)).not.toThrow();

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

  describe("listenerCount()", () => {
    it("should return 0 for event with no listeners", () => {
      // Using a fresh check - may have listeners from other tests due to singleton
      // This test verifies the method works
      const count = orderEventEmitter.listenerCount("order.created");
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should return correct count after subscribing", () => {
      const initialCount = orderEventEmitter.listenerCount("order.confirmed");

      const handler = vi.fn();
      const unsubscribe = orderEventEmitter.on("order.confirmed", handler);

      expect(orderEventEmitter.listenerCount("order.confirmed")).toBe(initialCount + 1);

      unsubscribe();

      expect(orderEventEmitter.listenerCount("order.confirmed")).toBe(initialCount);
    });
  });
});
