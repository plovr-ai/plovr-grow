import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

vi.mock("@/lib/stytch", () => ({
  getStytchServerClient: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  authService: {
    findOrCreateStytchUser: vi.fn(),
  },
}));

import { getStytchServerClient } from "@/lib/stytch";
import { authService } from "@/services/auth";

describe("POST /api/auth/stytch/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 when session_token is missing", async () => {
    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing session_token");
  });

  it("should return 401 when Stytch session is invalid", async () => {
    vi.mocked(getStytchServerClient).mockReturnValue({
      sessions: {
        authenticate: vi.fn().mockRejectedValue(new Error("Invalid")),
      },
    } as never);

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      body: JSON.stringify({ session_token: "bad-token" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid Stytch session");
  });

  it("should return 400 when user has no email", async () => {
    vi.mocked(getStytchServerClient).mockReturnValue({
      sessions: {
        authenticate: vi.fn().mockResolvedValue({
          user: { user_id: "stytch-123", emails: [] },
        }),
      },
    } as never);

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      body: JSON.stringify({ session_token: "valid-token" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No email found in Stytch user");
  });

  it("should return user data on success", async () => {
    vi.mocked(getStytchServerClient).mockReturnValue({
      sessions: {
        authenticate: vi.fn().mockResolvedValue({
          user: {
            user_id: "stytch-123",
            emails: [{ email: "test@example.com" }],
          },
        }),
      },
    } as never);

    vi.mocked(authService.findOrCreateStytchUser).mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: "admin",
        tenantId: "t-1",
        companyId: "c-1",
      },
    } as never);

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      body: JSON.stringify({ session_token: "valid-token" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.email).toBe("test@example.com");
  });

  it("should return 500 on unexpected error", async () => {
    vi.mocked(getStytchServerClient).mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      body: JSON.stringify({ session_token: "valid-token" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Authentication failed");
  });
});
