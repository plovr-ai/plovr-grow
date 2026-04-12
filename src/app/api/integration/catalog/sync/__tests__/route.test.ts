import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock integration repository
vi.mock("@/repositories/integration.repository", () => ({
  integrationRepository: {
    getActivePosConnection: vi.fn(),
  },
}));

// Mock POS provider registry
const mockSyncCatalog = vi.fn();
vi.mock("@/services/integration/pos-provider-registry", () => ({
  posProviderRegistry: {
    getProvider: vi.fn(() => ({
      syncCatalog: mockSyncCatalog,
    })),
  },
}));

import { integrationRepository } from "@/repositories/integration.repository";
import { posProviderRegistry } from "@/services/integration/pos-provider-registry";
import { AppError, ErrorCodes } from "@/lib/errors";

const mockGetActivePosConnection = vi.mocked(
  integrationRepository.getActivePosConnection
);
const mockGetProvider = vi.mocked(posProviderRegistry.getProvider);

const mockSession = {
  user: {
    tenantId: "tenant-1",
  },
};

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/integration/catalog/sync",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("POST /api/integration/catalog/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProvider.mockReturnValue({
      syncCatalog: mockSyncCatalog,
    } as never);
  });

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(createRequest({ merchantId: "m1" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 when session has no tenantId", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const response = await POST(createRequest({ merchantId: "m1" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("should return 400 when merchantId is missing", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const response = await POST(createRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Validation failed");
    expect(data.fieldErrors).toBeDefined();
  });

  it("should return 400 when merchantId is empty", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const response = await POST(createRequest({ merchantId: "" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should return 404 when no active POS connection exists", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockGetActivePosConnection.mockResolvedValue(null);

    const response = await POST(createRequest({ merchantId: "m1" }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("INTEGRATION_NOT_CONNECTED");
    expect(mockGetActivePosConnection).toHaveBeenCalledWith("tenant-1", "m1");
  });

  it("should sync catalog via the correct POS provider", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
    } as never);
    mockSyncCatalog.mockResolvedValue({
      objectsSynced: 10,
      objectsMapped: 8,
    });

    const response = await POST(createRequest({ merchantId: "m1" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ objectsSynced: 10, objectsMapped: 8 });

    expect(mockGetActivePosConnection).toHaveBeenCalledWith("tenant-1", "m1");
    expect(mockGetProvider).toHaveBeenCalledWith("POS_SQUARE");
    expect(mockSyncCatalog).toHaveBeenCalledWith("tenant-1", "m1");
  });

  it("should return AppError status code when provider throws AppError", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
    } as never);
    mockSyncCatalog.mockRejectedValue(
      new AppError(ErrorCodes.SQUARE_CATALOG_SYNC_FAILED, undefined, 500)
    );

    const response = await POST(createRequest({ merchantId: "m1" }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("SQUARE_CATALOG_SYNC_FAILED");
  });

  it("should return 500 for unexpected errors", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_SQUARE",
    } as never);
    mockSyncCatalog.mockRejectedValue(new Error("Network failure"));

    const response = await POST(createRequest({ merchantId: "m1" }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Network failure");
  });

  it("should return AppError when provider is not registered", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockGetActivePosConnection.mockResolvedValue({
      id: "conn-1",
      type: "POS_UNKNOWN",
    } as never);
    mockGetProvider.mockImplementation(() => {
      throw new AppError(ErrorCodes.POS_PROVIDER_NOT_FOUND, { type: "POS_UNKNOWN" }, 500);
    });

    const response = await POST(createRequest({ merchantId: "m1" }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("POS_PROVIDER_NOT_FOUND");
  });
});
