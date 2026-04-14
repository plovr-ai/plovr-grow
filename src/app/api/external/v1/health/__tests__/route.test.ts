import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/external-auth", () => ({
  validateExternalRequest: vi.fn(),
}));

import { validateExternalRequest } from "@/lib/external-auth";
import { GET } from "../route";

describe("GET /api/external/v1/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns health status when authenticated", async () => {
    vi.mocked(validateExternalRequest).mockResolvedValue({
      authenticated: true,
    });

    const request = new NextRequest(
      "http://localhost/api/external/v1/health"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.timestamp).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateExternalRequest).mockResolvedValue({
      authenticated: false,
    });

    const request = new NextRequest(
      "http://localhost/api/external/v1/health"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
