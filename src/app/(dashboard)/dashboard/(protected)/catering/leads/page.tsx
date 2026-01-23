import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cateringService } from "@/services/catering";
import { CateringLeadsClient } from "@/components/dashboard/catering";
import { merchantService } from "@/services/merchant";

interface CateringLeadsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    merchantId?: string;
  }>;
}

export default async function CateringLeadsPage({
  searchParams,
}: CateringLeadsPageProps) {
  const search = await searchParams;
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Parse filter parameters
  const currentPage = parseInt(search.page ?? "1", 10);
  const searchQuery = search.search;
  const statusFilter = search.status;
  const merchantIdFilter = search.merchantId;

  // Fetch merchants for filter dropdown
  const merchants = await merchantService.getMerchantsByCompanyId(
    tenantId,
    companyId
  );

  // Fetch leads with pagination
  const leadsData = await cateringService.getLeadsByCompany(
    tenantId,
    companyId,
    {
      page: currentPage,
      pageSize: 20,
      search: searchQuery,
      status: statusFilter,
      merchantId: merchantIdFilter,
    }
  );

  return (
    <CateringLeadsClient
      leads={leadsData.items}
      totalPages={leadsData.totalPages}
      currentPage={currentPage}
      total={leadsData.total}
      merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
      initialFilters={{
        search: searchQuery ?? "",
        status: statusFilter ?? "all",
        merchantId: merchantIdFilter ?? "all",
      }}
    />
  );
}
