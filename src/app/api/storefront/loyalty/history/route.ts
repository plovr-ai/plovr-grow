import { NextRequest, NextResponse } from "next/server";
import { loyaltyMemberService, pointsService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get("phone");
    const companySlug = searchParams.get("companySlug");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

    if (!phone || !companySlug) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: phone and companySlug",
        },
        { status: 400 }
      );
    }

    // Get company by slug
    const company = await merchantService.getTenantBySlug(companySlug);
    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: "Company not found",
        },
        { status: 404 }
      );
    }

    const tenantId = company.tenantId;

    // Get member by phone
    const member = await loyaltyMemberService.getMemberByPhone(
      tenantId,
      phone
    );

    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: "Loyalty member not found",
        },
        { status: 404 }
      );
    }

    // Get transaction history
    const history = await pointsService.getTransactionHistory(
      tenantId,
      member.id,
      { page, pageSize }
    );

    return NextResponse.json({
      success: true,
      data: {
        transactions: history.items.map((t) => ({
          id: t.id,
          type: t.type,
          points: t.points,
          balanceAfter: t.balanceAfter,
          description: t.description,
          createdAt: t.createdAt,
          merchant: t.merchant
            ? {
                name: t.merchant.name,
              }
            : null,
          order: t.order
            ? {
                orderNumber: t.order.orderNumber,
              }
            : null,
        })),
        pagination: {
          total: history.total,
          page: history.page,
          pageSize: history.pageSize,
          totalPages: history.totalPages,
        },
      },
    });
  } catch (error) {
    console.error("[Loyalty History] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while fetching loyalty history",
      },
      { status: 500 }
    );
  }
}
