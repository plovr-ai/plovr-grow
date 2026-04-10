import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/dashboard";
import { merchantService } from "@/services/merchant";
import { companyRepository } from "@/repositories/company.repository";
import { subscriptionService } from "@/services/subscription";
import { companyService } from "@/services/company/company.service";
import type { OnboardingData, OnboardingStatus } from "@/types/onboarding";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Note: Middleware handles redirect, but this is a fallback
  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Fetch company, merchants, and subscription data
  let [company, merchants, subscription] = await Promise.all([
    companyRepository.getById(companyId),
    merchantService.getMerchantsByCompanyId(tenantId, companyId),
    subscriptionService.getSubscriptionForDashboard(tenantId),
  ]);

  if (!company) {
    // Company not found in database — session has stale/invalid companyId.
    // Sign out to clear the invalid session and prevent infinite redirect loop.
    await signOut({ redirect: false });
    redirect("/dashboard/login");
  }

  // Initialize onboarding if not started
  if (company.onboardingStatus === "not_started") {
    await companyService.initializeOnboarding(company.id);
    const updated = await companyRepository.getById(companyId);
    if (updated) {
      company = updated;
    }
  }

  // Use first merchant's currency/locale as default for Dashboard
  const defaultCurrency = merchants[0]?.currency ?? "USD";
  const defaultLocale = merchants[0]?.locale ?? "en-US";

  const dashboardContext = {
    tenantId,
    companyId,
    company: {
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
