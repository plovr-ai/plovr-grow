import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tenantService } from "@/services/tenant/tenant.service";
import { TenantInfoCard } from "@/components/dashboard/tenant/TenantInfoCard";

export default async function TenantPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  const tenantData = await tenantService.getTenantWithMerchants(tenantId);

  if (!tenantData) {
    redirect("/dashboard/login");
  }

  // Serialize to plain object (converts Decimal to number, Date to string)
  const tenant = JSON.parse(JSON.stringify(tenantData));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tenant Information</h2>
      </div>

      <TenantInfoCard tenant={tenant} />
    </div>
  );
}
