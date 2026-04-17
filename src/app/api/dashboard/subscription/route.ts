import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService, PRODUCT_LINES, PRODUCT_LINE_NAMES, getAllPlans } from "@/services/subscription";
import type { ProductLineSubscriptionInfo } from "@/services/subscription";

export const GET = withApiHandler(async () => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const productLines: ProductLineSubscriptionInfo[] = await Promise.all(
    PRODUCT_LINES.map(async (productLine) => {
      const subscription = await subscriptionService.getSubscription(
        session.user.tenantId,
        productLine
      );
      const plans = getAllPlans(productLine);

      return {
        productLine,
        name: PRODUCT_LINE_NAMES[productLine],
        subscription,
        availablePlans: plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          currency: plan.currency,
          features: plan.features,
          recommended: plan.recommended,
        })),
      };
    })
  );

  return NextResponse.json({
    success: true,
    data: { productLines },
  });
});
