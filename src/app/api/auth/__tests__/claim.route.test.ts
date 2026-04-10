import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ErrorCodes } from "@/lib/errors/error-codes";

vi.mock("@/lib/db", () => ({
  default: {
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn().mockReturnValue("mock-user-id"),
}));

import prisma from "@/lib/db";
import { POST } from "../claim/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/claim", {
    method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/claim", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("claims a trial tenant and creates owner user", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: "tenant1", subscriptionStatus: "trial", slug: "test-slug",
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "mock-user-id" } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", name: "Owner",
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, companySlug: "test-slug" });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "owner@test.com", passwordHash: null, role: "owner", status: "active" }),
    });
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { subscriptionStatus: "active" },
    });
  });

  it("returns 400 with CLAIM_TENANT_NOT_TRIAL when tenant is not in trial status", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: "tenant1", subscriptionStatus: "active", company: { id: "company1" },
    } as never);
    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", name: "Owner",
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.CLAIM_TENANT_NOT_TRIAL },
    });
  });

  it("returns 404 with CLAIM_TENANT_NOT_FOUND when tenant does not exist", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest({
      tenantId: "fake", email: "owner@test.com", name: "Owner",
    }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.CLAIM_TENANT_NOT_FOUND },
    });
  });

  it("returns 409 with AUTH_EMAIL_EXISTS when email already exists for this tenant", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: "tenant1", subscriptionStatus: "trial", company: { id: "company1" },
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "existing-user" } as never);
    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", name: "Owner",
    }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.AUTH_EMAIL_EXISTS },
    });
  });

  it("returns 400 with AUTH_VALIDATION_FAILED for missing fields", async () => {
    const res = await POST(makeRequest({ tenantId: "tenant1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toEqual({ code: ErrorCodes.AUTH_VALIDATION_FAILED });
    expect(data.fieldErrors).toBeDefined();
  });

  it("returns 500 with CLAIM_FAILED for unexpected errors", async () => {
    vi.mocked(prisma.tenant.findUnique).mockRejectedValue(new Error("DB error"));
    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", name: "Owner",
    }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toEqual({
      success: false,
      error: { code: ErrorCodes.CLAIM_FAILED },
    });
  });

});
