import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { stripeConnectService } from "@/services/stripe-connect";

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const returnUrl = request.nextUrl.searchParams.get("returnUrl") ?? "/dashboard";
  const callbackUrl = `${request.nextUrl.origin}/api/dashboard/stripe-connect/callback?returnUrl=${encodeURIComponent(returnUrl)}`;

  const url = stripeConnectService.generateOAuthUrl(
    session.user.tenantId,
    callbackUrl
  );

  return NextResponse.redirect(url);
});
