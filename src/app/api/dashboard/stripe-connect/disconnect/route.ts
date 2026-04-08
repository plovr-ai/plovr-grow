import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripeConnectService } from "@/services/stripe-connect";

// POST: Disconnect the Stripe Connect account for the authenticated tenant
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await stripeConnectService.disconnectAccount(session.user.tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Dashboard Stripe Connect Disconnect] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
