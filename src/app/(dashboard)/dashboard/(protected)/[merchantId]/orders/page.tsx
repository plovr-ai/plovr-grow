import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { companyService } from "@/services/company";
import { orderService } from "@/services/order";
import { OrdersManagementClient } from "@/components/orders/OrdersManagementClient";
import type { OrderStatus, OrderType } from "@/types";

interface OrdersManagementProps {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{
    page?: string;
    status?: string;
    type?: string;
    merchantId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function OrdersManagementPage({
  params,
  searchParams,
}: OrdersManagementProps) {
  const { merchantId } = await params;
  const search = await searchParams;
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Get Company with its Merchants
  const company = await companyService.getCompanyWithMerchants(companyId);
  const merchants = company?.merchants ?? [];

  // Parse filter parameters
  const currentPage = parseInt(search.page ?? "1", 10);
  const statusFilter = search.status as OrderStatus | undefined;
  const typeFilter = search.type as OrderType | undefined;
  const merchantFilter = search.merchantId;
  const dateFrom = search.dateFrom ? new Date(search.dateFrom) : undefined;
  const dateTo = search.dateTo ? new Date(search.dateTo) : undefined;

  // Get orders data from database
  // Use merchantFilter if specified, otherwise use the current merchantId from URL
  const targetMerchantId = merchantFilter && merchantFilter !== "all"
    ? merchantFilter
    : merchantId;

  const ordersData = await orderService.getMerchantOrders(tenantId, targetMerchantId, {
    status: statusFilter,
    orderType: typeFilter,
    dateFrom,
    dateTo,
    page: currentPage,
    pageSize: 20,
  });

  return (
    <OrdersManagementClient
      merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
      initialOrders={ordersData.items}
      totalPages={ordersData.totalPages}
      currentPage={currentPage}
      initialFilters={{
        merchantId: merchantFilter ?? "all",
        status: statusFilter ?? "all",
        orderType: typeFilter ?? "all",
        dateFrom: search.dateFrom ?? "",
        dateTo: search.dateTo ?? "",
      }}
    />
  );
}
