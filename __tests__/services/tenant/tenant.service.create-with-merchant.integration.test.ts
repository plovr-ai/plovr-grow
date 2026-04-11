import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { tenantService } from "@/services/tenant/tenant.service";

describe("TenantService.createTenantWithMerchant", () => {
  beforeEach(async () => {
    await prisma.merchant.deleteMany({
      where: { tenant: { name: "Acme Diner" } },
    });
    await prisma.tenant.deleteMany({ where: { name: "Acme Diner" } });
  });

  it("creates tenant and default merchant atomically", async () => {
    const { tenant, merchant } = await tenantService.createTenantWithMerchant({
      name: "Acme Diner",
      source: "signup",
    });

    expect(tenant.id).toBeTruthy();
    expect(tenant.name).toBe("Acme Diner");
    expect(tenant.slug).toMatch(/^acme-diner/);

    expect(merchant.tenantId).toBe(tenant.id);
    expect(merchant.name).toBe("Acme Diner");
    expect(merchant.status).toBe("active");
    expect(merchant.slug).toMatch(/^acme-diner/);

    const dbTenant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
    });
    const dbMerchants = await prisma.merchant.findMany({
      where: { tenantId: tenant.id, deleted: false },
    });
    expect(dbTenant).not.toBeNull();
    expect(dbMerchants).toHaveLength(1);
    expect(dbMerchants[0].id).toBe(merchant.id);
  });

  it("falls back to a unique slug when base slug is taken", async () => {
    await tenantService.createTenantWithMerchant({ name: "Acme Diner" });
    const { tenant } = await tenantService.createTenantWithMerchant({
      name: "Acme Diner",
    });
    expect(tenant.slug).not.toBe("acme-diner");
    expect(tenant.slug).toMatch(/^acme-diner-/);
  });

  it("applies generator overrides (websiteUrl, address, subscriptionStatus)", async () => {
    const { tenant, merchant } = await tenantService.createTenantWithMerchant({
      name: "Acme Diner",
      source: "generator",
      websiteUrl: "https://acme.example",
      subscriptionStatus: "trial",
      merchant: {
        address: "1 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        phone: "555-0100",
      },
    });

    expect(tenant.websiteUrl).toBe("https://acme.example");
    expect(tenant.subscriptionStatus).toBe("trial");
    expect(tenant.source).toBe("generator");
    expect(merchant.address).toBe("1 Main St");
    expect(merchant.city).toBe("Springfield");
    expect(merchant.phone).toBe("555-0100");
  });
});
