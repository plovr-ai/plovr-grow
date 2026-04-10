import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gbpService } from "@/services/gbp";
import { merchantService } from "@/services/merchant";
import { tenantService } from "@/services/tenant/tenant.service";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const syncSchema = z.object({
  merchantId: z.string().min(1),
  locationName: z.string().min(1),
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
          error: "Invalid request",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { merchantId, locationName } = validation.data;
    const { tenantId } = session.user;

    // Sync location data from GBP
    const { merchantData } = await gbpService.syncLocation(
      tenantId,
      merchantId,
      locationName
    );

    // Update merchant with synced location data
    await merchantService.updateMerchant(tenantId, merchantId, merchantData);

    // Mark GBP onboarding step as completed
    await tenantService.updateOnboardingStep(
      tenantId,
      "gbp",
      "completed"
    );

    return NextResponse.json({ success: true, data: { merchantData } });
  } catch (error) {
    console.error("[GBP Location Sync] Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to sync GBP location" },
      { status: 500 }
    );
  }
}
