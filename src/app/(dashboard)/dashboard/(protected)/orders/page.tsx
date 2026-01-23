import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { companyService } from "@/services/company";
import { orderService } from "@/services/order";
import { OrdersManagementClient, type SerializedOrder } from "@/components/orders/OrdersManagementClient";
import type { OrderStatus, OrderMode, SalesChannel } from "@/types";

interface OrdersManagementProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    mode?: string;
    salesChannel?: string;
    merchantId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function OrdersManagementPage({
  searchParams,
}: OrdersManagementProps) {
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
  const modeFilter = search.mode as OrderMode | undefined;
  const salesChannelFilter = search.salesChannel as SalesChannel | undefined;
  const merchantFilter = search.merchantId;
  const dateFrom = search.dateFrom ? new Date(search.dateFrom) : undefined;
  const dateTo = search.dateTo ? new Date(search.dateTo) : undefined;

  // Get orders data from database
  // Use merchantFilter if specified, otherwise get all company orders
  const ordersData = await orderService.getCompanyOrders(tenantId, companyId, {
    merchantId: merchantFilter && merchantFilter !== "all" ? merchantFilter : undefined,
    status: statusFilter,
    orderMode: modeFilter,
    salesChannel: salesChannelFilter,
    dateFrom,
    dateTo,
    page: currentPage,
    pageSize: 20,
  });

  // Convert Decimal fields to numbers for Client Component serialization
  // Merchant info (including timezone) is already included from the repository
  const serializedOrders = ordersData.items.map((order) => ({
    ...order,
    subtotal: Number(order.subtotal),
    taxAmount: Number(order.taxAmount),
    tipAmount: Number(order.tipAmount),
    deliveryFee: Number(order.deliveryFee),
    discount: Number(order.discount),
    totalAmount: Number(order.totalAmount),
  })) as SerializedOrder[];

  return (
    <OrdersManagementClient
      merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
      initialOrders={serializedOrders}
      totalPages={ordersData.totalPages}
      currentPage={currentPage}
      initialFilters={{
        merchantId: merchantFilter ?? "all",
        status: statusFilter ?? "all",
        orderMode: modeFilter ?? "all",
        salesChannel: salesChannelFilter ?? "all",
        dateFrom: search.dateFrom ?? "",
        dateTo: search.dateTo ?? "",
      }}
    />
  );
}
