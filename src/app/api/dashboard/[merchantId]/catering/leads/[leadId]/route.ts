import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cateringService } from "@/services/catering";
import { merchantService } from "@/services/merchant";

interface RouteParams {
  params: Promise<{ merchantId: string; leadId: string }>;
}

const updateLeadStatusSchema = z.object({
  status: z.enum(["pending", "contacted", "completed", "cancelled"]),
});

// GET: Get single lead by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId, leadId } = await params;

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
  } catch (error) {
    console.error("[Dashboard Catering Lead] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get lead" },
      { status: 500 }
    );
  }
}

// PATCH: Update lead status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId, leadId } = await params;
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
  } catch (error) {
    console.error("[Dashboard Catering Lead] Error updating status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update lead status" },
      { status: 500 }
    );
  }
}
