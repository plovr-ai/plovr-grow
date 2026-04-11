import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/dashboard";
import { merchantService } from "@/services/merchant";
import { tenantRepository } from "@/repositories/tenant.repository";
import { subscriptionService } from "@/services/subscription";
import { tenantService } from "@/services/tenant/tenant.service";
import type { OnboardingData, OnboardingStatus } from "@/types/onboarding";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Note: Middleware handles redirect, but this is a fallback
  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  // Fetch company, merchants, and subscription data
  const [initialCompany, merchants, subscription] = await Promise.all([
    tenantRepository.getById(tenantId),
    merchantService.getMerchantsByTenantId(tenantId),
    subscriptionService.getSubscriptionForDashboard(tenantId),
  ]);

  if (!initialCompany) {
    // Tenant not found in database — session has stale/invalid tenantId.
    // Redirect to signout route handler to clear the cookie (cookies can't be
    // modified from a Server Component), which then redirects to login.
    redirect("/dashboard/signout");
  }

  // Initialize onboarding if not started
  let company = initialCompany;
  if (company.onboardingStatus === "not_started") {
    await tenantService.initializeOnboarding(tenantId);
    const updated = await tenantRepository.getById(tenantId);
    if (updated) {
      company = updated;
    }
  }

  // Use first merchant's currency/locale as default for Dashboard
  const defaultCurrency = merchants[0]?.currency ?? "USD";
  const defaultLocale = merchants[0]?.locale ?? "en-US";

  const dashboardContext = {
    tenantId,
    tenant: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
    },
    merchants: merchants.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      address: m.address ?? null,
      city: m.city ?? null,
      status: m.status,
    })),
    currency: defaultCurrency,
    locale: defaultLocale,
    subscription,
    onboarding: {
      status: company.onboardingStatus as OnboardingStatus,
      data: company.onboardingData as unknown as OnboardingData | null,
    },
  };

  return (
    <DashboardLayoutClient dashboardContext={dashboardContext}>
      {children}
    </DashboardLayoutClient>
  );
}
