/**
 * Dev-only Prisma query instrumentation.
 *
 * When `DB_PERF_LOG=1`:
 *   - `maybeAttachDbPerf` wraps the Prisma client with a `$extends` that
 *     records every query's duration and buckets them per request.
 *   - A short (300ms) idle flush timer writes a summary to stdout when the
 *     request goes quiet, including a simple N+1 heuristic.
 *
 * When the flag is unset, `maybeAttachDbPerf` is a no-op and returns the
 * passed-in client reference unchanged (zero runtime overhead).
 *
 * This module is intentionally a dev tool only — never enable it in
 * production. See `docs/superpowers/specs/2026-04-17-db-query-perf-analysis-design.md`.
 */
import type { PrismaClient } from "@prisma/client";

/** A single query recorded by the Prisma extension. */
export interface RecordedQuery {
  model: string;
  op: string;
  durationMs: number;
}

/** Per-request aggregation bucket. */
interface DbPerfStore {
  requestId: string;
  route: string;
  firstQueryAt: number;
  queries: RecordedQuery[];
  flushTimer: NodeJS.Timeout | null;
}

/** Idle-flush window. If 300ms pass with no new query the bucket is emitted. */
const FLUSH_IDLE_MS = 300;

/** Minimum number of identical `${model}.${op}` calls for the N+1 heuristic. */
const N1_MIN_COUNT = 3;

/** Maximum coefficient of variation (stddev/mean) for N+1 flagging. */
const N1_MAX_CV = 0.5;

const stores = new Map<string, DbPerfStore>();

/**
 * Fallback bucket heuristic — used when `next/headers` is unavailable or
 * does not expose an `x-db-perf-req` header (i.e. the proxy/middleware
 * matcher does not cover the current route). We rotate the fallback bucket
 * whenever more than `FLUSH_IDLE_MS` has passed since the last fallback
 * query. This means a sequential `curl` pattern with gaps > 300ms produces
 * one bucket per request, which is exactly the collection methodology the
 * report relies on. Rapid concurrent requests without a header would still
 * merge — that's a known limitation and is called out in the report.
 */
let fallbackCounter = 0;
let lastFallbackKey: string | null = null;
let lastFallbackAt = 0;

export function getFallbackBucketKey(now: number = performance.now()): string {
  if (lastFallbackKey && now - lastFallbackAt < FLUSH_IDLE_MS) {
    lastFallbackAt = now;
    return lastFallbackKey;
  }
  fallbackCounter += 1;
  lastFallbackKey = `unk_${fallbackCounter}`;
  lastFallbackAt = now;
  return lastFallbackKey;
}

/** Test-only helper to reset fallback counter state between cases. */
export function _resetFallbackBucketStateForTest(): void {
  fallbackCounter = 0;
  lastFallbackKey = null;
  lastFallbackAt = 0;
}

const FALLBACK_ROUTE_LABEL = "(no route header — sequential curl assumed)";

/**
 * Pure helper — exported for unit testing. Given a list of queries, return a
 * list of human-readable descriptions for `${model}.${op}` pairs that look
 * like N+1 suspects (count >= 3 and low variance in per-call duration).
 */
export function detectN1(queries: RecordedQuery[]): string[] {
  const groups = new Map<string, number[]>();
  for (const q of queries) {
    const key = `${q.model}.${q.op}`;
    const list = groups.get(key);
    if (list) {
      list.push(q.durationMs);
    } else {
      groups.set(key, [q.durationMs]);
    }
  }

  const suspects: string[] = [];
  for (const [key, durations] of groups) {
    if (durations.length < N1_MIN_COUNT) continue;
    const n = durations.length;
    const mean = durations.reduce((s, d) => s + d, 0) / n;
    if (mean <= 0) continue; // can't compute CV reliably
    const variance =
      durations.reduce((s, d) => s + (d - mean) * (d - mean), 0) / n;
    const stddev = Math.sqrt(variance);
    const cv = stddev / mean;
    if (cv < N1_MAX_CV) {
      suspects.push(
        `${key} x${n} (mean=${mean.toFixed(1)}ms, cv=${cv.toFixed(2)}) — consider merging into one batched query`
      );
    }
  }
  return suspects;
}

/**
 * Format durations with right-aligned `ms` suffix (e.g. "  4.8ms").
 */
function fmtMs(ms: number, width: number): string {
  const s = `${ms.toFixed(1)}ms`;
  return s.padStart(width, " ");
}

function flushStore(requestId: string): void {
  const store = stores.get(requestId);
  if (!store) return;
  stores.delete(requestId);

  const { queries, route } = store;
  if (queries.length === 0) return;

  const totalMs = queries.reduce((s, q) => s + q.durationMs, 0);
  const slowestIdx = queries.reduce(
    (best, q, i, arr) => (q.durationMs > arr[best].durationMs ? i : best),
    0
  );

  // Column widths for aligned output.
  const maxLabelLen = queries.reduce(
    (max, q) => Math.max(max, `${q.model}.${q.op}`.length),
    0
  );
  const maxMsLen = queries.reduce(
    (max, q) => Math.max(max, `${q.durationMs.toFixed(1)}ms`.length),
    0
  );

  const lines: string[] = [];
  lines.push(
    `[db-perf] ${route} req_${requestId}  queries=${queries.length}  total=${totalMs.toFixed(1)}ms`
  );
  queries.forEach((q, i) => {
    const label = `${q.model}.${q.op}`.padEnd(maxLabelLen, " ");
    const ms = fmtMs(q.durationMs, maxMsLen);
    const suffix = i === slowestIdx && queries.length > 1 ? "  <- slowest" : "";
    lines.push(`  ${String(i + 1).padStart(2, " ")}. ${label}  ${ms}${suffix}`);
  });

  const suspects = detectN1(queries);
  for (const s of suspects) {
    lines.push(`  ! N+1 suspect: ${s}`);
  }

  // One console.log call — keeps the block together in the dev terminal.
  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

async function recordQuery(q: RecordedQuery): Promise<void> {
  let requestId: string | null = null;
  let route: string | null = null;
  try {
    // `next/headers` is only available in a request scope. We dynamically
    // import to avoid pulling it in non-server environments.
    const { headers } = await import("next/headers");
    const h = await headers();
    requestId = h.get("x-db-perf-req");
    route = h.get("x-db-perf-route");
  } catch {
    // Fall through — next/headers not available in this scope.
  }

  // If the proxy/middleware didn't inject the request-scoped headers (for
  // routes outside its matcher), rotate through sliding fallback buckets.
  if (!requestId) {
    requestId = getFallbackBucketKey();
    route = FALLBACK_ROUTE_LABEL;
  } else if (!route) {
    route = FALLBACK_ROUTE_LABEL;
  }

  let store = stores.get(requestId);
  if (!store) {
    store = {
      requestId,
      route,
      firstQueryAt: performance.now(),
      queries: [],
      flushTimer: null,
    };
    stores.set(requestId, store);
  }
  store.queries.push(q);

  if (store.flushTimer) clearTimeout(store.flushTimer);
  store.flushTimer = setTimeout(() => flushStore(requestId), FLUSH_IDLE_MS);
  // Don't keep the event loop alive just for the flush timer.
  if (typeof store.flushTimer.unref === "function") {
    store.flushTimer.unref();
  }
}

/**
 * Wrap the given Prisma client with a $extends that records every query and
 * logs a per-request summary when `DB_PERF_LOG=1`. Otherwise returns the
 * passed-in client reference unchanged.
 *
 * The returned value uses a cast because Prisma's `$extends` produces a
 * deeply-generic wrapper type. Callers continue to treat the returned value
 * as a PrismaClient at the call-site type level; extension hooks only
 * override query behavior, not the client surface.
 */
export function maybeAttachDbPerf<T extends PrismaClient>(client: T): T {
  if (process.env.DB_PERF_LOG !== "1") return client;

  // `$extends` returns a structurally compatible client whose type is a
  // computed intersection that TypeScript cannot narrow to `T` without loss;
  // we preserve the external `T` contract via an explicit cast. Runtime
  // behavior is fully preserved — the extension only adds query hooks.
  const extended = client.$extends({
    query: {
      $allOperations: async ({
        model,
        operation,
        args,
        query,
      }: {
        model?: string;
        operation: string;
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }) => {
        const start = performance.now();
        try {
          return await query(args);
        } finally {
          const durationMs = performance.now() - start;
          // Fire-and-forget; recordQuery does its own try/catch.
          void recordQuery({
            model: model ?? "raw",
            op: operation,
            durationMs,
          });
        }
      },
    },
  });

  return extended as unknown as T;
}
