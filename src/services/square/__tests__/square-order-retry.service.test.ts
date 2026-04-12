import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindRetryableSyncRecords = vi.fn();
const mockClaimSyncRecordForRetry = vi.fn();
const mockUpdateSyncRecord = vi.fn();
const mockScheduleSyncRecordRetry = vi.fn();
const mockMarkSyncRecordDeadLetter = vi.fn();

vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    findRetryableSyncRecords: (...args: unknown[]) =>
      mockFindRetryableSyncRecords(...args),
    claimSyncRecordForRetry: (...args: unknown[]) =>
      mockClaimSyncRecordForRetry(...args),
    updateSyncRecord: (...args: unknown[]) => mockUpdateSyncRecord(...args),
    scheduleSyncRecordRetry: (...args: unknown[]) =>
      mockScheduleSyncRecordRetry(...args),
    markSyncRecordDeadLetter: (...args: unknown[]) =>
      mockMarkSyncRecordDeadLetter(...args),
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

import { SquareOrderRetryService } from "../square-order-retry.service";
import { WEBHOOK_RETRY_POLICY } from "../square.types";

const service = new SquareOrderRetryService();

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    tenantId: "tenant-1",
    connectionId: "conn-1",
    syncType: "ORDER_PUSH",
    status: "failed",
    retryCount: 0,
    nextRetryAt: new Date("2026-01-01"),
    payload: {
      operation: "CREATE",
      tenantId: "tenant-1",
      merchantId: "merchant-1",
      input: {
        orderId: "order-1",
        orderNumber: "ORD-001",
        customerFirstName: "Jane",
        customerLastName: "Doe",
        customerPhone: "555-0100",
        items: [],
        totalAmount: 10,
        orderMode: "pickup",
      },
    },
    objectsSynced: 0,
    objectsMapped: 0,
    cursor: null,
    errorMessage: "Square down",
    stats: null,
    startedAt: new Date(),
    finishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SquareOrderRetryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches records, claims, and dispatches CREATE operation", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([makeRecord()]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockCreateOrder.mockResolvedValue({ squareOrderId: "sq-1" });
    mockUpdateSyncRecord.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockFindRetryableSyncRecords).toHaveBeenCalledWith(
      "ORDER_PUSH",
      20,
      expect.any(Date)
    );
    expect(mockClaimSyncRecordForRetry).toHaveBeenCalledWith(
      "rec-1",
      expect.any(Date),
      expect.any(Date)
    );
    expect(mockCreateOrder).toHaveBeenCalledWith(
      "tenant-1",
      "merchant-1",
      expect.objectContaining({ orderId: "order-1" })
    );
    expect(mockUpdateSyncRecord).toHaveBeenCalledWith("rec-1", {
      status: "success",
    });
    expect(result).toEqual({ processed: 1, retried: 0, deadLettered: 0 });
  });

  it("dispatches UPDATE_STATUS operation", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([
      makeRecord({
        payload: {
          operation: "UPDATE_STATUS",
          tenantId: "tenant-1",
          merchantId: "merchant-1",
          orderId: "order-1",
          fulfillmentStatus: "ready",
        },
      }),
    ]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockUpdateOrderStatus.mockResolvedValue(undefined);
    mockUpdateSyncRecord.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      "tenant-1",
      "merchant-1",
      "order-1",
      "ready"
    );
    expect(result.processed).toBe(1);
  });

  it("dispatches CANCEL operation", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([
      makeRecord({
        payload: {
          operation: "CANCEL",
          tenantId: "tenant-1",
          merchantId: "merchant-1",
          orderId: "order-1",
          cancelReason: "Customer request",
        },
      }),
    ]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockCancelOrder.mockResolvedValue(undefined);
    mockUpdateSyncRecord.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockCancelOrder).toHaveBeenCalledWith(
      "tenant-1",
      "merchant-1",
      "order-1",
      "Customer request"
    );
    expect(result.processed).toBe(1);
  });

  it("dead-letters after MAX_RETRIES", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([
      makeRecord({ retryCount: WEBHOOK_RETRY_POLICY.MAX_RETRIES - 1 }),
    ]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockCreateOrder.mockRejectedValue(new Error("still down"));
    mockMarkSyncRecordDeadLetter.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockMarkSyncRecordDeadLetter).toHaveBeenCalledWith(
      "rec-1",
      "still down"
    );
    expect(result).toEqual({ processed: 0, retried: 0, deadLettered: 1 });
  });

  it("schedules retry on failure before MAX_RETRIES", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([
      makeRecord({ retryCount: 1 }),
    ]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockCreateOrder.mockRejectedValue(new Error("transient"));
    mockScheduleSyncRecordRetry.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockScheduleSyncRecordRetry).toHaveBeenCalledWith(
      "rec-1",
      2,
      expect.any(Date),
      "transient"
    );
    expect(result).toEqual({ processed: 0, retried: 1, deadLettered: 0 });
  });

  it("dead-letters records with missing/corrupt payload", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([
      makeRecord({ payload: null }),
    ]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockMarkSyncRecordDeadLetter.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockMarkSyncRecordDeadLetter).toHaveBeenCalledWith(
      "rec-1",
      "Missing or invalid retry payload"
    );
    expect(result).toEqual({ processed: 0, retried: 0, deadLettered: 1 });
  });

  it("dead-letters records with payload missing operation field", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([
      makeRecord({ payload: { tenantId: "t1" } }),
    ]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockMarkSyncRecordDeadLetter.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockMarkSyncRecordDeadLetter).toHaveBeenCalledWith(
      "rec-1",
      "Missing or invalid retry payload"
    );
    expect(result.deadLettered).toBe(1);
  });

  it("skips records that fail to claim (concurrent worker)", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([makeRecord()]);
    mockClaimSyncRecordForRetry.mockResolvedValue(false);

    const result = await service.retryFailedOrderPushes();

    expect(mockCreateOrder).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, retried: 0, deadLettered: 0 });
  });

  it("returns zeros when no retryable records", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([]);

    const result = await service.retryFailedOrderPushes();

    expect(result).toEqual({ processed: 0, retried: 0, deadLettered: 0 });
  });

  it("handles non-Error exceptions in retry failure", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([
      makeRecord({ retryCount: 0 }),
    ]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockCreateOrder.mockRejectedValue("string error");
    mockScheduleSyncRecordRetry.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockScheduleSyncRecordRetry).toHaveBeenCalledWith(
      "rec-1",
      1,
      expect.any(Date),
      "Unknown error"
    );
    expect(result.retried).toBe(1);
  });

  it("respects custom batchSize", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([]);

    await service.retryFailedOrderPushes(5);

    expect(mockFindRetryableSyncRecords).toHaveBeenCalledWith(
      "ORDER_PUSH",
      5,
      expect.any(Date)
    );
  });

  it("throws on unknown operation and schedules retry instead of marking success", async () => {
    mockFindRetryableSyncRecords.mockResolvedValue([
      makeRecord({
        retryCount: 0,
        payload: {
          operation: "UNKNOWN_OP",
          tenantId: "tenant-1",
          merchantId: "merchant-1",
        },
      }),
    ]);
    mockClaimSyncRecordForRetry.mockResolvedValue(true);
    mockScheduleSyncRecordRetry.mockResolvedValue(undefined);

    const result = await service.retryFailedOrderPushes();

    expect(mockUpdateSyncRecord).not.toHaveBeenCalled();
    expect(mockScheduleSyncRecordRetry).toHaveBeenCalledWith(
      "rec-1",
      1,
      expect.any(Date),
      "Unknown order push operation: UNKNOWN_OP"
    );
    expect(result).toEqual({ processed: 0, retried: 1, deadLettered: 0 });
  });
});
