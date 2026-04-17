import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import type { FulfillmentStatus } from "@/types";
import type { FulfillmentChangeSource } from "@/types";
import { AppError, ErrorCodes } from "@/lib/errors";

export class FulfillmentRepository {
  /**
   * Create a new OrderFulfillment record.
   */
  async create(
    tenantId: string,
    data: {
      orderId: string;
      merchantId: string;
      posProvider?: string;
      externalVersion?: number;
    },
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    return db.orderFulfillment.create({
      data: {
        tenantId,
        orderId: data.orderId,
        merchantId: data.merchantId,
        status: "pending",
        posProvider: data.posProvider ?? null,
        externalVersion: data.externalVersion ?? null,
      },
    });
  }

  /**
   * Get fulfillment by order ID. Returns the first fulfillment (1:1 for now).
   */
  async getByOrderId(tenantId: string, orderId: string) {
    return prisma.orderFulfillment.findFirst({
      where: { tenantId, orderId },
    });
  }

  /**
   * Get fulfillment by ID.
   */
  async getById(tenantId: string, fulfillmentId: string) {
    return prisma.orderFulfillment.findFirst({
      where: { tenantId, id: fulfillmentId },
    });
  }

  /**
   * Update fulfillment status + timestamp + write status log in a single transaction.
   * Also syncs Order.fulfillmentStatus as a cache field.
   */
  async transitionStatus(
    tenantId: string,
    fulfillmentId: string,
    orderId: string,
    fromStatus: FulfillmentStatus,
    toStatus: FulfillmentStatus,
    source: FulfillmentChangeSource,
    options?: {
      actorId?: string;
      metadata?: Record<string, unknown>;
      externalVersion?: number;
      cancelReason?: string;
    },
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    const now = new Date();

    // Build the fulfillment update data
    const fulfillmentUpdate: Record<string, unknown> = {
      status: toStatus,
    };

    // Set the appropriate timestamp field
    const timestampField = FULFILLMENT_TIMESTAMP_FIELD[toStatus];
    if (timestampField) {
      fulfillmentUpdate[timestampField] = now;
    }

    if (options?.externalVersion !== undefined) {
      fulfillmentUpdate.externalVersion = options.externalVersion;
    }

    if (toStatus === "canceled" && options?.cancelReason) {
      fulfillmentUpdate.cancelReason = options.cancelReason;
    }

    // Execute all three writes atomically with optimistic locking.
    // The WHERE clause on status=fromStatus ensures that if another request
    // already changed the status between our read and write, we detect it
    // instead of silently overwriting the newer state.
    const runInTx = async (client: DbClient) => {
      // 1. Update OrderFulfillment with optimistic lock (CAS on status)
      const result = await client.orderFulfillment.updateMany({
        where: { id: fulfillmentId, status: fromStatus },
        data: fulfillmentUpdate,
      });
      if (result.count === 0) {
        throw new AppError(ErrorCodes.FULFILLMENT_CONCURRENT_CONFLICT, {
          fulfillmentId,
          expectedStatus: fromStatus,
          targetStatus: toStatus,
        });
      }

      // Fetch the updated record to return
      const fulfillment = await client.orderFulfillment.findUniqueOrThrow({
        where: { id: fulfillmentId },
      });

      await Promise.all([
        // 2. Write FulfillmentStatusLog
        client.fulfillmentStatusLog.create({
          data: {
            tenantId,
            fulfillmentId,
            fromStatus,
            toStatus,
            source,
            actorId: options?.actorId ?? null,
            metadata: (options?.metadata as Prisma.InputJsonValue) ?? undefined,
          },
        }),
        // 3. Sync Order.fulfillmentStatus cache
        client.order.update({
          where: { id: orderId },
          data: { fulfillmentStatus: toStatus },
        }),
      ]);
      return fulfillment;
    };

    // If caller provided a tx, use it directly; otherwise wrap in $transaction
    if (tx) {
      return runInTx(db);
    }
    return prisma.$transaction(async (txClient) => runInTx(txClient));
  }

  /**
   * Get status change history for a fulfillment, ordered chronologically.
   */
  async getStatusHistory(tenantId: string, fulfillmentId: string) {
    return prisma.fulfillmentStatusLog.findMany({
      where: { tenantId, fulfillmentId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get fulfillments for an order (supports future 1:N).
   */
  async getByOrderIds(tenantId: string, orderIds: string[]) {
    return prisma.orderFulfillment.findMany({
      where: { tenantId, orderId: { in: orderIds } },
    });
  }

  /**
   * Bump the external version without changing status.
   * Used when a webhook is a no-op but carries a newer version.
   */
  async bumpExternalVersion(
    fulfillmentId: string,
    externalVersion: number
  ) {
    return prisma.orderFulfillment.update({
      where: { id: fulfillmentId },
      data: { externalVersion },
    });
  }

  /**
   * Bump a fulfillment's externalVersion by orderId, only if the new version
   * is strictly newer than the currently stored one (or the stored one is
   * null). Atomic updateMany with a guard in the WHERE clause makes this
   * safe against concurrent writers racing for the version bump.
   *
   * Used by SquareOrderService.persistSquareOrderVersion (#109) so a late
   * echo carrying an older version cannot overwrite a newer one.
   */
  async bumpExternalVersionByOrderIdIfNewer(
    orderId: string,
    version: number
  ) {
    return prisma.orderFulfillment.updateMany({
      where: {
        orderId,
        OR: [
          { externalVersion: null },
          { externalVersion: { lt: version } },
        ],
      },
      data: { externalVersion: version },
    });
  }
}

const FULFILLMENT_TIMESTAMP_FIELD: Record<string, string> = {
  confirmed: "confirmedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  fulfilled: "fulfilledAt",
  canceled: "cancelledAt",
};

export const fulfillmentRepository = new FulfillmentRepository();
