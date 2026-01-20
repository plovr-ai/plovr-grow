import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { merchantService } from "@/services/merchant";
import { orderService } from "@/services/order";
import { pointsService, loyaltyConfigService } from "@/services/loyalty";

const awardPointsSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  memberId: z.string().min(1, "Member ID is required"),
  companySlug: z.string().min(1, "Company slug is required"),
});

/**
 * POST /api/storefront/loyalty/award-order-points
 * Award points to a newly registered member for their order
 * This is called after a user registers on the Order Detail page
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = awardPointsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { orderId, memberId, companySlug } = validation.data;

    // Get company
    const company = await merchantService.getCompanyBySlug(companySlug);
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    const tenantId = company.tenantId;
    const companyId = company.id;

    // Check if loyalty is enabled
    const isEnabled = await loyaltyConfigService.isLoyaltyEnabled(
      tenantId,
      companyId
    );
    if (!isEnabled) {
      return NextResponse.json(
        { success: false, error: "Loyalty program is not enabled" },
        { status: 400 }
      );
    }

    // Check if points already awarded (double-check to prevent race conditions)
    const alreadyAwarded = await pointsService.hasEarnedForOrder(
      tenantId,
      orderId
    );
    if (alreadyAwarded) {
      return NextResponse.json(
        { success: false, error: "Points already awarded for this order" },
        { status: 400 }
      );
    }

    // Get order details
    const order = await orderService.getOrder(tenantId, orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Get points per dollar config
    const pointsPerDollar = await loyaltyConfigService.getPointsPerDollar(
      tenantId,
      companyId
    );

    // Award points
    const result = await pointsService.awardPoints(tenantId, memberId, {
      merchantId: order.merchantId ?? undefined,
      orderId,
      orderAmount: Number(order.totalAmount),
      pointsPerDollar,
      description: `Earned from order #${order.orderNumber}`,
    });

    // Link order to loyalty member
    await orderService.linkLoyaltyMember(tenantId, orderId, memberId);

    return NextResponse.json({
      success: true,
      data: {
        pointsEarned: result.pointsEarned,
        newBalance: result.newBalance,
      },
    });
  } catch (error) {
    console.error("[Award Order Points] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to award points" },
      { status: 500 }
    );
  }
}
