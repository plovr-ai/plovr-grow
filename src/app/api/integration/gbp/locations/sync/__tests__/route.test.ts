import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock services
vi.mock("@/services/gbp", () => ({
  gbpService: {
    syncLocation: vi.fn(),
  },
}));

vi.mock("@/services/merchant", () => ({
  merchantService: {
    updateMerchant: vi.fn(),
  },
}));

vi.mock("@/services/tenant/tenant.service", () => ({
  tenantService: {
    updateOnboardingStep: vi.fn(),
  },
}));

import { gbpService } from "@/services/gbp";
import { merchantService } from "@/services/merchant";
import { tenantService } from "@/services/tenant/tenant.service";
import { AppError, ErrorCodes } from "@/lib/errors";

const mockSyncLocation = vi.mocked(gbpService.syncLocation);
const mockUpdateMerchant = vi.mocked(merchantService.updateMerchant);
const mockUpdateOnboardingStep = vi.mocked(tenantService.updateOnboardingStep);

const mockSession = {
  user: {
    tenantId: "tenant-1",
  },
};

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/integration/gbp/locations/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/integration/gbp/locations/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(createRequest({ merchantId: "m1", locationName: "loc/1" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 when session has no tenantId", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const response = await POST(createRequest({ merchantId: "m1", locationName: "loc/1" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("should return 400 when merchantId is missing", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const response = await POST(createRequest({ locationName: "loc/1" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid request");
  });

  it("should return 400 when locationName is missing", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const response = await POST(createRequest({ merchantId: "m1" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid request");
  });

  it("should sync location, update merchant, and mark step completed", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const merchantData = {
      phone: "+1234567890",
      address: "123 Main St",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
    };

    mockSyncLocation.mockResolvedValue({ merchantData });
    mockUpdateMerchant.mockResolvedValue({} as ReturnType<typeof merchantService.updateMerchant> extends Promise<infer T> ? T : never);
    mockUpdateOnboardingStep.mockResolvedValue({} as ReturnType<typeof tenantService.updateOnboardingStep> extends Promise<infer T> ? T : never);

    const response = await POST(
      createRequest({ merchantId: "m1", locationName: "locations/456" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.merchantData).toEqual(merchantData);

    expect(mockSyncLocation).toHaveBeenCalledWith("tenant-1", "m1", "locations/456");
    expect(mockUpdateMerchant).toHaveBeenCalledWith("tenant-1", "m1", merchantData);
    expect(mockUpdateOnboardingStep).toHaveBeenCalledWith(
      "tenant-1",
      "gbp",
      "completed"
    );
  });

  it("should return AppError status code when gbpService throws AppError", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockSyncLocation.mockRejectedValue(
      new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404)
    );

    const response = await POST(
      createRequest({ merchantId: "m1", locationName: "locations/456" })
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("INTEGRATION_NOT_CONNECTED");
  });

  it("should return 500 for unexpected errors", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockSyncLocation.mockRejectedValue(new Error("Network failure"));

    const response = await POST(
      createRequest({ merchantId: "m1", locationName: "locations/456" })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to sync GBP location");
  });
});
