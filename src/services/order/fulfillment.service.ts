import type { DbClient } from "@/lib/db";
import type { FulfillmentStatus } from "@/types";
import { AppError, ErrorCodes } from "@/lib/errors";
import { fulfillmentRepository } from "@/repositories/fulfillment.repository";
import { assertTransition } from "./fulfillment-state-machine";
import { orderEventEmitter } from "./order-events";
import type { FulfillmentEventType, OrderEventSource } from "./order-events.types";
import type {
  CreateFulfillmentInput,
  TransitionStatusInput,
  StatusLogEntry,
} from "./fulfillment.types";

const FULFILLMENT_EVENT_MAP: Record<string, FulfillmentEventType> = {
  confirmed: "order.fulfillment.confirmed",
  preparing: "order.fulfillment.preparing",
  ready: "order.fulfillment.ready",
  fulfilled: "order.fulfillment.fulfilled",
  canceled: "order.fulfillment.canceled",
};

export class FulfillmentService {
  /**
   * Create a fulfillment for an order (called during order creation).
   */
  async createFulfillment(
    tenantId: string,
    input: CreateFulfillmentInput,
    tx?: DbClient
  ) {
    return fulfillmentRepository.create(tenantId, input, tx);
  }

  /**
   * Transition fulfillment status with full state machine validation.
   * Atomically updates: FulfillmentStatusLog + OrderFulfillment + Order.fulfillmentStatus
   */
  async transitionStatus(
    tenantId: string,
    orderId: string,
    input: TransitionStatusInput
  ): Promise<void> {
    const fulfillment = await fulfillmentRepository.getByOrderId(tenantId, orderId);
    if (!fulfillment) {
      throw new AppError(ErrorCodes.ORDER_NOT_FOUND, { orderId });
    }

    const fromStatus = fulfillment.status as FulfillmentStatus;
    const toStatus = input.fulfillmentStatus;

    // Validate state machine transition
    assertTransition(fromStatus, toStatus);

    // Atomic: StatusLog + Fulfillment update + Order cache sync
    await fulfillmentRepository.transitionStatus(
      tenantId,
      fulfillment.id,
      orderId,
      fromStatus,
      toStatus,
      input.source,
      {
        actorId: input.actorId,
        metadata: input.metadata,
        externalVersion: input.externalVersion,
        cancelReason: input.metadata?.cancelReason as string | undefined,
      }
    );

    // Emit event after successful write — every reachable toStatus
    // has an event mapping (you can't transition TO "pending")
    const eventType = FULFILLMENT_EVENT_MAP[toStatus];
    orderEventEmitter.emit(eventType, {
      orderId,
      orderNumber: "",
      merchantId: fulfillment.merchantId,
      tenantId,
      timestamp: new Date(),
      fulfillmentId: fulfillment.id,
      fulfillmentStatus: toStatus,
      previousFulfillmentStatus: fromStatus,
      source: input.source as OrderEventSource,
    });
  }

  /**
   * Transition fulfillment status by fulfillment ID (for direct fulfillment operations).
   */
  async transitionStatusByFulfillmentId(
    tenantId: string,
    fulfillmentId: string,
    input: TransitionStatusInput
  ): Promise<void> {
    const fulfillment = await fulfillmentRepository.getById(tenantId, fulfillmentId);
    if (!fulfillment) {
      throw new AppError(ErrorCodes.ORDER_NOT_FOUND, { fulfillmentId });
    }

    const fromStatus = fulfillment.status as FulfillmentStatus;
    const toStatus = input.fulfillmentStatus;

    assertTransition(fromStatus, toStatus);

    await fulfillmentRepository.transitionStatus(
      tenantId,
      fulfillmentId,
      fulfillment.orderId,
      fromStatus,
      toStatus,
      input.source,
      {
        actorId: input.actorId,
        metadata: input.metadata,
        externalVersion: input.externalVersion,
        cancelReason: input.metadata?.cancelReason as string | undefined,
      }
    );

    const eventType = FULFILLMENT_EVENT_MAP[toStatus];
    orderEventEmitter.emit(eventType, {
      orderId: fulfillment.orderId,
      orderNumber: "",
      merchantId: fulfillment.merchantId,
      tenantId,
      timestamp: new Date(),
      fulfillmentId,
      fulfillmentStatus: toStatus,
      previousFulfillmentStatus: fromStatus,
      source: input.source as OrderEventSource,
    });
  }

  /**
   * Get fulfillment for an order.
   */
  async getFulfillmentByOrderId(tenantId: string, orderId: string) {
    return fulfillmentRepository.getByOrderId(tenantId, orderId);
  }

  /**
   * Get status change history for a fulfillment.
   */
  async getStatusHistory(tenantId: string, fulfillmentId: string): Promise<StatusLogEntry[]> {
    const logs = await fulfillmentRepository.getStatusHistory(tenantId, fulfillmentId);
    return logs.map((log) => ({
      id: log.id,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      source: log.source,
      actorId: log.actorId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Bump the external version on a fulfillment without changing status.
   * Used by webhook handlers when the event is a no-op but version is newer.
   */
  async bumpExternalVersion(
    fulfillmentId: string,
    externalVersion: number
  ): Promise<void> {
    await fulfillmentRepository.bumpExternalVersion(fulfillmentId, externalVersion);
  }
}

export const fulfillmentService = new FulfillmentService();
