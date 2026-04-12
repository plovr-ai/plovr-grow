import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { integrationRepository } from "@/repositories/integration.repository";
import { posProviderRegistry } from "@/services/integration/pos-provider-registry";
import { AppError } from "@/lib/errors";
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
    const { tenantId } = session.user;

    // Look up the active POS connection for this merchant
    const connection = await integrationRepository.getActivePosConnection(
      tenantId,
      merchantId
    );

    if (!connection) {
      return NextResponse.json(
        { success: false, error: "INTEGRATION_NOT_CONNECTED" },
        { status: 404 }
      );
    }

    // Dispatch to the correct POS provider via registry
    const provider = posProviderRegistry.getProvider(connection.type);
    const result = await provider.syncCatalog(tenantId, merchantId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Catalog Sync] Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.code },
        { status: error.statusCode }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to sync catalog";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
