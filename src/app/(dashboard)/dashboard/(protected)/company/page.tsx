import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tenantService } from "@/services/tenant/tenant.service";
import { CompanyInfoCard } from "@/components/dashboard/company/CompanyInfoCard";

export default async function CompanyPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  const companyData = await tenantService.getTenantWithMerchants(tenantId);

  if (!companyData) {
    redirect("/dashboard/login");
  }

  // Serialize to plain object (converts Decimal to number, Date to string)
  const company = JSON.parse(JSON.stringify(companyData));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Company Information</h2>
      </div>

      <CompanyInfoCard company={company} />
    </div>
  );
}
