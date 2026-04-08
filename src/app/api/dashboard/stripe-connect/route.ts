import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripeConnectService } from "@/services/stripe-connect";

// GET: Get Connect account status for the authenticated tenant
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const account = await stripeConnectService.getConnectAccount(
      session.user.tenantId
    );

    if (!account) {
      return NextResponse.json({
        success: true,
        data: { connected: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        stripeAccountId: account.stripeAccountId,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        detailsSubmitted: account.detailsSubmitted,
        connectedAt: account.connectedAt,
      },
    });
  } catch (error) {
    console.error("[Dashboard Stripe Connect] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get connect status" },
      { status: 500 }
    );
  }
}
