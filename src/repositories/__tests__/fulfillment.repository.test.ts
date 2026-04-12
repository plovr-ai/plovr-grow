import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FulfillmentStatus } from "@/types";

// Mock prisma — vi.hoisted ensures the mock object is available when vi.mock is hoisted
const mockPrisma = vi.hoisted(() => ({
  orderFulfillment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  fulfillmentStatusLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  order: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: mockPrisma,
}));

import { fulfillmentRepository } from "../fulfillment.repository";

const TENANT_ID = "tenant-1";
const FULFILLMENT_ID = "ful-1";
const ORDER_ID = "order-1";
const MERCHANT_ID = "merchant-1";

describe("FulfillmentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create()", () => {
    it("should create a fulfillment record with default status", async () => {
      mockPrisma.orderFulfillment.create.mockResolvedValue({ id: FULFILLMENT_ID } as never);

      await fulfillmentRepository.create(TENANT_ID, {
        orderId: ORDER_ID,
        merchantId: MERCHANT_ID,
      });

      expect(mockPrisma.orderFulfillment.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_ID,
          orderId: ORDER_ID,
          merchantId: MERCHANT_ID,
          status: "pending",
          posProvider: null,
          externalVersion: null,
        },
      });
    });

    it("should use provided tx client", async () => {
      const mockTx = {
        orderFulfillment: { create: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }) },
      };

      await fulfillmentRepository.create(
        TENANT_ID,
        { orderId: ORDER_ID, merchantId: MERCHANT_ID },
        mockTx as never
      );

      expect(mockTx.orderFulfillment.create).toHaveBeenCalled();
      expect(mockPrisma.orderFulfillment.create).not.toHaveBeenCalled();
    });

    it("should pass posProvider and externalVersion when provided", async () => {
      mockPrisma.orderFulfillment.create.mockResolvedValue({ id: FULFILLMENT_ID } as never);

      await fulfillmentRepository.create(TENANT_ID, {
        orderId: ORDER_ID,
        merchantId: MERCHANT_ID,
        posProvider: "POS_SQUARE",
        externalVersion: 3,
      });

      expect(mockPrisma.orderFulfillment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          posProvider: "POS_SQUARE",
          externalVersion: 3,
        }),
      });
    });
  });

  describe("getByOrderId()", () => {
    it("should query by tenantId and orderId", async () => {
      mockPrisma.orderFulfillment.findFirst.mockResolvedValue({ id: FULFILLMENT_ID } as never);

      const result = await fulfillmentRepository.getByOrderId(TENANT_ID, ORDER_ID);

      expect(mockPrisma.orderFulfillment.findFirst).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, orderId: ORDER_ID },
      });
      expect(result).toEqual({ id: FULFILLMENT_ID });
    });
  });

  describe("getById()", () => {
    it("should query by tenantId and fulfillmentId", async () => {
      mockPrisma.orderFulfillment.findFirst.mockResolvedValue({ id: FULFILLMENT_ID } as never);

      const result = await fulfillmentRepository.getById(TENANT_ID, FULFILLMENT_ID);

      expect(mockPrisma.orderFulfillment.findFirst).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, id: FULFILLMENT_ID },
      });
      expect(result).toEqual({ id: FULFILLMENT_ID });
    });
  });

  describe("transitionStatus()", () => {
    const fromStatus: FulfillmentStatus = "pending";
    const toStatus: FulfillmentStatus = "confirmed";

    it("should wrap in $transaction when no tx provided", async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => {
        const txClient = {
          orderFulfillment: { update: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }) },
          fulfillmentStatusLog: { create: vi.fn().mockResolvedValue({}) },
          order: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(txClient);
      });

      await fulfillmentRepository.transitionStatus(
        TENANT_ID, FULFILLMENT_ID, ORDER_ID,
        fromStatus, toStatus, "internal"
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should use provided tx directly without wrapping", async () => {
      const mockTx = {
        orderFulfillment: { update: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }) },
        fulfillmentStatusLog: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };

      await fulfillmentRepository.transitionStatus(
        TENANT_ID, FULFILLMENT_ID, ORDER_ID,
        fromStatus, toStatus, "internal",
        undefined,
        mockTx as never
      );

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockTx.orderFulfillment.update).toHaveBeenCalled();
      expect(mockTx.fulfillmentStatusLog.create).toHaveBeenCalled();
      expect(mockTx.order.update).toHaveBeenCalled();
    });

    it("should set timestamp field and sync order fulfillmentStatus", async () => {
      const txClient = {
        orderFulfillment: { update: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }) },
        fulfillmentStatusLog: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(txClient));

      await fulfillmentRepository.transitionStatus(
        TENANT_ID, FULFILLMENT_ID, ORDER_ID,
        fromStatus, toStatus, "square_webhook"
      );

      // Check fulfillment update includes confirmedAt timestamp
      expect(txClient.orderFulfillment.update).toHaveBeenCalledWith({
        where: { id: FULFILLMENT_ID },
        data: expect.objectContaining({
          status: "confirmed",
          confirmedAt: expect.any(Date),
        }),
      });

      // Check status log creation
      expect(txClient.fulfillmentStatusLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          fulfillmentId: FULFILLMENT_ID,
          fromStatus: "pending",
          toStatus: "confirmed",
          source: "square_webhook",
        }),
      });

      // Check order cache sync
      expect(txClient.order.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { fulfillmentStatus: "confirmed" },
      });
    });

    it("should set cancelReason for canceled status", async () => {
      const txClient = {
        orderFulfillment: { update: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }) },
        fulfillmentStatusLog: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(txClient));

      await fulfillmentRepository.transitionStatus(
        TENANT_ID, FULFILLMENT_ID, ORDER_ID,
        "confirmed" as FulfillmentStatus, "canceled" as FulfillmentStatus, "manual",
        { cancelReason: "Out of stock" }
      );

      expect(txClient.orderFulfillment.update).toHaveBeenCalledWith({
        where: { id: FULFILLMENT_ID },
        data: expect.objectContaining({
          status: "canceled",
          cancelledAt: expect.any(Date),
          cancelReason: "Out of stock",
        }),
      });
    });

    it("should set externalVersion when provided", async () => {
      const txClient = {
        orderFulfillment: { update: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }) },
        fulfillmentStatusLog: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(txClient));

      await fulfillmentRepository.transitionStatus(
        TENANT_ID, FULFILLMENT_ID, ORDER_ID,
        fromStatus, toStatus, "square_webhook",
        { externalVersion: 5 }
      );

      expect(txClient.orderFulfillment.update).toHaveBeenCalledWith({
        where: { id: FULFILLMENT_ID },
        data: expect.objectContaining({ externalVersion: 5 }),
      });
    });
  });

  describe("getStatusHistory()", () => {
    it("should query status logs ordered by createdAt", async () => {
      const logs = [{ id: "log-1" }, { id: "log-2" }];
      mockPrisma.fulfillmentStatusLog.findMany.mockResolvedValue(logs as never);

      const result = await fulfillmentRepository.getStatusHistory(TENANT_ID, FULFILLMENT_ID);

      expect(mockPrisma.fulfillmentStatusLog.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, fulfillmentId: FULFILLMENT_ID },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual(logs);
    });
  });

  describe("getByOrderIds()", () => {
    it("should query fulfillments for multiple orders", async () => {
      mockPrisma.orderFulfillment.findMany.mockResolvedValue([] as never);

      await fulfillmentRepository.getByOrderIds(TENANT_ID, ["order-1", "order-2"]);

      expect(mockPrisma.orderFulfillment.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, orderId: { in: ["order-1", "order-2"] } },
      });
    });
  });

  describe("bumpExternalVersion()", () => {
    it("should update externalVersion on the fulfillment", async () => {
      mockPrisma.orderFulfillment.update.mockResolvedValue({} as never);

      await fulfillmentRepository.bumpExternalVersion(FULFILLMENT_ID, 10);

      expect(mockPrisma.orderFulfillment.update).toHaveBeenCalledWith({
        where: { id: FULFILLMENT_ID },
        data: { externalVersion: 10 },
      });
    });
  });
});
