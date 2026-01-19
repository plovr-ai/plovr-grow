import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { companyService } from "@/services/company";
import { CompanyInfoCard } from "@/components/dashboard/company/CompanyInfoCard";

export default async function CompanyPage() {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { companyId } = session.user;

  const company = await companyService.getCompanyWithMerchants(companyId);

  if (!company) {
    redirect("/dashboard/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Company Information</h2>
      </div>

      <CompanyInfoCard company={company} />
    </div>
  );
}
