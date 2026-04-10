import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tenantService } from "@/services/tenant/tenant.service";
import { taxConfigService } from "@/services/menu/tax-config.service";
import { TaxManagementClient } from "@/components/dashboard/tax/TaxManagementClient";

export default async function TaxManagementPage() {
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Get Company with its Merchants
  const company = await tenantService.getTenantWithMerchants(companyId);
  const merchants = company?.merchants ?? [];

  // Get all tax configs with merchant rates
  const taxConfigs = await taxConfigService.getTaxConfigsWithRates(
    tenantId,
    companyId,
    merchants.map((m) => ({ id: m.id, name: m.name }))
  );

  return (
    <TaxManagementClient
      taxConfigs={taxConfigs}
      merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
    />
  );
}
