import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { loyaltyMemberService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";

// GET: Get loyalty members list
export const GET = withApiHandler(async (request: NextRequest, context) => {
  const { merchantId } = await context.params;
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);
  const search = searchParams.get("search") ?? undefined;

  // Get merchant to find company and tenant
  const merchant = await merchantService.getMerchantById(merchantId);
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: "Merchant not found" },
      { status: 404 }
    );
  }

  const tenantId = merchant.tenant.tenantId;

  const result = await loyaltyMemberService.getMembersByTenant(
    tenantId,
    { page, pageSize, search }
  );

  return NextResponse.json({
    success: true,
    data: {
      members: result.items.map((m: typeof result.items[number]) => ({
        id: m.id,
        phone: m.phone,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        points: m.points,
        totalOrders: m.totalOrders,
        totalSpent: m.totalSpent,
        lastOrderAt: m.lastOrderAt,
        enrolledAt: m.enrolledAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    },
  });
});
