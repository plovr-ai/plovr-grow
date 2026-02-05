import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Cancel subscription
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
    const { cancelImmediately } = body as { cancelImmediately?: boolean };

    await subscriptionService.cancelSubscription(
      session.user.tenantId,
      cancelImmediately ?? false
    );

    return NextResponse.json({
      success: true,
      data: { message: "Subscription canceled" },
    });
  } catch (error) {
    console.error("[Dashboard Subscription Cancel] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to cancel subscription";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
