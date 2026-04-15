import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { stripeConnectService } from "@/services/stripe-connect";

// GET: Get Connect account status for the authenticated tenant
export const GET = withApiHandler(async () => {
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
});
