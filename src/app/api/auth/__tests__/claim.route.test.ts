import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  default: {
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn().mockReturnValue("mock-user-id"),
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password"),
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
      id: "tenant1", subscriptionStatus: "trial", company: { id: "company1" },
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "mock-user-id" } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", password: "SecurePass1", name: "Owner",
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "owner@test.com", role: "owner", status: "active" }),
    });
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { subscriptionStatus: "active" },
    });
  });

  it("returns 400 when tenant is not in trial status", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: "tenant1", subscriptionStatus: "active", company: { id: "company1" },
    } as never);
    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", password: "SecurePass1", name: "Owner",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when tenant does not exist", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest({
      tenantId: "fake", email: "owner@test.com", password: "SecurePass1", name: "Owner",
    }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when email already exists for this tenant", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: "tenant1", subscriptionStatus: "trial", company: { id: "company1" },
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "existing-user" } as never);
    const res = await POST(makeRequest({
      tenantId: "tenant1", email: "owner@test.com", password: "SecurePass1", name: "Owner",
    }));
    expect(res.status).toBe(409);
  });

  it("returns 400 for missing fields", async () => {
    const res = await POST(makeRequest({ tenantId: "tenant1" }));
    expect(res.status).toBe(400);
  });
});
