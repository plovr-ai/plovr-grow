import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    // Get merchant by slug
    const merchant = await merchantService.getMerchantBySlug(slug);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 }
      );
    }

    // Get tenantId from merchant -> company -> tenant chain
    const tenantId = merchant.tenant.tenantId;

    // Fetch order with timeline
    const order = await orderService.getOrderWithTimeline(tenantId, orderId);

    // Validate order exists and belongs to this merchant
    if (!order || order.merchantId !== merchant.id) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Failed to fetch order:", error);

    const message =
      error instanceof Error ? error.message : "Failed to fetch order";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
