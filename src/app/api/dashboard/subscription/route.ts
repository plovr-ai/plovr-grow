import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// GET: Get current subscription info
export async function GET() {
  try {
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
  } catch (error) {
    console.error("[Dashboard Subscription] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get subscription" },
      { status: 500 }
    );
  }
}
