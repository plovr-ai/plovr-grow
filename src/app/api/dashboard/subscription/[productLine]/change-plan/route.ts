import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";
import {
  PRODUCT_LINES,
  type ProductLine,
} from "@/services/subscription/subscription.types";

export const POST = withApiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ productLine: string }> }
  ) => {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { productLine } = await params;
    if (!(PRODUCT_LINES as readonly string[]).includes(productLine)) {
      return NextResponse.json(
        { success: false, error: "Invalid product line" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { planCode } = body as { planCode?: string };

    if (!planCode) {
      return NextResponse.json(
        { success: false, error: "planCode is required" },
        { status: 400 }
      );
    }

    await subscriptionService.changePlan(
      session.user.tenantId,
      productLine as ProductLine,
      planCode
    );

    return NextResponse.json({ success: true });
  }
);
