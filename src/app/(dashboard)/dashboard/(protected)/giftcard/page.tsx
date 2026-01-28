import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { giftCardService } from "@/services/giftcard";
import { GiftcardOverviewClient } from "@/components/dashboard/giftcard";
import type { GiftCardStatus } from "@/repositories/giftcard.repository";

interface GiftcardPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
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
  const statusFilter = search.status as GiftCardStatus | undefined;
  const searchQuery = search.search;

  // Fetch stats and gift cards in parallel
  const [stats, giftCardsData] = await Promise.all([
    giftCardService.getCompanyGiftCardStats(tenantId, companyId),
    giftCardService.getCompanyGiftCards(tenantId, companyId, {
      page: currentPage,
      pageSize: 20,
      status: statusFilter,
      search: searchQuery,
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
        status: statusFilter ?? "all",
        search: searchQuery ?? "",
      }}
    />
  );
}
