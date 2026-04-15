import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { merchantService } from "@/services/merchant";
import { pointsService } from "@/services/loyalty";

/**
 * GET /api/storefront/loyalty/order-points-status
 * Check if points have already been awarded for an order
 * Query params: orderId (required), companySlug (required)
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const orderId = request.nextUrl.searchParams.get("orderId");
  const companySlug = request.nextUrl.searchParams.get("companySlug");

  if (!orderId || !companySlug) {
    return NextResponse.json(
      { success: false, error: "Missing required parameters" },
      { status: 400 }
    );
  }

  // Get company to get tenantId
  const company = await merchantService.getTenantBySlug(companySlug);
  if (!company) {
    return NextResponse.json(
      { success: false, error: "Company not found" },
      { status: 404 }
    );
  }

  const tenantId = company.tenantId;

  // Check if points already awarded
  const pointsAwarded = await pointsService.hasEarnedForOrder(
    tenantId,
    orderId
  );

  return NextResponse.json({
    success: true,
    data: { pointsAwarded },
  });
});
