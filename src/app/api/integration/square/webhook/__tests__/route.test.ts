import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

const mockVerifySignature = vi.fn();
const mockHandleWebhook = vi.fn();

vi.mock("@/services/square/square-webhook.service", () => ({
  squareWebhookService: {
    verifySignature: (...args: unknown[]) => mockVerifySignature(...args),
    handleWebhook: (...args: unknown[]) => mockHandleWebhook(...args),
  },
}));

vi.mock("@/services/square/square.config", () => ({
  squareConfig: {
    enabled: true,
  },
}));

function buildRequest(body: string, signature?: string): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/integration/square/webhook",
    {
      method: "POST",
      body,
      headers: {
        ...(signature && { "x-square-hmacsha256-signature": signature }),
      },
    }
  );
}

describe("POST /api/integration/square/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 for missing signature", async () => {
    mockVerifySignature.mockReturnValue(false);
    const request = buildRequest(JSON.stringify({ type: "test" }));
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should return 401 for invalid signature", async () => {
    mockVerifySignature.mockReturnValue(false);
    const request = buildRequest(JSON.stringify({ type: "test" }), "invalid");
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should return 200 and process valid webhook", async () => {
    mockVerifySignature.mockReturnValue(true);
    mockHandleWebhook.mockResolvedValue({ deduplicated: false });
    const body = JSON.stringify({ type: "catalog.version.updated", event_id: "evt-1" });
    const request = buildRequest(body, "valid-sig");
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockHandleWebhook).toHaveBeenCalledWith(body);
  });

  it("should return 200 for duplicate events", async () => {
    mockVerifySignature.mockReturnValue(true);
    mockHandleWebhook.mockResolvedValue({ deduplicated: true });
    const request = buildRequest(JSON.stringify({ type: "test" }), "valid-sig");
    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("should return 200 even when handler throws", async () => {
    mockVerifySignature.mockReturnValue(true);
    mockHandleWebhook.mockRejectedValue(new Error("handler failed"));
    const request = buildRequest(JSON.stringify({ type: "test" }), "valid-sig");
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
