import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRetryFailedOrderPushes = vi.fn();

vi.mock("@/services/square/square-order-retry.service", () => ({
  squareOrderRetryService: {
    retryFailedOrderPushes: (...args: unknown[]) =>
      mockRetryFailedOrderPushes(...args),
  },
}));

import { GET } from "../route";

function buildRequest(authorization?: string) {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request(
    "https://example.com/api/cron/square-order-push-retry",
    {
      method: "GET",
      headers,
    }
  ) as unknown as import("next/server").NextRequest;
}

describe("GET /api/cron/square-order-push-retry", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRetryFailedOrderPushes.mockResolvedValue({
      processed: 0,
      retried: 0,
      deadLettered: 0,
    });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(buildRequest("Bearer anything"));

    expect(response.status).toBe(500);
    expect(mockRetryFailedOrderPushes).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toBe("Server misconfigured");
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = "test-secret";

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(mockRetryFailedOrderPushes).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is incorrect", async () => {
    process.env.CRON_SECRET = "test-secret";

    const response = await GET(buildRequest("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(mockRetryFailedOrderPushes).not.toHaveBeenCalled();
  });

  it("invokes retryFailedOrderPushes and returns the counts on valid auth", async () => {
    process.env.CRON_SECRET = "test-secret";
    mockRetryFailedOrderPushes.mockResolvedValue({
      processed: 3,
      retried: 1,
      deadLettered: 1,
    });

    const response = await GET(buildRequest("Bearer test-secret"));

    expect(response.status).toBe(200);
    expect(mockRetryFailedOrderPushes).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      processed: 3,
      retried: 1,
      deadLettered: 1,
    });
  });

  it("returns 500 when retryFailedOrderPushes throws", async () => {
    process.env.CRON_SECRET = "test-secret";
    mockRetryFailedOrderPushes.mockRejectedValue(new Error("db down"));

    const response = await GET(buildRequest("Bearer test-secret"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("db down");
  });
});
