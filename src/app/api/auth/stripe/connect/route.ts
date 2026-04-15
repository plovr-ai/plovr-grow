import { NextRequest, NextResponse } from "next/server"
import { stripeConnectService } from "@/services/stripe-connect"
import { ErrorCodes } from "@/lib/errors/error-codes"
import { withApiHandler } from "@/lib/api";

export const GET = withApiHandler(async (request: NextRequest) => {
  const url = new URL(request.url)
  const tenantId = url.searchParams.get("tenantId")
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.STRIPE_CONNECT_MISSING_TENANT } },
      { status: 400 }
    )
  }

  const baseUrl = `${url.protocol}//${url.host}`
  const redirectUri = `${baseUrl}/api/auth/stripe/callback`
  const oauthUrl = stripeConnectService.generateOAuthUrl(tenantId, redirectUri)
  return NextResponse.redirect(oauthUrl)
});
