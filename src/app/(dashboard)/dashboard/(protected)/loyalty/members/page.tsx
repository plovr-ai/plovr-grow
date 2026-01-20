import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loyaltyMemberService } from "@/services/loyalty";
import { LoyaltyMembersClient } from "@/components/dashboard/loyalty";

interface LoyaltyMembersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function LoyaltyMembersPage({
  searchParams,
}: LoyaltyMembersPageProps) {
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

  // Fetch members with pagination
  const membersData = await loyaltyMemberService.getMembersByCompany(
    tenantId,
    companyId,
    {
      page: currentPage,
      pageSize: 20,
      search: searchQuery,
    }
  );

  return (
    <LoyaltyMembersClient
      members={membersData.items}
      totalPages={membersData.totalPages}
      currentPage={currentPage}
      total={membersData.total}
      initialFilters={{
        search: searchQuery ?? "",
      }}
    />
  );
}
