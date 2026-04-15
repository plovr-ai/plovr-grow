import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Change subscription plan (upgrade/downgrade)
export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
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

  await subscriptionService.changePlan(session.user.tenantId, planCode);

  return NextResponse.json({ success: true });
});
