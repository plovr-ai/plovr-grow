import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tenantService } from "@/services/tenant/tenant.service";
import { menuService } from "@/services/menu/menu.service";
import { AgentChatClient } from "@/components/dashboard/agent";
import { OnboardingSection } from "@/components/dashboard/onboarding";
import { Suspense } from "react";

export default async function DashboardOverviewPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  const tenant = await tenantService.getTenantWithMerchants(tenantId);
  if (!tenant) redirect("/dashboard/login");

  const merchantId = tenant.merchants?.[0]?.id;
  if (!merchantId) {
    // Invariant: every tenant has a default merchant from creation.
    // Reaching here means the session points at a tenant whose merchants
    // were deleted out from under it — treat as corrupted and re-auth.
    redirect("/dashboard/signout");
  }

  const menuCount = await menuService.countMenus(tenantId);
  const hasMenu = menuCount > 0;

  const showOnboarding = tenant.onboardingStatus !== "completed";

  return (
    <div className="space-y-8 py-8">
      {showOnboarding && (
        <Suspense>
          <OnboardingSection />
        </Suspense>
      )}
      <AgentChatClient
        merchantId={merchantId}
        companyName={tenant.name}
        hasMenu={hasMenu}
      />
    </div>
  );
}
