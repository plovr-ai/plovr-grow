import { NextRequest, NextResponse } from "next/server";
import { validateExternalRequest } from "@/lib/external-auth";
import { withApiHandler } from "@/lib/api";
import { merchantService } from "@/services/merchant";
import { ErrorCodes } from "@/lib/errors/error-codes";

export const GET = withApiHandler(async (request: NextRequest) => {
  const caller = await validateExternalRequest(request);
  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const merchantId = request.nextUrl.searchParams.get("merchantId");

  if (!tenantId || !merchantId) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_FAILED } },
      { status: 400 }
    );
  }

  const merchant = await merchantService.getMerchantById(merchantId);

  if (!merchant || merchant.tenantId !== tenantId) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.MERCHANT_NOT_FOUND } },
      { status: 404 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const onlineOrderUrl = `${baseUrl}/r/${merchant.slug}/order`;

  return NextResponse.json({
    success: true,
    data: { onlineOrderUrl },
  });
});
