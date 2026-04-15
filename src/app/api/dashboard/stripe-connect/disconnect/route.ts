import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { stripeConnectService } from "@/services/stripe-connect";

// POST: Disconnect the Stripe Connect account for the authenticated tenant
export const POST = withApiHandler(async () => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  await stripeConnectService.disconnectAccount(session.user.tenantId);

  return NextResponse.json({ success: true });
});
