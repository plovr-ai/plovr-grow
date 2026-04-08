import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { squareService } from "@/services/square";

export async function GET(request: NextRequest) {
  try {
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

    const status = await squareService.getConnectionStatus(
      session.user.tenantId,
      merchantId
    );

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("[Square Status] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get Square connection status" },
      { status: 500 }
    );
  }
}
