import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

const CLIENT_ERRORS: Record<string, number> = {
  "Invalid plan code": 400,
  "Already on this plan": 409,
  "Subscription is not active": 409,
  "No active subscription found": 404,
  "Current subscription has no price ID": 409,
  "Stripe price ID not configured": 500,
};

function getStatusCode(message: string): number {
  for (const [prefix, code] of Object.entries(CLIENT_ERRORS)) {
    if (message.startsWith(prefix)) return code;
  }
  return 500;
}

// POST: Change subscription plan (upgrade/downgrade)
export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error("[Dashboard Subscription Change Plan] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to change plan";
    const statusCode = getStatusCode(message);
    return NextResponse.json(
      { success: false, error: message },
      { status: statusCode }
    );
  }
}
