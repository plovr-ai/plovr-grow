/**
 * Retry policy and helpers for failed webhook / order-push events.
 * Extracted from square.types.ts so that repositories can depend on
 * this pure-logic module without pulling in the entire Square service.
 */

/**
 * Retry policy for failed webhook events.
 * Exponential backoff: delay = BASE_DELAY_MS * 2^retryCount, capped at MAX_DELAY_MS.
 * After MAX_RETRIES attempts, events transition to dead_letter.
 */
export const WEBHOOK_RETRY_POLICY = {
  MAX_RETRIES: 5,
  BASE_DELAY_MS: 60_000,
  MAX_DELAY_MS: 60 * 60 * 1000,
  // A claimed retry job must complete within this window or it becomes
  // reclaimable by a subsequent cron run. Needs to exceed the cron execution
  // timeout; 10 minutes is comfortably above Vercel's default function limit.
  LEASE_MS: 10 * 60 * 1000,
} as const;

export function computeNextRetryAt(
  retryCount: number,
  now: Date = new Date()
): Date {
  const delay = Math.min(
    WEBHOOK_RETRY_POLICY.BASE_DELAY_MS * Math.pow(2, retryCount),
    WEBHOOK_RETRY_POLICY.MAX_DELAY_MS
  );
  return new Date(now.getTime() + delay);
}
