import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { withApiHandler } from "@/lib/api";
import { merchantService } from "@/services/merchant";
import { ErrorCodes } from "@/lib/errors/error-codes";

const generateLinkSchema = z.object({
  tenantId: z.string().min(1),
  merchantId: z.string().min(1),
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

  const parsed = generateLinkSchema.safeParse(body);
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

  const { tenantId, merchantId } = parsed.data;
  const merchant = await merchantService.getMerchantById(merchantId);

  if (!merchant || merchant.tenantId !== tenantId) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.MERCHANT_NOT_FOUND } },
      { status: 404 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/r/${merchant.slug}/order`;

  return NextResponse.json({
    success: true,
    data: { url },
  });
});
