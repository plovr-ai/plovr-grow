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

  const merchantId = request.nextUrl.searchParams.get("merchantId");
  if (!merchantId) {
    return NextResponse.json(
      { success: false, error: "merchantId is required" },
      { status: 400 }
    );
  }

  const status = await gbpService.getConnectionStatus(
    session.user.tenantId,
    merchantId
  );

  return NextResponse.json({ success: true, data: status });
});
