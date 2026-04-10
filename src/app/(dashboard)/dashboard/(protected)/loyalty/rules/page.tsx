import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loyaltyConfigService } from "@/services/loyalty";
import { LoyaltyRulesClient } from "@/components/dashboard/loyalty";

export default async function LoyaltyRulesPage() {
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  // Get loyalty config
  const config = await loyaltyConfigService.getLoyaltyConfig(tenantId);

  return <LoyaltyRulesClient initialConfig={config} />;
}
