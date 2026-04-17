import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { tenantService } from "@/services/tenant/tenant.service";
import { POST } from "@/app/api/auth/claim/route";

describe("POST /api/auth/claim (integration)", () => {
  let tenantId: string;
  let merchantId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: "claim-test@example.com" },
    });
    await prisma.merchant.deleteMany({
      where: { tenant: { name: "Claim Test Diner" } },
    });
    await prisma.tenant.deleteMany({ where: { name: "Claim Test Diner" } });

    const { tenant, merchant } = await tenantService.createTenantWithMerchant({
      name: "Claim Test Diner",
      source: "generator",
    });
    tenantId = tenant.id;
    merchantId = merchant.id;
  });

  function buildRequest(body: unknown): Request {
    return new Request("http://localhost/api/auth/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("claims a tenant, creates the user, preserves the existing merchant", async () => {
    const res = await POST(
      buildRequest({
        tenantId,
        email: "claim-test@example.com",
        name: "Claim Tester",
      }) as never,
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const user = await prisma.user.findFirst({
      where: { tenantId, email: "claim-test@example.com" },
    });
    expect(user).not.toBeNull();

    // Regression guard: the merchant from the generator flow still exists
    const merchants = await prisma.merchant.findMany({
      where: { tenantId, deleted: false },
    });
    expect(merchants).toHaveLength(1);
    expect(merchants[0].id).toBe(merchantId);
  });

  it("returns 404 when the tenant does not exist", async () => {
    const res = await POST(
      buildRequest({
        tenantId: "nonexistent-tenant-id",
        email: "claim-test@example.com",
        name: "Claim Tester",
      }) as never,
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when the email already exists on this tenant", async () => {
    await POST(
      buildRequest({
        tenantId,
        email: "claim-test@example.com",
        name: "Claim Tester",
      }) as never,
      { params: Promise.resolve({}) }
    );

    const res = await POST(
      buildRequest({
        tenantId,
        email: "claim-test@example.com",
        name: "Claim Tester 2",
      }) as never,
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(409);
  });
});
