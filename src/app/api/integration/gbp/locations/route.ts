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

    const merchantId = request.nextUrl.searchParams.get("merchantId");
    if (!merchantId) {
      return NextResponse.json(
        { success: false, error: "merchantId is required" },
        { status: 400 }
      );
    }

    const locations = await gbpService.listLocations(
      session.user.tenantId,
      merchantId
    );

    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error("[GBP Locations] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list GBP locations" },
      { status: 500 }
    );
  }
}
