import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Create billing portal session
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
    const { returnUrl } = body as { returnUrl?: string };

    const result = await subscriptionService.createBillingPortalSession(
      session.user.tenantId,
      returnUrl
    );

    return NextResponse.json({
      success: true,
      data: { url: result.url },
    });
  } catch (error) {
    console.error("[Dashboard Subscription Portal] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create billing portal session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
