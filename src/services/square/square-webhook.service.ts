import { integrationRepository } from "@/repositories/integration.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import { orderRepository } from "@/repositories/order.repository";
import { squareService } from "./square.service";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { SquareWebhookPayload } from "./square.types";
import { WEBHOOK_RETRY_POLICY, computeNextRetryAt } from "@/lib/retry";
import {
  REVERSE_FULFILLMENT_STATUS_MAP,
  FULFILLMENT_STATUS_RANK,
} from "./square.types";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "square-webhook" });

async function handleCatalogChange(connection: {
  tenantId: string;
  merchantId: string;
}): Promise<void> {
  const merchant = await merchantRepository.getById(connection.merchantId);
  if (!merchant) {
    log.error({ merchantId: connection.merchantId }, "Merchant not found");
    return;
  }
  log.info({ merchantId: connection.merchantId }, "Triggering catalog re-sync");
  try {
    await squareService.syncCatalog(
      connection.tenantId,
      connection.merchantId,
      true
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ALREADY_RUNNING")) {
      throw error;
    }
    log.info({ merchantId: connection.merchantId }, "Catalog sync already running, skipped");
  }
}

async function handleOrderUpdate(
  payload: SquareWebhookPayload,
  tenantId: string
): Promise<void> {
  const squareOrderId = payload.data.id;
  const orderObj = (
    payload.data.object as Record<string, unknown>
  )?.order as
    | {
        id: string;
        version?: number;
        fulfillments?: Array<{
          state: string;
          pickup_details?: { cancel_reason?: string };
        }>;
      }
    | undefined;

  const incomingVersion =
    typeof orderObj?.version === "number" ? orderObj.version : null;
  const squareFulfillment = orderObj?.fulfillments?.[0];
  const squareFulfillmentState = squareFulfillment?.state;
  if (!squareFulfillmentState) {
    log.info({ squareOrderId }, "No fulfillment state in order update, skipping");
    return;
  }

  const isCancellation =
    squareFulfillmentState === "CANCELED" ||
    squareFulfillmentState === "FAILED";
  if (
    !isCancellation &&
    !REVERSE_FULFILLMENT_STATUS_MAP[squareFulfillmentState]
  ) {
    log.info({ squareOrderId, squareFulfillmentState }, "Unknown Square fulfillment state");
    return;
  }

  const mapping = await integrationRepository.getIdMappingByExternalId(
    tenantId,
    "SQUARE",
    squareOrderId
  );
  if (!mapping) {
    log.warn(
      { squareOrderId, tenantId, event: "order.updated" },
      "MAPPING_MISS: No ExternalIdMapping for Square order. This order may not have been pushed from plovr."
    );
    return;
  }

  // Load the OrderFulfillment (source of truth for fulfillment state)
  const { fulfillmentService } = await import("@/services/order/fulfillment.service");
  const fulfillment = await fulfillmentService.getFulfillmentByOrderId(tenantId, mapping.internalId);
  if (!fulfillment) {
    log.info({ orderId: mapping.internalId }, "No fulfillment found for order, skipping");
    return;
  }

  // Load the order for payment-level status checks (cancellation guard)
  const order = await orderRepository.getStatusById(
    tenantId,
    mapping.internalId
  );
  if (!order) {
    log.info({ orderId: mapping.internalId }, "Order not found for mapping, skipping");
    return;
  }

  // Optimistic-concurrency guard: Square stamps an incrementing
  // `version` on every order edit. If we've already applied a newer
  // version, ignore this webhook.
  if (
    incomingVersion !== null &&
    fulfillment.externalVersion !== null &&
    incomingVersion <= fulfillment.externalVersion
  ) {
    log.info(
      { orderId: mapping.internalId, incomingVersion, currentVersion: fulfillment.externalVersion },
      "Ignoring stale webhook"
    );
    return;
  }

  // Bump version even when this webhook is a no-op, to prevent stale replays.
  const bumpVersionIfNewer = async (): Promise<void> => {
    if (
      incomingVersion !== null &&
      (fulfillment.externalVersion === null ||
        incomingVersion > fulfillment.externalVersion)
    ) {
      await fulfillmentService.bumpExternalVersion(fulfillment.id, incomingVersion);
    }
  };

  // Terminal cancellation states from Square
  if (isCancellation) {
    if (order.status === "canceled") {
      await bumpVersionIfNewer();
      return;
    }
    const cancelReason =
      squareFulfillment?.pickup_details?.cancel_reason?.trim() ||
      (squareFulfillmentState === "FAILED"
        ? "Fulfillment failed on Square"
        : "Canceled on Square POS");

    // Cancel the fulfillment — only ignore "already in terminal state" errors;
    // re-throw real failures (DB errors, etc.) to prevent inconsistency.
    try {
      await fulfillmentService.transitionStatus(tenantId, mapping.internalId, {
        fulfillmentStatus: "canceled",
        source: "square_webhook",
        externalVersion: incomingVersion ?? undefined,
        metadata: { cancelReason },
      });
    } catch (error) {
      const isAlreadyTerminal =
        error instanceof AppError &&
        error.code === ErrorCodes.INVALID_FULFILLMENT_STATUS_TRANSITION;
      if (!isAlreadyTerminal) throw error;
    }

    // Cancel the order (payment-level)
    const { orderService } = await import("@/services/order/order.service");
    await orderService.cancelOrder(tenantId, mapping.internalId, cancelReason, {
      source: "square_webhook",
    });
    log.info(
      { orderId: mapping.internalId, squareFulfillmentState },
      "Order canceled via Square"
    );
    return;
  }

  const internalStatus =
    REVERSE_FULFILLMENT_STATUS_MAP[squareFulfillmentState];

  // Monotonic guard: ignore regressive states
  if (order.status === "canceled") {
    await bumpVersionIfNewer();
    return;
  }
  const currentRank = FULFILLMENT_STATUS_RANK[fulfillment.status] ?? -1;
  const incomingRank = FULFILLMENT_STATUS_RANK[internalStatus] ?? -1;
  if (incomingRank < currentRank) {
    log.info(
      { orderId: mapping.internalId, currentStatus: fulfillment.status, incomingStatus: internalStatus },
      "Ignoring regressive fulfillment state"
    );
    await bumpVersionIfNewer();
    return;
  }
  if (incomingRank === currentRank) {
    await bumpVersionIfNewer();
    return;
  }

  await fulfillmentService.transitionStatus(
    tenantId,
    mapping.internalId,
    {
      fulfillmentStatus: internalStatus as import("@/types").FulfillmentStatus,
      source: "square_webhook",
      externalVersion: incomingVersion ?? undefined,
    }
  );

  log.info(
    { orderId: mapping.internalId, fulfillmentStatus: internalStatus },
    "Order fulfillment updated"
  );
}

async function handlePaymentEvent(
  payload: SquareWebhookPayload,
  tenantId: string
): Promise<void> {
  const paymentObj = (
    payload.data.object as Record<string, unknown>
  )?.payment as
    | { id: string; order_id?: string; status?: string }
    | undefined;

  const squareOrderId = paymentObj?.order_id;
  if (!squareOrderId) {
    log.info("No order_id in payment event, skipping");
    return;
  }

  const mapping = await integrationRepository.getIdMappingByExternalId(
    tenantId,
    "SQUARE",
    squareOrderId
  );
  if (!mapping) {
    log.warn(
      { squareOrderId, tenantId, event: "payment" },
      "MAPPING_MISS: No ExternalIdMapping for Square order. This order may not have been pushed from plovr."
    );
    return;
  }

  const paymentStatus = paymentObj?.status;
  if (paymentStatus === "COMPLETED") {
    const { orderService } = await import("@/services/order/order.service");
    await orderService.updatePaymentStatus(tenantId, mapping.internalId, "completed", {
      source: "square_webhook",
    });
    log.info({ orderId: mapping.internalId }, "Order payment completed");
    return;
  }

  if (paymentStatus === "FAILED") {
    const { orderService } = await import("@/services/order/order.service");
    await orderService.updatePaymentStatus(tenantId, mapping.internalId, "payment_failed", {
      source: "square_webhook",
    });
    log.info({ orderId: mapping.internalId }, "Order payment failed via Square");
  }
}

async function routeEvent(
  eventType: string,
  payload: SquareWebhookPayload,
  connection: { tenantId: string; merchantId: string; id: string }
): Promise<void> {
  switch (eventType) {
    case "catalog.version.updated":
      await handleCatalogChange(connection);
      break;
    case "order.updated":
      await handleOrderUpdate(payload, connection.tenantId);
      break;
    case "payment.completed":
    case "payment.updated":
      await handlePaymentEvent(payload, connection.tenantId);
      break;
    default:
      log.info({ eventType }, "Unhandled event type");
  }
}

/**
 * Retry failed webhook events whose next_retry_at has elapsed.
 * Uses exponential backoff; after WEBHOOK_RETRY_POLICY.MAX_RETRIES the
 * event is moved to dead_letter.
 *
 * Intended to be invoked from a scheduled cron endpoint.
 */
async function retryFailedEvents(
  batchSize: number = 20
): Promise<{ processed: number; retried: number; deadLettered: number }> {
  const events = await integrationRepository.findRetryableWebhookEvents(
    batchSize
  );

  let processed = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const event of events) {
    const leaseExpiresAt = new Date(
      Date.now() + WEBHOOK_RETRY_POLICY.LEASE_MS
    );
    const claimed = await integrationRepository.claimWebhookEventForRetry(
      event.id,
      leaseExpiresAt
    );
    if (!claimed) {
      continue;
    }

    const payload = event.payload as unknown as SquareWebhookPayload;
    const connection = {
      id: event.connectionId,
      tenantId: event.tenantId,
      merchantId: event.merchantId,
    };

    try {
      await routeEvent(event.eventType, payload, connection);
      await integrationRepository.markWebhookEventProcessed(event.id);
      processed += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const nextCount = event.retryCount + 1;
      log.error(
        { eventId: event.id, eventType: event.eventType, retryCount: nextCount, maxRetries: WEBHOOK_RETRY_POLICY.MAX_RETRIES, error: errorMessage },
        "Webhook retry failed"
      );

      if (nextCount >= WEBHOOK_RETRY_POLICY.MAX_RETRIES) {
        await integrationRepository.markWebhookEventDeadLetter(
          event.id,
          errorMessage
        );
        deadLettered += 1;
      } else {
        const nextRetryAt = computeNextRetryAt(nextCount);
        await integrationRepository.scheduleWebhookEventRetry(
          event.id,
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

export const squareWebhookService = {
  retryFailedEvents,
  routeEvent,
};
