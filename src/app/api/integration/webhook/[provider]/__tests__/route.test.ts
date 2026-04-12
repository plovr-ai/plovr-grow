import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockDispatch = vi.fn();

vi.mock("@/services/integration/webhook-dispatcher.service", () => ({
  webhookDispatcher: {
    dispatch: (...args: unknown[]) => mockDispatch(...args),
  },
}));

import { POST } from "../route";

function buildRequest(
  provider: string,
  body: string,
  headers?: Record<string, string>
): [NextRequest, { params: Promise<{ provider: string }> }] {
  const request = new NextRequest(
    `http://localhost:3000/api/integration/webhook/${provider}`,
    {
      method: "POST",
      body,
      headers,
    }
  );
  return [request, { params: Promise.resolve({ provider }) }];
}

describe("POST /api/integration/webhook/[provider]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return dispatcher result for a valid request", async () => {
    mockDispatch.mockResolvedValue({
      status: 200,
      body: { received: true },
    });

    const [req, ctx] = buildRequest(
      "square",
      '{"event_id":"evt-1"}',
      { "x-square-hmacsha256-signature": "sig" }
    );
    const response = await POST(req, ctx);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockDispatch).toHaveBeenCalledWith(
      "square",
      '{"event_id":"evt-1"}',
      expect.objectContaining({ "x-square-hmacsha256-signature": "sig" })
    );
  });

  it("should return 400 for unknown provider", async () => {
    mockDispatch.mockResolvedValue({
      status: 400,
      body: { error: "unknown_provider" },
    });

    const [req, ctx] = buildRequest("unknown", "{}");
    const response = await POST(req, ctx);

    expect(response.status).toBe(400);
  });

  it("should return 401 for invalid signature", async () => {
    mockDispatch.mockResolvedValue({
      status: 401,
      body: { error: "invalid_signature" },
    });

    const [req, ctx] = buildRequest("square", "{}", { "x-square-hmacsha256-signature": "bad" });
    const response = await POST(req, ctx);

    expect(response.status).toBe(401);
  });

  it("should pass all headers to dispatcher", async () => {
    mockDispatch.mockResolvedValue({
      status: 200,
      body: { received: true },
    });

    const [req, ctx] = buildRequest("square", "{}", {
      "x-custom-header": "value",
      "content-type": "application/json",
    });
    await POST(req, ctx);

    const passedHeaders = mockDispatch.mock.calls[0][2] as Record<string, string>;
    expect(passedHeaders["x-custom-header"]).toBe("value");
    expect(passedHeaders["content-type"]).toBe("application/json");
  });
});
