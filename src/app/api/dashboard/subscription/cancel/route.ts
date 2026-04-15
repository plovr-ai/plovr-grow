import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Cancel subscription
export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { cancelImmediately } = body as { cancelImmediately?: boolean };

  await subscriptionService.cancelSubscription(
    session.user.tenantId,
    cancelImmediately ?? false
  );

  return NextResponse.json({
    success: true,
    data: { message: "Subscription canceled" },
  });
});
