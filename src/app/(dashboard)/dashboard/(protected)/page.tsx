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
    return (
      <div className="py-8">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
          <h2 className="text-lg font-medium text-yellow-800">
            No Store Found
          </h2>
          <p className="mt-2 text-yellow-700">
            Please create a store first before using the AI assistant.
          </p>
        </div>
      </div>
    );
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
