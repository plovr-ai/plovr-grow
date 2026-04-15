import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { z } from "zod";
import { clearLoyaltySession } from "@/lib/loyalty-session";

const logoutSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
});

/**
 * POST /api/storefront/loyalty/logout
 * Clear loyalty session cookie (logout)
 */
export const POST = withApiHandler(async (request: NextRequest) => {
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

  // Clear the session cookie
  await clearLoyaltySession(tenantId);

  return NextResponse.json({
    success: true,
  });
});
