import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { companyService } from "@/services/company/company.service";
import { OnboardingWizard } from "@/components/onboarding";
import { initializeOnboardingAction } from "./actions/onboarding";
import type { OnboardingData } from "@/types/onboarding";
import { DEFAULT_ONBOARDING_DATA } from "@/types/onboarding";

export default async function DashboardOverviewPage() {
  const session = await auth();

  if (!session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const company = await companyService.getCompanyWithMerchants(
    session.user.companyId
  );
  if (!company) redirect("/dashboard/login");

  const isOnboardingComplete = company.onboardingStatus === "completed";

  // Show onboarding wizard if not completed
  if (!isOnboardingComplete) {
    if (company.onboardingStatus === "not_started") {
      await initializeOnboardingAction();
    }

    const onboardingData =
      (company.onboardingData as unknown as OnboardingData) || DEFAULT_ONBOARDING_DATA;

    return (
      <div className="py-8">
        <OnboardingWizard companyId={company.id} initialData={onboardingData} />
      </div>
    );
  }

  // Normal dashboard overview (after onboarding)
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Dashboard Overview</h2>
      <p className="text-gray-600">Welcome to {company.name}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* TODO: Dashboard overview cards */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
          <p className="mt-2 text-3xl font-semibold">--</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Revenue</h3>
          <p className="mt-2 text-3xl font-semibold">--</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Menu Items</h3>
          <p className="mt-2 text-3xl font-semibold">--</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Stores</h3>
          <p className="mt-2 text-3xl font-semibold">{company.merchants?.length ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
