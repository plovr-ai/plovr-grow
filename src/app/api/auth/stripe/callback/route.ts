import { NextResponse } from "next/server"
import { stripeConnectService } from "@/services/stripe-connect"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const dashboardUrl = `${url.protocol}//${url.host}/dashboard/settings`

  if (error) {
    const errorDesc = url.searchParams.get("error_description") ?? "Unknown error"
    return NextResponse.redirect(`${dashboardUrl}?stripe_connect=error&message=${encodeURIComponent(errorDesc)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${dashboardUrl}?stripe_connect=error&message=Missing+parameters`)
  }
  try {
    const { tenantId } = stripeConnectService.parseOAuthState(state)
    await stripeConnectService.handleOAuthCallback(code, tenantId)
    return NextResponse.redirect(`${dashboardUrl}?stripe_connect=success`)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed"
    return NextResponse.redirect(`${dashboardUrl}?stripe_connect=error&message=${encodeURIComponent(message)}`)
  }
}
