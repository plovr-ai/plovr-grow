import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Resume canceled subscription
export async function POST() {
  try {
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
  } catch (error) {
    console.error("[Dashboard Subscription Resume] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to resume subscription";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
