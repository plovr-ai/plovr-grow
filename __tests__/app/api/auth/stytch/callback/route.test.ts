import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthenticate = vi.fn();
const mockStytchClient = {
  sessions: {
    authenticate: mockAuthenticate,
  },
};

// Mock stytch server client
vi.mock("@/lib/stytch", () => ({
  getStytchServerClient: vi.fn(() => mockStytchClient),
}));

// Mock auth service
vi.mock("@/services/auth", () => ({
  authService: {
    findOrCreateStytchUser: vi.fn(),
  },
}));

describe("POST /api/auth/stytch/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if session_token is missing", async () => {
    const { POST } = await import("@/app/api/auth/stytch/callback/route");

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 401 if stytch session authentication fails", async () => {
    mockAuthenticate.mockRejectedValue(new Error("Invalid token"));

    const { POST } = await import("@/app/api/auth/stytch/callback/route");

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: "invalid-token" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 200 with user data on successful authentication", async () => {
    const { authService } = await import("@/services/auth");

    mockAuthenticate.mockResolvedValue({
      user: {
        user_id: "stytch-user-abc",
        emails: [{ email: "test@example.com" }],
      },
    });

    (authService.findOrCreateStytchUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "test",
        role: "owner",
        tenantId: "tenant-1",
        companyId: "company-1",
      },
      isNewUser: false,
    });

    const { POST } = await import("@/app/api/auth/stytch/callback/route");

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: "valid-token" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.user.email).toBe("test@example.com");
  });
});
