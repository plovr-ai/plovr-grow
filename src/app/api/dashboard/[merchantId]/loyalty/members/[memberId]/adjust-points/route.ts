import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api";
import { pointsService } from "@/services/loyalty";
import { loyaltyMemberService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";

const adjustPointsSchema = z.object({
  points: z.number().int().refine((val) => val !== 0, {
    message: "Points must not be zero",
  }),
  description: z.string().min(1, "Description is required").max(500),
});

// POST: Adjust member points
export const POST = withApiHandler(async (request: NextRequest, context) => {
  const { merchantId, memberId } = await context.params;

  // Get merchant to find tenant and company
  const merchant = await merchantService.getMerchantById(merchantId);
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: "Merchant not found" },
      { status: 404 }
    );
  }

  const tenantId = merchant.tenant.tenantId;

  // Verify member exists and belongs to this tenant
  const member = await loyaltyMemberService.getMember(tenantId, memberId);
  if (!member) {
    return NextResponse.json(
      { success: false, error: "Member not found" },
      { status: 404 }
    );
  }

  if (member.tenantId !== tenantId) {
    return NextResponse.json(
      { success: false, error: "Member does not belong to this tenant" },
      { status: 403 }
    );
  }

  // Parse and validate request body
  const body = await request.json();
  const parseResult = adjustPointsSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: parseResult.error.issues[0]?.message || "Invalid request",
      },
      { status: 400 }
    );
  }

  const { points, description } = parseResult.data;

  // Adjust points
  const result = await pointsService.adjustPoints(
    tenantId,
    memberId,
    points,
    description
  );

  return NextResponse.json({
    success: true,
    data: {
      newBalance: result.newBalance,
      transactionId: result.transactionId,
    },
  });
});
