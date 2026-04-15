import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { z } from "zod";
import { otpService } from "@/services/otp";
import { loyaltyMemberService, loyaltyConfigService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";

const sendOtpSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  companySlug: z.string().min(1, "Company slug is required"),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate request body
  const validation = sendOtpSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: validation.error.issues[0].message,
      },
      { status: 400 }
    );
  }

  const { phone, companySlug } = validation.data;

  // Get company by slug
  const company = await merchantService.getTenantBySlug(companySlug);
  if (!company) {
    return NextResponse.json(
      {
        success: false,
        error: "Company not found",
      },
      { status: 404 }
    );
  }

  const tenantId = company.tenantId;

  // Check if loyalty is enabled
  const isEnabled = await loyaltyConfigService.isLoyaltyEnabled(tenantId);
  if (!isEnabled) {
    return NextResponse.json(
      {
        success: false,
        error: "Loyalty program is not enabled for this company",
      },
      { status: 400 }
    );
  }

  // Check if member already exists
  const existingMember = await loyaltyMemberService.getMemberByPhone(
    tenantId,
    phone
  );
  const isNewMember = !existingMember;

  // Send OTP
  const result = await otpService.sendOtp(
    tenantId,
    phone,
    isNewMember ? "register" : "login"
  );

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: { code: result.errorCode },
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      expiresInSeconds: result.expiresInSeconds,
      isNewMember,
    },
  });
});
