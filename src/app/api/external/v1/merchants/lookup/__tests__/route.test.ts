import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateExternalRequest = vi.fn();
const mockGetByAiPhone = vi.fn();

vi.mock("@/lib/external-auth", () => ({
  validateExternalRequest: (...args: unknown[]) => mockValidateExternalRequest(...args),
}));

vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {
    getByAiPhone: (...args: unknown[]) => mockGetByAiPhone(...args),
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

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new URL("http://localhost/api/external/v1/merchants/lookup"),
    { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
  );
}

describe("POST /api/external/v1/merchants/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateExternalRequest.mockResolvedValue({ authenticated: true });
  });

  it("should return 401 when not authenticated", async () => {
    mockValidateExternalRequest.mockResolvedValue({ authenticated: false });
    const response = await POST(createRequest({ phone: "+14155551234" }));
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json).toEqual({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("should return 400 when phone is missing", async () => {
    const response = await POST(createRequest({}));
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("should return 404 when merchant not found", async () => {
    mockGetByAiPhone.mockResolvedValue(null);
    const response = await POST(createRequest({ phone: "+10000000000" }));
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json).toEqual({ success: false, error: { code: "MERCHANT_NOT_FOUND" } });
  });

  it("should return merchant data on success", async () => {
    mockGetByAiPhone.mockResolvedValue({
      id: "m1", tenantId: "t1", name: "Happy Wok", timezone: "America/Los_Angeles",
      currency: "USD", locale: "en-US", phone: "+14155551234",
      address: "123 Main St", city: "San Francisco", state: "CA", zipCode: "94102",
      phoneAiSettings: null,
    });
    const response = await POST(createRequest({ phone: "+14155551234" }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual({
      tenantId: "t1", merchantId: "m1", merchantName: "Happy Wok",
      timezone: "America/Los_Angeles", currency: "USD", locale: "en-US",
      phone: "+14155551234", forwardPhone: "+14155551234",
      address: "123 Main St", city: "San Francisco",
      state: "CA", zipCode: "94102",
    });
    expect(mockGetByAiPhone).toHaveBeenCalledWith("+14155551234");
  });

  it("should return forwardPhone from phoneAiSettings.agentWorkSwitch when present", async () => {
    mockGetByAiPhone.mockResolvedValue({
      id: "m1", tenantId: "t1", name: "Happy Wok", timezone: "America/Los_Angeles",
      currency: "USD", locale: "en-US", phone: "+14155551234",
      address: "123 Main St", city: "San Francisco", state: "CA", zipCode: "94102",
      phoneAiSettings: { agentWorkSwitch: "+14155559999" },
    });
    const response = await POST(createRequest({ phone: "+14155551234" }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.forwardPhone).toBe("+14155559999");
    expect(json.data.phone).toBe("+14155551234");
  });
});
