import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Create billing portal session
export const POST = withApiHandler(async (request: NextRequest) => {
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
});
