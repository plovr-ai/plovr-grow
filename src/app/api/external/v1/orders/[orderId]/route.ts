import { NextRequest, NextResponse } from "next/server";
import { validateExternalRequest } from "@/lib/external-auth";
import { withApiHandler } from "@/lib/api";
import { orderService } from "@/services/order";
import { ErrorCodes } from "@/lib/errors/error-codes";

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

export const GET = withApiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const caller = await validateExternalRequest(request);

  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_FAILED } },
      { status: 400 }
    );
  }

  const { orderId } = await params;

  const orderWithTimeline = await orderService.getOrderWithTimeline(tenantId, orderId);

  if (!orderWithTimeline) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.ORDER_NOT_FOUND } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: orderWithTimeline });
});
