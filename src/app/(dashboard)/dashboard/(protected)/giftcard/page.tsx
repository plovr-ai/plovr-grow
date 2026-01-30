import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { giftCardService } from "@/services/giftcard";
import { GiftcardOverviewClient } from "@/components/dashboard/giftcard";

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
  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Parse filter parameters
  const currentPage = parseInt(search.page ?? "1", 10);
  const searchQuery = search.search;

  // Parse date filters
  const dateFrom = search.dateFrom ? new Date(search.dateFrom) : undefined;
  // For dateTo, set to end of day for inclusive range
  const dateTo = search.dateTo
    ? new Date(search.dateTo + "T23:59:59.999")
    : undefined;

  // Fetch stats and gift cards in parallel
  const [stats, giftCardsData] = await Promise.all([
    giftCardService.getCompanyGiftCardStats(tenantId, companyId, {
      dateFrom,
      dateTo,
    }),
    giftCardService.getCompanyGiftCards(tenantId, companyId, {
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
        dateFrom: search.dateFrom ?? "",
        dateTo: search.dateTo ?? "",
      }}
    />
  );
}
