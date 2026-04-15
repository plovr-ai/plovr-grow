import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Resume canceled subscription
export const POST = withApiHandler(async () => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  await subscriptionService.resumeSubscription(session.user.tenantId);

  return NextResponse.json({
    success: true,
    data: { message: "Subscription resumed" },
  });
});
