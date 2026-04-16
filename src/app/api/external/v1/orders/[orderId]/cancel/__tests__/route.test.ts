import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";

const mockValidateExternalRequest = vi.fn();
const mockCancelOrder = vi.fn();

vi.mock("@/lib/external-auth", () => ({
  validateExternalRequest: (...args: unknown[]) => mockValidateExternalRequest(...args),
}));

vi.mock("@/services/order", () => ({
  orderService: {
    cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import { POST } from "../route";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/external/v1/orders/order-1/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createInvalidJsonRequest(): NextRequest {
  return new NextRequest("http://localhost/api/external/v1/orders/order-1/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  });
}

function createContext(orderId: string) {
  return { params: Promise.resolve({ orderId }) };
}

describe("POST /api/external/v1/orders/[orderId]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
  });

  it("should return 401 when not authenticated", async () => {
    mockValidateExternalRequest.mockResolvedValue({ authenticated: false });

    const response = await POST(
      createRequest({ tenantId: "t1", reason: "customer request" }),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("should return 400 for invalid JSON body", async () => {
    const response = await POST(
      createInvalidJsonRequest(),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({
      success: false,
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("should return 400 when tenantId is missing", async () => {
    const response = await POST(
      createRequest({ reason: "customer request" }),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(json.fieldErrors).toBeDefined();
  });

  it("should return 400 when reason is missing", async () => {
    const response = await POST(
      createRequest({ tenantId: "t1" }),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(json.fieldErrors).toBeDefined();
  });

  it("should return 400 when reason exceeds 500 characters", async () => {
    const response = await POST(
      createRequest({ tenantId: "t1", reason: "x".repeat(501) }),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("should return 404 when order is not found", async () => {
    mockCancelOrder.mockRejectedValue(
      new AppError(ErrorCodes.ORDER_NOT_FOUND, { orderId: "order-1" })
    );

    const response = await POST(
      createRequest({ tenantId: "t1", reason: "customer request" }),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({
      success: false,
      error: { code: "ORDER_NOT_FOUND" },
    });
  });

  it("should return 422 when order cancel is not allowed", async () => {
    mockCancelOrder.mockRejectedValue(
      new AppError(ErrorCodes.ORDER_CANCEL_NOT_ALLOWED, {
        orderId: "order-1",
        fulfillmentStatus: "preparing",
      })
    );

    const response = await POST(
      createRequest({ tenantId: "t1", reason: "customer request" }),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json).toEqual({
      success: false,
      error: { code: "ORDER_CANCEL_NOT_ALLOWED" },
    });
  });

  it("should return success when order is cancelled", async () => {
    mockCancelOrder.mockResolvedValue(undefined);

    const response = await POST(
      createRequest({ tenantId: "t1", reason: "customer request" }),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(mockCancelOrder).toHaveBeenCalledWith(
      "t1",
      "order-1",
      "customer request",
      { source: "phone_order" }
    );
  });

  it("should rethrow non-AppError exceptions", async () => {
    mockCancelOrder.mockRejectedValue(new Error("unexpected"));

    const response = await POST(
      createRequest({ tenantId: "t1", reason: "customer request" }),
      createContext("order-1")
    );
    const json = await response.json();

    // withApiHandler catches generic errors and returns 500
    expect(response.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });
});
