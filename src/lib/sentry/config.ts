/**
 * Shared Sentry configuration constants.
 *
 * Consumed by sentry.client.config.ts, sentry.server.config.ts,
 * and sentry.edge.config.ts at project root.
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

export const SENTRY_ENVIRONMENT =
  process.env.NODE_ENV === "production" ? "production" : "development";

/**
 * Performance tracing sample rate.
 * Keep low in production to avoid excessive billing.
 */
export const SENTRY_TRACES_SAMPLE_RATE =
  process.env.NODE_ENV === "production" ? 0.1 : 1.0;

/**
 * Whether Sentry is enabled — requires a non-empty DSN.
 */
export const SENTRY_ENABLED = SENTRY_DSN.length > 0;
