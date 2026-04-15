import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gbpService } from "@/services/gbp";
import { withApiHandler } from "@/lib/api";

export const GET = withApiHandler(async (request: NextRequest) => {
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
});
