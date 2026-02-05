import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardLayoutClient } from "@/components/dashboard";
import { merchantService } from "@/services/merchant";
import { companyRepository } from "@/repositories/company.repository";
import { subscriptionService } from "@/services/subscription";

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
  const [company, merchants, subscription] = await Promise.all([
    companyRepository.getById(companyId),
    merchantService.getMerchantsByCompanyId(tenantId, companyId),
    subscriptionService.getSubscriptionForDashboard(tenantId),
  ]);

  if (!company) {
    redirect("/dashboard/login");
  }

  // Subscription access control: redirect to home if not subscribed
  const canAccessDashboard = subscription?.canAccessPremiumFeatures ?? false;
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isHomePage = pathname === "/dashboard" || pathname === "/dashboard/";

  // If user is not subscribed and trying to access pages other than home, redirect to home
  if (!canAccessDashboard && !isHomePage) {
    redirect("/dashboard");
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
  };

  return (
    <DashboardLayoutClient dashboardContext={dashboardContext}>
      {children}
    </DashboardLayoutClient>
  );
}
