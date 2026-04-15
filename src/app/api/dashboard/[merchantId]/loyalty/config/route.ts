import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api";
import { loyaltyConfigService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";

// GET: Get loyalty config
export const GET = withApiHandler(async (_request: NextRequest, context) => {
  const { merchantId } = await context.params;

  // Get merchant to find company and tenant
  const merchant = await merchantService.getMerchantById(merchantId);
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: "Merchant not found" },
      { status: 404 }
    );
  }

  const tenantId = merchant.tenant.tenantId;

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
});

const updateConfigSchema = z.object({
  pointsPerDollar: z.number().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

// PUT: Update loyalty config
export const PUT = withApiHandler(async (request: NextRequest, context) => {
  const { merchantId } = await context.params;
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

  const tenantId = merchant.tenant.tenantId;

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
});
