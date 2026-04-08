import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { POST } from "../disconnect/route";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock stripeConnectService
vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    getConnectAccount: vi.fn(),
    disconnectAccount: vi.fn(),
  },
}));

import { stripeConnectService } from "@/services/stripe-connect";

const mockGetConnectAccount = vi.mocked(stripeConnectService.getConnectAccount);
const mockDisconnectAccount = vi.mocked(stripeConnectService.disconnectAccount);

const mockSession = {
  user: { tenantId: "tenant-1" },
};

const mockConnectedAccount = {
  id: "account-1",
  tenantId: "tenant-1",
  stripeAccountId: "acct_xxx",
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  connectedAt: new Date("2026-01-01T00:00:00.000Z"),
  accessToken: "tok_xxx",
  refreshToken: "ref_xxx",
  scope: "read_write",
  deleted: false,
  disconnectedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("GET /api/dashboard/stripe-connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 when session has no tenantId", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return connected: false when no account exists", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockGetConnectAccount.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ connected: false });
    expect(mockGetConnectAccount).toHaveBeenCalledWith("tenant-1");
  });

  it("should return connected account status when account exists", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockGetConnectAccount.mockResolvedValue(mockConnectedAccount);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.connected).toBe(true);
    expect(data.data.stripeAccountId).toBe("acct_xxx");
    expect(data.data.chargesEnabled).toBe(true);
    expect(data.data.payoutsEnabled).toBe(true);
    expect(data.data.detailsSubmitted).toBe(true);
    expect(data.data.connectedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("should return 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockGetConnectAccount.mockRejectedValue(new Error("Database error"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to get connect status");
  });
});

describe("POST /api/dashboard/stripe-connect/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 when session has no tenantId", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("should successfully disconnect the account", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockDisconnectAccount.mockResolvedValue(undefined);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDisconnectAccount).toHaveBeenCalledWith("tenant-1");
  });

  it("should return 500 when disconnect fails", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockDisconnectAccount.mockRejectedValue(new Error("Stripe API error"));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to disconnect");
  });
});
