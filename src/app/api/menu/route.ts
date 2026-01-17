import { NextRequest, NextResponse } from "next/server";
import { menuApiService } from "@/services/menu/menu-api.service";

/**
 * GET /api/menu
 * 获取商家菜单数据
 *
 * Query Parameters:
 * - tenantId: 租户 ID (required)
 * - merchantId: 商家 ID (required)
 *
 * Response: MenuApiResponse
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenantId");
    const merchantId = searchParams.get("merchantId");

    // Validate required parameters
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "tenantId is required" },
        { status: 400 }
      );
    }

    if (!merchantId) {
      return NextResponse.json(
        { success: false, error: "merchantId is required" },
        { status: 400 }
      );
    }

    // Get menu data
    const menuData = await menuApiService.getMenu(tenantId, merchantId);

    return NextResponse.json({
      success: true,
      data: menuData,
    });
  } catch (error) {
    console.error("Failed to get menu:", error);

    const message =
      error instanceof Error ? error.message : "Failed to get menu";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
