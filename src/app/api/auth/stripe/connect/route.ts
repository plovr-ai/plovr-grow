import { NextResponse } from "next/server"
import { stripeConnectService } from "@/services/stripe-connect"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tenantId = url.searchParams.get("tenantId")
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }
  const baseUrl = `${url.protocol}//${url.host}`
  const redirectUri = `${baseUrl}/api/auth/stripe/callback`
  const oauthUrl = stripeConnectService.generateOAuthUrl(tenantId, redirectUri)
  return NextResponse.redirect(oauthUrl)
}
