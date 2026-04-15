import { NextRequest, NextResponse } from "next/server";
import { squareService } from "@/services/square";
import { withApiHandler } from "@/lib/api";

export const GET = withApiHandler(async (request: NextRequest) => {
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
    const { returnUrl } = await squareService.handleOAuthCallback(code, state);
    return NextResponse.redirect(new URL(returnUrl, request.nextUrl.origin));
  } catch (error) {
    console.error("[Square OAuth Callback] Error:", error);
    const fallbackUrl = new URL("/dashboard", request.nextUrl.origin);
    fallbackUrl.searchParams.set("error", "square_oauth_failed");
    return NextResponse.redirect(fallbackUrl);
  }
});
