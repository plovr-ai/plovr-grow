import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { stripeConnectService } from "@/services/stripe-connect";

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const returnUrl = searchParams.get("returnUrl") ?? "/dashboard";

  if (!code || !state) {
    const errorUrl = new URL("/dashboard", request.nextUrl.origin);
    errorUrl.searchParams.set("error", "stripe_connect_missing_params");
    return NextResponse.redirect(errorUrl);
  }

  try {
    const { tenantId } = stripeConnectService.parseOAuthState(state);
    await stripeConnectService.handleOAuthCallback(code, tenantId);
    return NextResponse.redirect(new URL(returnUrl, request.nextUrl.origin));
  } catch (error) {
    console.error("[Stripe Connect Callback] Error:", error);
    const fallbackUrl = new URL("/dashboard", request.nextUrl.origin);
    fallbackUrl.searchParams.set("error", "stripe_connect_failed");
    return NextResponse.redirect(fallbackUrl);
  }
});
