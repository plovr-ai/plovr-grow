import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/services/auth/auth.service";
import { ErrorCodes } from "@/lib/errors/error-codes";
import { withApiHandler } from "@/lib/api";

const claimSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = claimSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.AUTH_VALIDATION_FAILED }, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { companySlug } = await authService.claimTenant(parsed.data);

  return NextResponse.json({ success: true, companySlug }, { status: 200 });
});
