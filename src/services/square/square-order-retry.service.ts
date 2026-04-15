import { integrationRepository } from "@/repositories/integration.repository";
import { squareOrderService } from "./square-order.service";
import { WEBHOOK_RETRY_POLICY, computeNextRetryAt } from "@/lib/retry";
import {
  SQUARE_ORDER_SYNC_TYPE,
  ORDER_PUSH_OPERATION,
} from "./square.types";
import type { OrderPushRetryPayload } from "./square.types";

export class SquareOrderRetryService {
  async retryFailedOrderPushes(
    batchSize: number = 20
  ): Promise<{ processed: number; retried: number; deadLettered: number }> {
    const now = new Date();
    const records = await integrationRepository.findRetryableSyncRecords(
      SQUARE_ORDER_SYNC_TYPE,
      batchSize,
      now
    );

    let processed = 0;
    let retried = 0;
    let deadLettered = 0;

    for (const record of records) {
      const leaseExpiresAt = new Date(
        Date.now() + WEBHOOK_RETRY_POLICY.LEASE_MS
      );
      const claimed = await integrationRepository.claimSyncRecordForRetry(
        record.id,
        leaseExpiresAt,
        now
      );
      if (!claimed) continue;

      const payload = record.payload as unknown as OrderPushRetryPayload | null;
      if (!payload?.operation) {
        await integrationRepository.markSyncRecordDeadLetter(
          record.id,
          "Missing or invalid retry payload"
        );
        deadLettered += 1;
        continue;
      }

      try {
        await this.executeRetry(payload);
        await integrationRepository.updateSyncRecord(record.id, {
          status: "success",
        });
        processed += 1;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const nextCount = record.retryCount + 1;

        if (nextCount >= WEBHOOK_RETRY_POLICY.MAX_RETRIES) {
          await integrationRepository.markSyncRecordDeadLetter(
            record.id,
            errorMessage
          );
          deadLettered += 1;
        } else {
          const nextRetryAt = computeNextRetryAt(nextCount);
          await integrationRepository.scheduleSyncRecordRetry(
            record.id,
            nextCount,
            nextRetryAt,
            errorMessage
          );
          retried += 1;
        }
      }
    }

    return { processed, retried, deadLettered };
  }

  private async executeRetry(payload: OrderPushRetryPayload): Promise<void> {
    switch (payload.operation) {
      case ORDER_PUSH_OPERATION.CREATE:
        await squareOrderService.createOrder(
          payload.tenantId,
          payload.merchantId,
          payload.input
        );
        break;
      case ORDER_PUSH_OPERATION.UPDATE_STATUS:
        await squareOrderService.updateOrderStatus(
          payload.tenantId,
          payload.merchantId,
          payload.orderId,
          payload.fulfillmentStatus
        );
        break;
      case ORDER_PUSH_OPERATION.CANCEL:
        await squareOrderService.cancelOrder(
          payload.tenantId,
          payload.merchantId,
          payload.orderId,
          payload.cancelReason
        );
        break;
      default:
        throw new Error(
          `Unknown order push operation: ${(payload as Record<string, unknown>).operation}`
        );
    }
  }
}

export const squareOrderRetryService = new SquareOrderRetryService();
