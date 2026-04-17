import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { withApiHandler } from "@/lib/api";
import { merchantService } from "@/services/merchant";
import { ErrorCodes } from "@/lib/errors/error-codes";
import type { PhoneAiSettings } from "@/types/merchant";

const lookupSchema = z.object({
  phone: z.string().min(1),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const caller = await validateExternalRequest(request);
  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_FAILED } },
      { status: 400 }
    );
  }

  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.VALIDATION_FAILED },
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const merchant = await merchantService.lookupByAiPhone(parsed.data.phone);
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.MERCHANT_NOT_FOUND } },
      { status: 404 }
    );
  }

  const phoneAiSettings = merchant.phoneAiSettings as unknown as PhoneAiSettings | null;

  return NextResponse.json({
    success: true,
    data: {
      tenantId: merchant.tenantId,
      merchantId: merchant.id,
      merchantName: merchant.name,
      timezone: merchant.timezone,
      currency: merchant.currency,
      locale: merchant.locale,
      phone: merchant.phone,
      forwardPhone: phoneAiSettings?.forwardPhone ?? null,
      address: merchant.address,
      city: merchant.city,
      state: merchant.state,
      zipCode: merchant.zipCode,
    },
  });
});
