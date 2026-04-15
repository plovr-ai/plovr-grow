import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// GET: Get current subscription info
export const GET = withApiHandler(async () => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const subscription = await subscriptionService.getSubscription(
    session.user.tenantId
  );

  return NextResponse.json({
    success: true,
    data: { subscription },
  });
});
