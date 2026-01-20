import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { otpService } from "@/services/otp";
import { loyaltyService, loyaltyMemberService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";
import { setLoyaltySession } from "@/lib/loyalty-session";

const verifyOtpSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  code: z.string().length(6, "Verification code must be 6 digits"),
  companySlug: z.string().min(1, "Company slug is required"),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = verifyOtpSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { phone, code, companySlug, name } = validation.data;

    // Get company by slug
    const company = await merchantService.getCompanyBySlug(companySlug);
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
    const companyId = company.id;

    // Check if member already exists
    const existingMember = await loyaltyMemberService.getMemberByPhone(
      tenantId,
      companyId,
      phone
    );
    const purpose = existingMember ? "login" : "register";

    // Verify OTP
    const result = await otpService.verifyOtp(tenantId, phone, code, purpose);

    if (!result.verified) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          reason: result.reason,
        },
        { status: 400 }
      );
    }

    // Enroll or get member
    const { member, isNew } = await loyaltyService.enrollCustomer(
      tenantId,
      companyId,
      phone,
      { name }
    );

    // Set HTTP-only cookie for session persistence
    await setLoyaltySession(companyId, member.id, member.phone);

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: member.id,
          phone: member.phone,
          name: member.name,
          points: member.points,
          isNewEnrollment: isNew,
        },
      },
    });
  } catch (error) {
    console.error("[OTP Verify] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while verifying OTP",
      },
      { status: 500 }
    );
  }
}
