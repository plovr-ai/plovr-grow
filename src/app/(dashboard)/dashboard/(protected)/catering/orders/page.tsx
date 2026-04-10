import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cateringOrderService } from "@/services/catering";
import { merchantService } from "@/services/merchant";
import { CateringOrdersClient } from "@/components/dashboard/catering/CateringOrdersClient";

interface CateringOrdersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    merchantId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function CateringOrdersPage({
  searchParams,
}: CateringOrdersPageProps) {
  const search = await searchParams;
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  // Parse filter parameters
  const currentPage = parseInt(search.page ?? "1", 10);
  const searchQuery = search.search;
  const statusFilter = search.status;
  const merchantIdFilter = search.merchantId;

  // Fetch merchants for filter dropdown
  const merchants = await merchantService.getMerchantsByTenantId(tenantId);

  // Default merchant ID for API calls (always select first merchant if not specified)
  const defaultMerchantId = merchants[0]?.id;
  const selectedMerchantId = merchantIdFilter || defaultMerchantId;

  // Fetch orders with pagination (always filter by merchant for catering)
  const ordersData = await cateringOrderService.getTenantOrders(
    tenantId,
    {
      page: currentPage,
      pageSize: 20,
      search: searchQuery,
      status: statusFilter as "draft" | "sent" | "paid" | "completed" | "cancelled" | "all" | undefined,
      merchantId: selectedMerchantId,
      dateFrom: search.dateFrom ? new Date(search.dateFrom) : undefined,
      dateTo: search.dateTo ? new Date(search.dateTo) : undefined,
    }
  );

  return (
    <CateringOrdersClient
      orders={ordersData.items}
      totalPages={ordersData.totalPages}
      currentPage={currentPage}
      total={ordersData.total}
      merchants={merchants.map((m) => ({ id: m.id, name: m.name, timezone: m.timezone }))}
      defaultMerchantId={defaultMerchantId}
      initialFilters={{
        search: searchQuery ?? "",
        status: statusFilter ?? "all",
        merchantId: selectedMerchantId ?? "",
        dateFrom: search.dateFrom ?? "",
        dateTo: search.dateTo ?? "",
      }}
    />
  );
}
