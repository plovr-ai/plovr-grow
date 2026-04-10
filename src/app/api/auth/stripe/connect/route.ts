import { NextResponse } from "next/server"
import { stripeConnectService } from "@/services/stripe-connect"
import { AppError } from "@/lib/errors"
import { ErrorCodes } from "@/lib/errors/error-codes"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tenantId = url.searchParams.get("tenantId")
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.STRIPE_CONNECT_MISSING_TENANT } },
      { status: 400 }
    )
  }
  try {
    const baseUrl = `${url.protocol}//${url.host}`
    const redirectUri = `${baseUrl}/api/auth/stripe/callback`
    const oauthUrl = stripeConnectService.generateOAuthUrl(tenantId, redirectUri)
    return NextResponse.redirect(oauthUrl)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code } },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR } },
      { status: 500 }
    )
  }
}
