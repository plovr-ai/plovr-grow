import { NextRequest, NextResponse } from "next/server";
import { gbpService } from "@/services/gbp";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { success: false, error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  try {
    const { returnUrl } = await gbpService.handleOAuthCallback(code, state);
    return NextResponse.redirect(new URL(returnUrl, request.nextUrl.origin));
  } catch (error) {
    console.error("[GBP OAuth Callback] Error:", error);
    const fallbackUrl = new URL("/dashboard", request.nextUrl.origin);
    fallbackUrl.searchParams.set("error", "gbp_oauth_failed");
    return NextResponse.redirect(fallbackUrl);
  }
}
