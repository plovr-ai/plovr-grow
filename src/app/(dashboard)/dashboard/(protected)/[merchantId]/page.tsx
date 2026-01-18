import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { companyService } from "@/services/company/company.service";
import { OnboardingWizard } from "@/components/onboarding";
import { initializeOnboardingAction } from "../actions/onboarding";
import type { OnboardingData } from "@/types/onboarding";
import { DEFAULT_ONBOARDING_DATA } from "@/types/onboarding";

interface MerchantOverviewProps {
  params: Promise<{ merchantId: string }>;
}

export default async function MerchantOverviewPage({
  params,
}: MerchantOverviewProps) {
  const { merchantId } = await params;
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
      (company.onboardingData as OnboardingData) || DEFAULT_ONBOARDING_DATA;

    return (
      <div className="py-8">
        <OnboardingWizard companyId={company.id} initialData={onboardingData} />
      </div>
    );
  }

  // Normal merchant overview (after onboarding)
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Merchant Overview</h2>
      <p className="text-gray-600">Merchant ID: {merchantId}</p>
      <p className="text-gray-600">Company: {company.name}</p>
      {/* TODO: Merchant overview dashboard content */}
    </div>
  );
}
