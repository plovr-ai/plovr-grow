import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loyaltyConfigService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";

interface RouteParams {
  params: Promise<{ merchantId: string }>;
}

// GET: Get loyalty config
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { merchantId } = await params;

    // Get merchant to find company and tenant
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.company.tenantId;

    const config = await loyaltyConfigService.getLoyaltyConfig(tenantId);

    return NextResponse.json({
      success: true,
      data: config
        ? {
            id: config.id,
            pointsPerDollar: config.pointsPerDollar,
            status: config.status,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[Dashboard Loyalty Config] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get loyalty config" },
      { status: 500 }
    );
  }
}

const updateConfigSchema = z.object({
  pointsPerDollar: z.number().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

// PUT: Update loyalty config
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { merchantId } = await params;
    const body = await request.json();

    // Validate request body
    const validation = updateConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    // Get merchant to find company and tenant
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.company.tenantId;

    const config = await loyaltyConfigService.upsertLoyaltyConfig(
      tenantId,
      validation.data
    );

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        pointsPerDollar: config.pointsPerDollar,
        status: config.status,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error("[Dashboard Loyalty Config] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update loyalty config" },
      { status: 500 }
    );
  }
}
