import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import prisma from "@/lib/db";
import { tenantService } from "@/services/tenant/tenant.service";
import { generateEntityId } from "@/lib/id";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT:${url}`;
    throw err;
  }),
}));
vi.mock("@/components/dashboard/onboarding", () => ({
  OnboardingSection: () => React.createElement("div", { "data-testid": "onboarding-section" }),
}));

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Page from "@/app/(dashboard)/dashboard/(protected)/page";

describe("Dashboard protected page (integration)", () => {
  let tenantId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    await prisma.user.deleteMany({ where: { email: "page-test@example.com" } });
    await prisma.merchant.deleteMany({
      where: { tenant: { name: "Page Test Co" } },
    });
    await prisma.tenant.deleteMany({ where: { name: "Page Test Co" } });

    const { tenant } = await tenantService.createTenantWithMerchant({
      name: "Page Test Co",
      source: "signup",
    });
    tenantId = tenant.id;
    await tenantService.initializeOnboarding(tenantId);

    await prisma.user.create({
      data: {
        id: generateEntityId(),
        tenantId,
        email: "page-test@example.com",
        name: "Page Tester",
        role: "owner",
        status: "active",
      },
    });

    vi.mocked(auth).mockResolvedValue({
      user: { tenantId, id: "user-page-test" },
    } as never);
  });

  it("renders OnboardingSection for a fresh signup, never 'No Store Found'", async () => {
    const element = await Page();
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain("No Store Found");
    expect(html).toContain('data-testid="onboarding-section"');
    expect(redirect).not.toHaveBeenCalled();
  });

  it("hides OnboardingSection when onboarding is completed", async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingStatus: "completed" },
    });

    const element = await Page();
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain("No Store Found");
    expect(html).not.toContain('data-testid="onboarding-section"');
  });

  it("redirects to signout when tenant has no merchant (corrupted state)", async () => {
    await prisma.merchant.deleteMany({ where: { tenantId } });

    await expect(Page()).rejects.toThrow(/NEXT_REDIRECT:\/dashboard\/signout/);
    expect(redirect).toHaveBeenCalledWith("/dashboard/signout");
  });
});
