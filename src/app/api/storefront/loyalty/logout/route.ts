import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearLoyaltySession } from "@/lib/loyalty-session";

const logoutSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
});

/**
 * POST /api/storefront/loyalty/logout
 * Clear loyalty session cookie (logout)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = logoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { tenantId } = validation.data;

    // Clear the session cookie (tenantId === companyId)
    await clearLoyaltySession(tenantId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Loyalty Logout] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while logging out",
      },
      { status: 500 }
    );
  }
}
