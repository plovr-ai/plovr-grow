import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { squareService } from "@/services/square";
import { z } from "zod";

const syncSchema = z.object({
  merchantId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = syncSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          fieldErrors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { merchantId } = validation.data;
    const result = await squareService.syncCatalog(
      session.user.tenantId,
      merchantId
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Square Catalog Sync] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to sync catalog";
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
