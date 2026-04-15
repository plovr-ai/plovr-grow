import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api";
import { cateringService } from "@/services/catering";
import { merchantService } from "@/services/merchant";

const updateLeadStatusSchema = z.object({
  status: z.enum(["pending", "contacted", "completed", "cancelled"]),
});

// GET: Get single lead by ID
export const GET = withApiHandler(async (request: NextRequest, context) => {
  const { merchantId, leadId } = await context.params;

  // Get merchant to find tenant
  const merchant = await merchantService.getMerchantById(merchantId);
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: "Merchant not found" },
      { status: 404 }
    );
  }

  const tenantId = merchant.tenant.tenantId;
  const lead = await cateringService.getLeadById(tenantId, leadId);

  if (!lead) {
    return NextResponse.json(
      { success: false, error: "Lead not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { lead },
  });
});

// PATCH: Update lead status
export const PATCH = withApiHandler(async (request: NextRequest, context) => {
  const { merchantId, leadId } = await context.params;
  const body = await request.json();

  // Validate input
  const validation = updateLeadStatusSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: "Invalid status" },
      { status: 400 }
    );
  }

  // Get merchant to find tenant
  const merchant = await merchantService.getMerchantById(merchantId);
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: "Merchant not found" },
      { status: 404 }
    );
  }

  const tenantId = merchant.tenant.tenantId;
  await cateringService.updateLeadStatus(
    tenantId,
    leadId,
    validation.data.status
  );

  // Fetch updated lead
  const lead = await cateringService.getLeadById(tenantId, leadId);

  return NextResponse.json({
    success: true,
    data: { lead },
  });
});
