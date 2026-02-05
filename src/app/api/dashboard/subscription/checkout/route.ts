import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Create checkout session for subscription
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
    const { successUrl, cancelUrl } = body as {
      successUrl?: string;
      cancelUrl?: string;
    };

    const result = await subscriptionService.createCheckoutSession(
      session.user.tenantId,
      { successUrl, cancelUrl }
    );

    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        sessionId: result.sessionId,
      },
    });
  } catch (error) {
    console.error("[Dashboard Subscription Checkout] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
