import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Create checkout session for subscription
export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { planCode, successUrl, cancelUrl } = body as {
    planCode?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!planCode) {
    return NextResponse.json(
      { success: false, error: "planCode is required" },
      { status: 400 }
    );
  }

  const result = await subscriptionService.createCheckoutSession(
    session.user.tenantId,
    planCode,
    { successUrl, cancelUrl }
  );

  return NextResponse.json({
    success: true,
    data: {
      url: result.url,
      sessionId: result.sessionId,
    },
  });
});
