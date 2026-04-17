import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";
import {
  PRODUCT_LINES,
  type ProductLine,
} from "@/services/subscription/subscription.types";

export const POST = withApiHandler(
  async (
    _request,
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

    await subscriptionService.resumeSubscription(
      session.user.tenantId,
      productLine as ProductLine
    );

    return NextResponse.json({
      success: true,
      data: { message: "Subscription resumed" },
    });
  }
);
