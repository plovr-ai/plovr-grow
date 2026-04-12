import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import type { FulfillmentStatus } from "@/types";
import type { FulfillmentChangeSource } from "@/services/order/fulfillment.types";

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

    // Execute all three writes atomically
    const runInTx = async (client: DbClient) => {
      const [fulfillment] = await Promise.all([
        // 1. Update OrderFulfillment
        client.orderFulfillment.update({
          where: { id: fulfillmentId },
          data: fulfillmentUpdate,
        }),
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
}

const FULFILLMENT_TIMESTAMP_FIELD: Record<string, string> = {
  confirmed: "confirmedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  fulfilled: "fulfilledAt",
  canceled: "cancelledAt",
};

export const fulfillmentRepository = new FulfillmentRepository();
