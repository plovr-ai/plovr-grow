import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gbpService } from "@/services/gbp";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const merchantId = searchParams.get("merchantId");
    const returnUrl = searchParams.get("returnUrl") ?? "/dashboard";

    if (!merchantId) {
      return NextResponse.json(
        { success: false, error: "merchantId is required" },
        { status: 400 }
      );
    }

    const url = gbpService.getAuthorizationUrl(
      session.user.tenantId,
      merchantId,
      returnUrl
    );

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[GBP OAuth Authorize] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate GBP OAuth" },
      { status: 500 }
    );
  }
}
