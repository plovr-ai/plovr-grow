import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateExternalRequest = vi.fn();
const mockSendMessage = vi.fn();

vi.mock("@/lib/external-auth", () => ({
  validateExternalRequest: (...args: unknown[]) => mockValidateExternalRequest(...args),
}));

vi.mock("@/services/sms/sms.service", () => ({
  smsService: {
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import { POST } from "../route";

const dummyContext = { params: Promise.resolve({}) };

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new URL("http://localhost/api/external/v1/sms/send"),
    { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
  );
}

describe("POST /api/external/v1/sms/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
  });

  it("should return 401 when not authenticated", async () => {
    mockValidateExternalRequest.mockResolvedValue({ authenticated: false });
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", mobile: "+14155551234", message: "Hello" }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json).toEqual({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("should return 400 when required fields are missing", async () => {
    const response = await POST(createRequest({ tenantId: "t1" }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("should return 400 when message exceeds 1600 chars", async () => {
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", mobile: "+14155551234", message: "x".repeat(1601) }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("should return 500 when SMS send fails", async () => {
    mockSendMessage.mockResolvedValue({ success: false, error: "Provider error" });
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", mobile: "+14155551234", message: "Hello" }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
  });

  it("should return messageId on success", async () => {
    mockSendMessage.mockResolvedValue({ success: true, messageId: "SM123" });
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", mobile: "+14155551234", message: "Your order link" }), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, data: { messageId: "SM123" } });
    expect(mockSendMessage).toHaveBeenCalledWith("+14155551234", "Your order link");
  });
});
