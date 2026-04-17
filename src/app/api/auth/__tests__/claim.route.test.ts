import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ErrorCodes } from "@/lib/errors/error-codes";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/services/auth/auth.service", () => ({
  authService: { claimTenant: vi.fn() },
}));

import { authService } from "@/services/auth/auth.service";
import { POST } from "../claim/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/claim", {
    method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/claim", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("claims a tenant and creates owner user", async () => {
    vi.mocked(authService.claimTenant).mockResolvedValue({ companySlug: "test-slug" });

    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", name: "Owner",
    }), { params: Promise.resolve({}) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, companySlug: "test-slug" });
    expect(authService.claimTenant).toHaveBeenCalledWith({
      tenantId: "tenant1", email: "owner@test.com", name: "Owner",
    });
  });

  it("returns 404 with CLAIM_TENANT_NOT_FOUND when tenant does not exist", async () => {
    vi.mocked(authService.claimTenant).mockRejectedValue(
      new AppError(ErrorCodes.CLAIM_TENANT_NOT_FOUND, undefined, 404)
    );
    const res = await POST(makeRequest({
      tenantId: "fake", email: "owner@test.com", name: "Owner",
    }), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.CLAIM_TENANT_NOT_FOUND },
    });
  });

  it("returns 409 with AUTH_EMAIL_EXISTS when email already exists for this tenant", async () => {
    vi.mocked(authService.claimTenant).mockRejectedValue(
      new AppError(ErrorCodes.AUTH_EMAIL_EXISTS, undefined, 409)
    );
    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", name: "Owner",
    }), { params: Promise.resolve({}) });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.AUTH_EMAIL_EXISTS },
    });
  });

  it("returns 400 with AUTH_VALIDATION_FAILED for missing fields", async () => {
    const res = await POST(makeRequest({ tenantId: "tenant1" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toEqual({ code: ErrorCodes.AUTH_VALIDATION_FAILED });
    expect(data.fieldErrors).toBeDefined();
  });

  it("returns 500 with INTERNAL_ERROR for unexpected errors", async () => {
    vi.mocked(authService.claimTenant).mockRejectedValue(new Error("DB error"));
    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", name: "Owner",
    }), { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.INTERNAL_ERROR },
    });
  });

});
