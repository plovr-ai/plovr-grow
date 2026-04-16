import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateExternalRequest = vi.fn();
const mockGetOrderWithTimeline = vi.fn();

vi.mock("@/lib/external-auth", () => ({
  validateExternalRequest: (...args: unknown[]) => mockValidateExternalRequest(...args),
}));

vi.mock("@/services/order", () => ({
  orderService: {
    getOrderWithTimeline: (...args: unknown[]) => mockGetOrderWithTimeline(...args),
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

import { GET } from "../route";

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"));
}

function createContext(orderId: string) {
  return { params: Promise.resolve({ orderId }) };
}

describe("GET /api/external/v1/orders/[orderId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
  });

  it("should return 401 when not authenticated", async () => {
    mockValidateExternalRequest.mockResolvedValue({ authenticated: false });

    const response = await GET(
      createRequest("http://localhost/api/external/v1/orders/order-1?tenantId=t1"),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("should return 400 when tenantId is missing", async () => {
    const response = await GET(
      createRequest("http://localhost/api/external/v1/orders/order-1"),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({
      success: false,
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("should return 404 when order is not found", async () => {
    mockGetOrderWithTimeline.mockResolvedValue(null);

    const response = await GET(
      createRequest("http://localhost/api/external/v1/orders/order-1?tenantId=t1"),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({
      success: false,
      error: { code: "ORDER_NOT_FOUND" },
    });
    expect(mockGetOrderWithTimeline).toHaveBeenCalledWith("t1", "order-1");
  });

  it("should return order with timeline on success", async () => {
    const mockOrder = { id: "order-1", status: "pending", timeline: [] };
    mockGetOrderWithTimeline.mockResolvedValue(mockOrder);

    const response = await GET(
      createRequest("http://localhost/api/external/v1/orders/order-1?tenantId=t1"),
      createContext("order-1")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, data: mockOrder });
    expect(mockGetOrderWithTimeline).toHaveBeenCalledWith("t1", "order-1");
  });
});
