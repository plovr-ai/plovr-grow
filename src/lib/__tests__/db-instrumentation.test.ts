import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  _resetFallbackBucketStateForTest,
  detectN1,
  getFallbackBucketKey,
  maybeAttachDbPerf,
  type RecordedQuery,
} from "../db-instrumentation";

describe("detectN1", () => {
  it("returns no suspects when count < 3", () => {
    const queries: RecordedQuery[] = [
      { model: "MenuItem", op: "findMany", durationMs: 2 },
      { model: "MenuItem", op: "findMany", durationMs: 2.1 },
    ];
    expect(detectN1(queries)).toEqual([]);
  });

  it("returns no suspects when stddev/mean >= 0.5 (durations too variable)", () => {
    const queries: RecordedQuery[] = [
      { model: "MenuItem", op: "findMany", durationMs: 1 },
      { model: "MenuItem", op: "findMany", durationMs: 10 },
      { model: "MenuItem", op: "findMany", durationMs: 20 },
    ];
    expect(detectN1(queries)).toEqual([]);
  });

  it("flags a suspect when count >= 3 and durations are consistent", () => {
    const queries: RecordedQuery[] = [
      { model: "MenuItem", op: "findMany", durationMs: 5.0 },
      { model: "MenuItem", op: "findMany", durationMs: 5.1 },
      { model: "MenuItem", op: "findMany", durationMs: 4.9 },
    ];
    const suspects = detectN1(queries);
    expect(suspects).toHaveLength(1);
    expect(suspects[0]).toContain("MenuItem.findMany");
    expect(suspects[0]).toContain("x3");
  });

  it("ignores groups with zero mean", () => {
    const queries: RecordedQuery[] = [
      { model: "M", op: "op", durationMs: 0 },
      { model: "M", op: "op", durationMs: 0 },
      { model: "M", op: "op", durationMs: 0 },
    ];
    expect(detectN1(queries)).toEqual([]);
  });

  it("groups by model.op (different ops don't combine)", () => {
    const queries: RecordedQuery[] = [
      { model: "A", op: "findMany", durationMs: 5 },
      { model: "A", op: "findMany", durationMs: 5.1 },
      { model: "B", op: "findMany", durationMs: 5 },
      { model: "B", op: "findMany", durationMs: 5.1 },
    ];
    // Each group has only 2 items — below threshold.
    expect(detectN1(queries)).toEqual([]);
  });
});

describe("maybeAttachDbPerf", () => {
  const originalFlag = process.env.DB_PERF_LOG;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.DB_PERF_LOG;
    } else {
      process.env.DB_PERF_LOG = originalFlag;
    }
  });

  it("returns the same client reference when DB_PERF_LOG is unset", () => {
    delete process.env.DB_PERF_LOG;
    // A stub "client" — we only care about reference identity in the
    // flag-off branch, so the extension hook is never invoked.
    const fakeClient = { $extends: () => ({}) } as unknown as Parameters<
      typeof maybeAttachDbPerf
    >[0];
    const result = maybeAttachDbPerf(fakeClient);
    expect(result).toBe(fakeClient);
  });

  it("returns the same client reference when DB_PERF_LOG=0", () => {
    process.env.DB_PERF_LOG = "0";
    const fakeClient = { $extends: () => ({}) } as unknown as Parameters<
      typeof maybeAttachDbPerf
    >[0];
    const result = maybeAttachDbPerf(fakeClient);
    expect(result).toBe(fakeClient);
  });
});

describe("getFallbackBucketKey", () => {
  beforeEach(() => {
    _resetFallbackBucketStateForTest();
  });

  it("reuses the same bucket for calls within the 300ms idle window", () => {
    const k1 = getFallbackBucketKey(1_000);
    const k2 = getFallbackBucketKey(1_100); // +100ms
    const k3 = getFallbackBucketKey(1_299); // +299ms from k1 (sliding window)
    expect(k1).toBe("unk_1");
    expect(k2).toBe(k1);
    expect(k3).toBe(k1);
  });

  it("rotates to a new bucket after more than 300ms of idle", () => {
    const k1 = getFallbackBucketKey(1_000);
    const k2 = getFallbackBucketKey(1_500); // +500ms idle -> new bucket
    const k3 = getFallbackBucketKey(2_500); // another +1000ms -> new bucket
    expect(k1).toBe("unk_1");
    expect(k2).toBe("unk_2");
    expect(k3).toBe("unk_3");
  });

  it("slides the window — touching the key resets the idle clock", () => {
    const k1 = getFallbackBucketKey(0);
    // keep touching every 100ms for 1 second — should all be the same bucket
    const k2 = getFallbackBucketKey(100);
    const k3 = getFallbackBucketKey(200);
    const k4 = getFallbackBucketKey(300); // +100ms since last, still within window
    const k5 = getFallbackBucketKey(400);
    expect([k2, k3, k4, k5].every((k) => k === k1)).toBe(true);
    // Then idle >300ms -> new bucket
    const k6 = getFallbackBucketKey(800);
    expect(k6).not.toBe(k1);
  });
});
