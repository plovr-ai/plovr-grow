import type { FulfillmentStatus } from "@/types";
import { AppError, ErrorCodes } from "@/lib/errors";

/**
 * Allowed fulfillment status transitions.
 *
 * Each key lists the statuses it may transition **to**. Forward jumps that
 * skip intermediate states are permitted (e.g. pending → ready) because
 * coarse POS integrations like Square may collapse multiple internal states
 * into a single external state, producing valid forward-progress webhooks
 * that skip steps.
 *
 * Terminal states (`fulfilled`, `canceled`) have no outgoing transitions.
 */
export const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  pending:   ["confirmed", "preparing", "ready", "fulfilled", "canceled"],
  confirmed: ["preparing", "ready", "fulfilled", "canceled"],
  preparing: ["ready", "fulfilled", "canceled"],
  ready:     ["fulfilled", "canceled"],
  fulfilled: [],
  canceled:  [],
} as const;

/**
 * Check whether transitioning from `from` to `to` is allowed.
 *
 * Returns `false` (rather than throwing) when `from` is an unknown status
 * not present in the transition table — this is defensive against legacy
 * or corrupt DB values.
 */
export function canTransition(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  const allowed = FULFILLMENT_TRANSITIONS[from] as readonly FulfillmentStatus[] | undefined;
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Assert that the transition is allowed; throw `AppError` if not.
 */
export function assertTransition(from: FulfillmentStatus, to: FulfillmentStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      ErrorCodes.INVALID_FULFILLMENT_STATUS_TRANSITION,
      { from, to },
    );
  }
}
