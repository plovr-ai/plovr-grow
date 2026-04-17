import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateExternalRequest = vi.fn();
const mockGetMerchantById = vi.fn();

vi.mock("@/lib/external-auth", () => ({
  validateExternalRequest: (...args: unknown[]) => mockValidateExternalRequest(...args),
}));

vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantById: (...args: unknown[]) => mockGetMerchantById(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import { GET } from "../route";

const dummyContext = { params: Promise.resolve({}) };

function createRequest(query: string): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/external/v1/merchants/online-order-url?${query}`)
  );
}

describe("GET /api/external/v1/merchants/online-order-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
  });

  it("should return 401 when not authenticated", async () => {
    mockValidateExternalRequest.mockResolvedValue({ authenticated: false });
    const response = await GET(createRequest("tenantId=t1&merchantId=m1"), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json).toEqual({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("should return 400 when tenantId is missing", async () => {
    const response = await GET(createRequest("merchantId=m1"), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("should return 400 when merchantId is missing", async () => {
    const response = await GET(createRequest("tenantId=t1"), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("should return 404 when merchant not found", async () => {
    mockGetMerchantById.mockResolvedValue(null);
    const response = await GET(createRequest("tenantId=t1&merchantId=m1"), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json).toEqual({ success: false, error: { code: "MERCHANT_NOT_FOUND" } });
  });

  it("should return online order URL on success", async () => {
    mockGetMerchantById.mockResolvedValue({ id: "m1", slug: "happy-wok", tenantId: "t1" });
    const response = await GET(createRequest("tenantId=t1&merchantId=m1"), dummyContext);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      data: { onlineOrderUrl: "https://example.com/r/happy-wok/order" },
    });
  });
});
