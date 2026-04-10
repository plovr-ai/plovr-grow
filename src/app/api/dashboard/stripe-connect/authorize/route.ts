import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripeConnectService } from "@/services/stripe-connect";

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error("[Stripe Connect Authorize] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate Stripe Connect" },
      { status: 500 }
    );
  }
}
