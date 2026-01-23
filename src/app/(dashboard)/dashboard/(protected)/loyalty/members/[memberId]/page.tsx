import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loyaltyMemberService } from "@/services/loyalty";
import { pointsService } from "@/services/loyalty";
import { orderService } from "@/services/order";
import { LoyaltyMemberDetailClient } from "@/components/dashboard/loyalty";

interface PageProps {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{
    tab?: string;
    page?: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { memberId } = await params;
  return {
    title: `Member Details | Dashboard`,
    description: `View details for loyalty member ${memberId}`,
  };
}

export default async function LoyaltyMemberDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { memberId } = await params;
  const search = await searchParams;
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Parse URL parameters
  const currentTab = search.tab ?? "orders";
  const currentPage = parseInt(search.page ?? "1", 10);

  // Fetch member data
  const member = await loyaltyMemberService.getMember(tenantId, memberId);

  // Validate member exists
  if (!member) {
    notFound();
  }

  // Validate member belongs to this company
  if (member.companyId !== companyId) {
    notFound();
  }

  // Fetch data based on active tab
  const [ordersData, pointsData] = await Promise.all([
    currentTab === "orders"
      ? orderService.getMemberOrders(tenantId, memberId, {
          page: currentPage,
          pageSize: 10,
        })
      : Promise.resolve(null),
    currentTab === "points"
      ? pointsService.getTransactionHistory(tenantId, memberId, {
          page: currentPage,
          pageSize: 20,
        })
      : Promise.resolve(null),
  ]);

  // Serialize data for client component
  const memberData = {
    id: member.id,
    phone: member.phone,
    email: member.email,
    name: member.name,
    points: member.points,
    totalOrders: member.totalOrders,
    totalSpent: Number(member.totalSpent),
    lastOrderAt: member.lastOrderAt,
    enrolledAt: member.enrolledAt,
  };

  const serializedOrders = ordersData
    ? {
        items: ordersData.items.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          orderMode: order.orderMode,
          totalAmount: Number(order.totalAmount),
          createdAt: order.createdAt,
          merchant: order.merchant
            ? {
                id: order.merchant.id,
                name: order.merchant.name,
                slug: order.merchant.slug,
                timezone: order.merchant.timezone,
              }
            : null,
        })),
        total: ordersData.total,
        totalPages: ordersData.totalPages,
      }
    : null;

  const serializedPoints = pointsData
    ? {
        items: pointsData.items.map((tx) => ({
          id: tx.id,
          type: tx.type,
          points: tx.points,
          balanceAfter: tx.balanceAfter,
          description: tx.description,
          createdAt: tx.createdAt,
          merchant: tx.merchant,
          order: tx.order,
        })),
        total: pointsData.total,
        totalPages: pointsData.totalPages,
      }
    : null;

  return (
    <LoyaltyMemberDetailClient
      member={memberData}
      orders={serializedOrders}
      points={serializedPoints}
      currentTab={currentTab}
      currentPage={currentPage}
    />
  );
}
