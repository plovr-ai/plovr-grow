import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { giftCardService } from "@/services/giftcard";
import { tenantService } from "@/services/tenant/tenant.service";
import { GiftcardOverviewClient } from "@/components/dashboard/giftcard";
import { getLastNDaysInTimezone } from "@/lib/timezone";

interface GiftcardPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function GiftcardPage({ searchParams }: GiftcardPageProps) {
  const search = await searchParams;
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  // Get tenant for timezone
  const company = await tenantService.getTenant(tenantId);
  const companyTimezone = company?.timezone ?? "America/New_York";

  // Calculate default date range (last 30 days)
  const defaultDateRange = getLastNDaysInTimezone(companyTimezone, 30);
  const dateFromString = search.dateFrom ?? defaultDateRange.from;
  const dateToString = search.dateTo ?? defaultDateRange.to;

  // Parse filter parameters
  const currentPage = parseInt(search.page ?? "1", 10);
  const searchQuery = search.search;

  // Parse date filters (now always have values)
  const dateFrom = new Date(dateFromString);
  // For dateTo, set to end of day for inclusive range
  const dateTo = new Date(dateToString + "T23:59:59.999");

  // Fetch stats and gift cards in parallel
  const [stats, giftCardsData] = await Promise.all([
    giftCardService.getTenantGiftCardStats(tenantId, {
      dateFrom,
      dateTo,
    }),
    giftCardService.getTenantGiftCards(tenantId, {
      page: currentPage,
      pageSize: 20,
      search: searchQuery,
      dateFrom,
      dateTo,
    }),
  ]);

  return (
    <GiftcardOverviewClient
      stats={stats}
      giftCards={giftCardsData.items}
      totalPages={giftCardsData.totalPages}
      currentPage={currentPage}
      total={giftCardsData.total}
      initialFilters={{
        search: searchQuery ?? "",
        dateFrom: dateFromString,
        dateTo: dateToString,
      }}
    />
  );
}
