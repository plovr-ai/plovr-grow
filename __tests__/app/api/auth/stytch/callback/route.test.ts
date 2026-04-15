import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ErrorCodes } from "@/lib/errors/error-codes";

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

  it("returns 400 with AUTH_MISSING_SESSION_TOKEN if session_token is missing", async () => {
    const { POST } = await import("@/app/api/auth/stytch/callback/route");

    const request = new NextRequest("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.AUTH_MISSING_SESSION_TOKEN },
    });
  });

  it("returns 401 with AUTH_INVALID_STYTCH_SESSION if stytch session authentication fails", async () => {
    mockAuthenticate.mockRejectedValue(new Error("Invalid token"));

    const { POST } = await import("@/app/api/auth/stytch/callback/route");

    const request = new NextRequest("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: "invalid-token" }),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.AUTH_INVALID_STYTCH_SESSION },
    });
  });

  it("returns 400 with AUTH_MISSING_EMAIL if stytch user has no email", async () => {
    mockAuthenticate.mockResolvedValue({
      user: {
        user_id: "stytch-user-abc",
        emails: [],
      },
    });

    const { POST } = await import("@/app/api/auth/stytch/callback/route");

    const request = new NextRequest("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: "valid-token" }),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.AUTH_MISSING_EMAIL },
    });
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

    const request = new NextRequest("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: "valid-token" }),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.user.email).toBe("test@example.com");
  });

  it("returns 500 with AUTH_STYTCH_CALLBACK_FAILED for unexpected errors", async () => {
    const { authService } = await import("@/services/auth");

    mockAuthenticate.mockResolvedValue({
      user: {
        user_id: "stytch-user-abc",
        emails: [{ email: "test@example.com" }],
      },
    });

    (authService.findOrCreateStytchUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Database connection failed")
    );

    const { POST } = await import("@/app/api/auth/stytch/callback/route");

    const request = new NextRequest("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: "valid-token" }),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.INTERNAL_ERROR },
    });
  });
});
