import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { z } from "zod";
import { otpService } from "@/services/otp";
import { loyaltyService, loyaltyMemberService } from "@/services/loyalty";
import { merchantService } from "@/services/merchant";
import { setLoyaltySession } from "@/lib/loyalty-session";

const verifyOtpSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  code: z.string().length(6, "Verification code must be 6 digits"),
  companySlug: z.string().min(1, "Company slug is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export const POST = withApiHandler(async (request: NextRequest) => {
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

  const { phone, code, companySlug, firstName, lastName, email } = validation.data;

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

  // Check if member already exists
  const existingMember = await loyaltyMemberService.getMemberByPhone(
    tenantId,
    phone
  );
  const purpose = existingMember ? "login" : "register";

  // Verify OTP
  const result = await otpService.verifyOtp(tenantId, phone, code, purpose);

  if (!result.verified) {
    return NextResponse.json(
      {
        success: false,
        error: { code: result.errorCode },
        reason: result.reason,
      },
      { status: 400 }
    );
  }

  // Enroll or get member
  const { member, isNew } = await loyaltyService.enrollCustomer(
    tenantId,
    phone,
    {
      firstName,
      lastName,
      email: email || undefined,
    }
  );

  // Set HTTP-only cookie for session persistence
  await setLoyaltySession(tenantId, member.id, member.phone);

  return NextResponse.json({
    success: true,
    data: {
      member: {
        id: member.id,
        phone: member.phone,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        points: member.points,
        isNewEnrollment: isNew,
      },
    },
  });
});
