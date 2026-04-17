import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FulfillmentStatus } from "@/types";

// Mock prisma — vi.hoisted ensures the mock object is available when vi.mock is hoisted
const mockPrisma = vi.hoisted(() => ({
  orderFulfillment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
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
          orderFulfillment: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }),
          },
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
        orderFulfillment: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }),
        },
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
      expect(mockTx.orderFulfillment.updateMany).toHaveBeenCalled();
      expect(mockTx.fulfillmentStatusLog.create).toHaveBeenCalled();
      expect(mockTx.order.update).toHaveBeenCalled();
    });

    it("should set timestamp field and sync order fulfillmentStatus", async () => {
      const txClient = {
        orderFulfillment: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }),
        },
        fulfillmentStatusLog: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(txClient));

      await fulfillmentRepository.transitionStatus(
        TENANT_ID, FULFILLMENT_ID, ORDER_ID,
        fromStatus, toStatus, "square_webhook"
      );

      // Check fulfillment updateMany includes CAS condition and confirmedAt timestamp
      expect(txClient.orderFulfillment.updateMany).toHaveBeenCalledWith({
        where: { id: FULFILLMENT_ID, status: fromStatus },
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

    it("should throw FULFILLMENT_CONCURRENT_CONFLICT when CAS fails", async () => {
      const txClient = {
        orderFulfillment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        fulfillmentStatusLog: { create: vi.fn() },
        order: { update: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(txClient));

      await expect(
        fulfillmentRepository.transitionStatus(
          TENANT_ID, FULFILLMENT_ID, ORDER_ID,
          fromStatus, toStatus, "internal"
        )
      ).rejects.toThrow("FULFILLMENT_CONCURRENT_CONFLICT");

      // Should not write status log or sync order when CAS fails
      expect(txClient.fulfillmentStatusLog.create).not.toHaveBeenCalled();
      expect(txClient.order.update).not.toHaveBeenCalled();
    });

    it("should set cancelReason for canceled status", async () => {
      const txClient = {
        orderFulfillment: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }),
        },
        fulfillmentStatusLog: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(txClient));

      await fulfillmentRepository.transitionStatus(
        TENANT_ID, FULFILLMENT_ID, ORDER_ID,
        "confirmed" as FulfillmentStatus, "canceled" as FulfillmentStatus, "manual",
        { cancelReason: "Out of stock" }
      );

      expect(txClient.orderFulfillment.updateMany).toHaveBeenCalledWith({
        where: { id: FULFILLMENT_ID, status: "confirmed" },
        data: expect.objectContaining({
          status: "canceled",
          cancelledAt: expect.any(Date),
          cancelReason: "Out of stock",
        }),
      });
    });

    it("should set externalVersion when provided", async () => {
      const txClient = {
        orderFulfillment: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: FULFILLMENT_ID }),
        },
        fulfillmentStatusLog: { create: vi.fn().mockResolvedValue({}) },
        order: { update: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(txClient));

      await fulfillmentRepository.transitionStatus(
        TENANT_ID, FULFILLMENT_ID, ORDER_ID,
        fromStatus, toStatus, "square_webhook",
        { externalVersion: 5 }
      );

      expect(txClient.orderFulfillment.updateMany).toHaveBeenCalledWith({
        where: { id: FULFILLMENT_ID, status: fromStatus },
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

  describe("bumpExternalVersionByOrderIdIfNewer()", () => {
    it("should query by orderId and allow null externalVersion", async () => {
      mockPrisma.orderFulfillment.updateMany.mockResolvedValue({
        count: 1,
      } as never);

      await fulfillmentRepository.bumpExternalVersionByOrderIdIfNewer(
        ORDER_ID,
        5
      );

      expect(mockPrisma.orderFulfillment.updateMany).toHaveBeenCalledWith({
        where: {
          orderId: ORDER_ID,
          OR: [
            { externalVersion: null },
            { externalVersion: { lt: 5 } },
          ],
        },
        data: { externalVersion: 5 },
      });
    });

    it("should atomically bump when stored version is strictly smaller (WHERE does the compare)", async () => {
      mockPrisma.orderFulfillment.updateMany.mockResolvedValue({
        count: 1,
      } as never);

      const result =
        await fulfillmentRepository.bumpExternalVersionByOrderIdIfNewer(
          ORDER_ID,
          5
        );

      expect(result).toEqual({ count: 1 });
    });

    it("should not bump when stored version is newer (WHERE clause matches 0 rows)", async () => {
      // updateMany returns { count: 0 } when the WHERE predicate eliminates
      // every candidate row — i.e. the stored version was already >= 5.
      mockPrisma.orderFulfillment.updateMany.mockResolvedValue({
        count: 0,
      } as never);

      const result =
        await fulfillmentRepository.bumpExternalVersionByOrderIdIfNewer(
          ORDER_ID,
          3
        );

      expect(result).toEqual({ count: 0 });
      // The WHERE clause still used lt: 3
      const callArg =
        mockPrisma.orderFulfillment.updateMany.mock.calls[0][0] as {
          where: { OR: Array<{ externalVersion?: unknown }> };
        };
      expect(callArg.where.OR[1]).toEqual({ externalVersion: { lt: 3 } });
    });
  });
});
