import { integrationRepository } from "@/repositories/integration.repository";
import { squareService } from "./square.service";
import prisma from "@/lib/db";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { SquareWebhookPayload } from "./square.types";
import {
  REVERSE_FULFILLMENT_STATUS_MAP,
  FULFILLMENT_STATUS_RANK,
  WEBHOOK_RETRY_POLICY,
  computeNextRetryAt,
} from "./square.types";

export class SquareWebhookService {

  /**
   * Retry failed webhook events whose next_retry_at has elapsed.
   * Uses exponential backoff; after WEBHOOK_RETRY_POLICY.MAX_RETRIES the
   * event is moved to dead_letter.
   *
   * Intended to be invoked from a scheduled cron endpoint.
   */
  async retryFailedEvents(
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
        await this.routeEvent(event.eventType, payload, connection);
        await integrationRepository.markWebhookEventProcessed(event.id);
        processed += 1;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const nextCount = event.retryCount + 1;
        console.error(
          `[Square Webhook] Retry ${nextCount}/${WEBHOOK_RETRY_POLICY.MAX_RETRIES} failed for ${event.eventType} (${event.id}):`,
          errorMessage
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

  async routeEvent(
    eventType: string,
    payload: SquareWebhookPayload,
    connection: { tenantId: string; merchantId: string; id: string }
  ): Promise<void> {
    switch (eventType) {
      case "catalog.version.updated":
        await this.handleCatalogChange(connection);
        break;
      case "order.updated":
        await this.handleOrderUpdate(payload, connection.tenantId);
        break;
      case "payment.completed":
      case "payment.updated":
        await this.handlePaymentEvent(payload, connection.tenantId);
        break;
      default:
        console.log(
          `[Square Webhook] Unhandled event type: ${eventType}`
        );
    }
  }

  private async handleCatalogChange(connection: {
    tenantId: string;
    merchantId: string;
  }): Promise<void> {
    const merchant = await prisma.merchant.findFirst({
      where: { id: connection.merchantId },
      select: { tenantId: true },
    });
    if (!merchant) {
      console.error(
        `[Square Webhook] Merchant not found: ${connection.merchantId}`
      );
      return;
    }
    console.log(
      `[Square Webhook] Triggering catalog re-sync for merchant: ${connection.merchantId}`
    );
    try {
      await squareService.syncCatalog(
        connection.tenantId,
        connection.merchantId
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("ALREADY_RUNNING")) {
        throw error;
      }
      console.log("[Square Webhook] Catalog sync already running, skipped");
    }
  }

  private async handleOrderUpdate(
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
      console.log(
        "[Square Webhook] No fulfillment state in order update, skipping"
      );
      return;
    }

    const isCancellation =
      squareFulfillmentState === "CANCELED" ||
      squareFulfillmentState === "FAILED";
    if (
      !isCancellation &&
      !REVERSE_FULFILLMENT_STATUS_MAP[squareFulfillmentState]
    ) {
      console.log(
        `[Square Webhook] Unknown Square fulfillment state: ${squareFulfillmentState}`
      );
      return;
    }

    const mapping = await integrationRepository.getIdMappingByExternalId(
      tenantId,
      "SQUARE",
      squareOrderId
    );
    if (!mapping) {
      console.warn(
        `[Square Webhook] MAPPING_MISS: No ExternalIdMapping for Square order ${squareOrderId} (tenant: ${tenantId}, event: order.updated). This order may not have been pushed from plovr.`
      );
      return;
    }

    // Load the OrderFulfillment (source of truth for fulfillment state)
    const { fulfillmentService } = await import("@/services/order/fulfillment.service");
    const fulfillment = await fulfillmentService.getFulfillmentByOrderId(tenantId, mapping.internalId);
    if (!fulfillment) {
      console.log(
        `[Square Webhook] No fulfillment found for order: ${mapping.internalId}, skipping`
      );
      return;
    }

    // Load the order for payment-level status checks (cancellation guard)
    const order = await prisma.order.findUnique({
      where: { id: mapping.internalId },
      select: { status: true },
    });
    if (!order) {
      console.log(
        `[Square Webhook] Order not found for mapping: ${mapping.internalId}, skipping`
      );
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
      console.log(
        `[Square Webhook] Ignoring stale webhook for ${mapping.internalId}: incoming v${incomingVersion} <= current v${fulfillment.externalVersion}`
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
      console.log(
        `[Square Webhook] Order ${mapping.internalId} canceled via Square (${squareFulfillmentState})`
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
      console.log(
        `[Square Webhook] Ignoring regressive fulfillment state for ${mapping.internalId}: ${fulfillment.status} → ${internalStatus}`
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

    console.log(
      `[Square Webhook] Order ${mapping.internalId} fulfillment updated to: ${internalStatus}`
    );
  }

  private async handlePaymentEvent(
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
      console.log(
        "[Square Webhook] No order_id in payment event, skipping"
      );
      return;
    }

    const mapping = await integrationRepository.getIdMappingByExternalId(
      tenantId,
      "SQUARE",
      squareOrderId
    );
    if (!mapping) {
      console.warn(
        `[Square Webhook] MAPPING_MISS: No ExternalIdMapping for Square order ${squareOrderId} (tenant: ${tenantId}, event: payment). This order may not have been pushed from plovr.`
      );
      return;
    }

    const paymentStatus = paymentObj?.status;
    if (paymentStatus === "COMPLETED") {
      const { orderService } = await import("@/services/order/order.service");
      await orderService.updatePaymentStatus(tenantId, mapping.internalId, "completed", {
        source: "square_webhook",
      });
      console.log(
        `[Square Webhook] Order ${mapping.internalId} payment completed`
      );
      return;
    }

    if (paymentStatus === "FAILED") {
      const { orderService } = await import("@/services/order/order.service");
      await orderService.updatePaymentStatus(tenantId, mapping.internalId, "payment_failed", {
        source: "square_webhook",
      });
      console.log(
        `[Square Webhook] Order ${mapping.internalId} payment_failed via Square`
      );
    }
  }
}

export const squareWebhookService = new SquareWebhookService();
