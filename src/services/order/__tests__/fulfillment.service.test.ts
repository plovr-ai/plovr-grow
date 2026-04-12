import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { FulfillmentStatus } from "@/types";
import type { TransitionStatusInput } from "../fulfillment.types";

// Mock the repository
vi.mock("@/repositories/fulfillment.repository", () => ({
  fulfillmentRepository: {
    create: vi.fn(),
    getByOrderId: vi.fn(),
    getById: vi.fn(),
    transitionStatus: vi.fn(),
    getStatusHistory: vi.fn(),
    bumpExternalVersion: vi.fn(),
  },
}));

// Mock the event emitter
vi.mock("../order-events", () => ({
  orderEventEmitter: {
    emit: vi.fn(),
  },
}));

// Import after mocks
import { fulfillmentService } from "../fulfillment.service";
import { fulfillmentRepository } from "@/repositories/fulfillment.repository";
import { orderEventEmitter } from "../order-events";

const mockRepo = vi.mocked(fulfillmentRepository);
const mockEmitter = vi.mocked(orderEventEmitter);

describe("FulfillmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createFulfillment()", () => {
    it("should delegate to repository.create", async () => {
      const input = {
        orderId: "order-1",
        merchantId: "merchant-1",
        posProvider: "square",
      };
      const expected = { id: "ful-1", tenantId: "t1", ...input, status: "pending" };
      mockRepo.create.mockResolvedValue(expected as never);

      const result = await fulfillmentService.createFulfillment("t1", input);

      expect(mockRepo.create).toHaveBeenCalledWith("t1", input, undefined);
      expect(result).toEqual(expected);
    });

    it("should pass transaction client when provided", async () => {
      const input = { orderId: "order-1", merchantId: "merchant-1" };
      const tx = {} as never;
      mockRepo.create.mockResolvedValue({} as never);

      await fulfillmentService.createFulfillment("t1", input, tx);

      expect(mockRepo.create).toHaveBeenCalledWith("t1", input, tx);
    });
  });

  describe("transitionStatus()", () => {
    const tenantId = "t1";
    const orderId = "order-1";
    const fulfillmentRecord = {
      id: "ful-1",
      tenantId,
      orderId,
      merchantId: "merchant-1",
      status: "pending" as FulfillmentStatus,
    };

    it("should transition status and emit event for valid transition", async () => {
      mockRepo.getByOrderId.mockResolvedValue(fulfillmentRecord as never);
      mockRepo.transitionStatus.mockResolvedValue(undefined as never);

      const input: TransitionStatusInput = {
        fulfillmentStatus: "confirmed",
        source: "internal",
        actorId: "user-1",
      };

      await fulfillmentService.transitionStatus(tenantId, orderId, input);

      expect(mockRepo.getByOrderId).toHaveBeenCalledWith(tenantId, orderId);
      expect(mockRepo.transitionStatus).toHaveBeenCalledWith(
        tenantId,
        "ful-1",
        orderId,
        "pending",
        "confirmed",
        "internal",
        {
          actorId: "user-1",
          metadata: undefined,
          externalVersion: undefined,
          cancelReason: undefined,
        }
      );
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        "order.fulfillment.confirmed",
        expect.objectContaining({
          orderId,
          fulfillmentId: "ful-1",
          fulfillmentStatus: "confirmed",
          previousFulfillmentStatus: "pending",
          tenantId,
          merchantId: "merchant-1",
          source: "internal",
        })
      );
    });

    it("should throw ORDER_NOT_FOUND when fulfillment does not exist", async () => {
      mockRepo.getByOrderId.mockResolvedValue(null as never);

      const input: TransitionStatusInput = {
        fulfillmentStatus: "confirmed",
        source: "internal",
      };

      await expect(
        fulfillmentService.transitionStatus(tenantId, orderId, input)
      ).rejects.toThrow(AppError);

      await expect(
        fulfillmentService.transitionStatus(tenantId, orderId, input)
      ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });

      expect(mockRepo.transitionStatus).not.toHaveBeenCalled();
    });

    it("should throw for invalid state transition and not call repository", async () => {
      const preparingRecord = { ...fulfillmentRecord, status: "preparing" as FulfillmentStatus };
      mockRepo.getByOrderId.mockResolvedValue(preparingRecord as never);

      const input: TransitionStatusInput = {
        fulfillmentStatus: "pending",
        source: "internal",
      };

      await expect(
        fulfillmentService.transitionStatus(tenantId, orderId, input)
      ).rejects.toThrow(AppError);

      expect(mockRepo.transitionStatus).not.toHaveBeenCalled();
      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });

    it("should pass metadata and cancelReason for cancellation", async () => {
      mockRepo.getByOrderId.mockResolvedValue(fulfillmentRecord as never);
      mockRepo.transitionStatus.mockResolvedValue(undefined as never);

      const input: TransitionStatusInput = {
        fulfillmentStatus: "canceled",
        source: "manual",
        actorId: "admin-1",
        metadata: { cancelReason: "Out of stock" },
      };

      await fulfillmentService.transitionStatus(tenantId, orderId, input);

      expect(mockRepo.transitionStatus).toHaveBeenCalledWith(
        tenantId,
        "ful-1",
        orderId,
        "pending",
        "canceled",
        "manual",
        {
          actorId: "admin-1",
          metadata: { cancelReason: "Out of stock" },
          externalVersion: undefined,
          cancelReason: "Out of stock",
        }
      );
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        "order.fulfillment.canceled",
        expect.objectContaining({
          fulfillmentStatus: "canceled",
          source: "manual",
        })
      );
    });
  });

  describe("transitionStatusByFulfillmentId()", () => {
    const tenantId = "t1";
    const fulfillmentId = "ful-1";
    const fulfillmentRecord = {
      id: fulfillmentId,
      tenantId,
      orderId: "order-1",
      merchantId: "merchant-1",
      status: "confirmed" as FulfillmentStatus,
    };

    it("should transition status using fulfillment ID and emit event", async () => {
      mockRepo.getById.mockResolvedValue(fulfillmentRecord as never);
      mockRepo.transitionStatus.mockResolvedValue(undefined as never);

      const input: TransitionStatusInput = {
        fulfillmentStatus: "preparing",
        source: "square_webhook",
        externalVersion: 3,
      };

      await fulfillmentService.transitionStatusByFulfillmentId(tenantId, fulfillmentId, input);

      expect(mockRepo.getById).toHaveBeenCalledWith(tenantId, fulfillmentId);
      expect(mockRepo.transitionStatus).toHaveBeenCalledWith(
        tenantId,
        fulfillmentId,
        "order-1",
        "confirmed",
        "preparing",
        "square_webhook",
        {
          actorId: undefined,
          metadata: undefined,
          externalVersion: 3,
          cancelReason: undefined,
        }
      );
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        "order.fulfillment.preparing",
        expect.objectContaining({
          orderId: "order-1",
          fulfillmentId,
          fulfillmentStatus: "preparing",
          previousFulfillmentStatus: "confirmed",
        })
      );
    });

    it("should throw ORDER_NOT_FOUND when fulfillment does not exist", async () => {
      mockRepo.getById.mockResolvedValue(null as never);

      const input: TransitionStatusInput = {
        fulfillmentStatus: "preparing",
        source: "internal",
      };

      await expect(
        fulfillmentService.transitionStatusByFulfillmentId(tenantId, fulfillmentId, input)
      ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });

      expect(mockRepo.transitionStatus).not.toHaveBeenCalled();
    });

    it("should throw for invalid transition and not call repository", async () => {
      mockRepo.getById.mockResolvedValue(fulfillmentRecord as never);

      const input: TransitionStatusInput = {
        fulfillmentStatus: "pending",
        source: "internal",
      };

      // confirmed -> pending is a backward transition (invalid)
      await expect(
        fulfillmentService.transitionStatusByFulfillmentId(tenantId, fulfillmentId, input)
      ).rejects.toThrow(AppError);

      expect(mockRepo.transitionStatus).not.toHaveBeenCalled();
      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe("getStatusHistory()", () => {
    it("should delegate to repository and map results", async () => {
      const rawLogs = [
        {
          id: "log-1",
          tenantId: "t1",
          fulfillmentId: "ful-1",
          fromStatus: "pending",
          toStatus: "confirmed",
          source: "internal",
          actorId: "user-1",
          metadata: null,
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "log-2",
          tenantId: "t1",
          fulfillmentId: "ful-1",
          fromStatus: "confirmed",
          toStatus: "preparing",
          source: "square_webhook",
          actorId: null,
          metadata: { key: "value" },
          createdAt: new Date("2026-01-02"),
        },
      ];

      mockRepo.getStatusHistory.mockResolvedValue(rawLogs as never);

      const result = await fulfillmentService.getStatusHistory("t1", "ful-1");

      expect(mockRepo.getStatusHistory).toHaveBeenCalledWith("t1", "ful-1");
      expect(result).toEqual([
        {
          id: "log-1",
          fromStatus: "pending",
          toStatus: "confirmed",
          source: "internal",
          actorId: "user-1",
          metadata: null,
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "log-2",
          fromStatus: "confirmed",
          toStatus: "preparing",
          source: "square_webhook",
          actorId: null,
          metadata: { key: "value" },
          createdAt: new Date("2026-01-02"),
        },
      ]);
    });

    it("should return empty array when no history exists", async () => {
      mockRepo.getStatusHistory.mockResolvedValue([] as never);

      const result = await fulfillmentService.getStatusHistory("t1", "ful-1");

      expect(result).toEqual([]);
    });
  });

  describe("bumpExternalVersion()", () => {
    it("should delegate to repository", async () => {
      mockRepo.bumpExternalVersion.mockResolvedValue(undefined as never);

      await fulfillmentService.bumpExternalVersion("ful-1", 5);

      expect(mockRepo.bumpExternalVersion).toHaveBeenCalledWith("ful-1", 5);
    });
  });

  describe("getFulfillmentByOrderId()", () => {
    it("should delegate to repository.getByOrderId", async () => {
      const expected = { id: "ful-1", status: "pending" };
      mockRepo.getByOrderId.mockResolvedValue(expected as never);

      const result = await fulfillmentService.getFulfillmentByOrderId("t1", "order-1");

      expect(mockRepo.getByOrderId).toHaveBeenCalledWith("t1", "order-1");
      expect(result).toEqual(expected);
    });
  });
});
