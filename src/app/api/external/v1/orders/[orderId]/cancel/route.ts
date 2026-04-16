import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { withApiHandler } from "@/lib/api";
import { orderService } from "@/services/order";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";

const cancelOrderSchema = z.object({
  tenantId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

export const POST = withApiHandler(async (request: NextRequest, { params }: RouteParams) => {
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

  const parsed = cancelOrderSchema.safeParse(body);
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

  const { orderId } = await params;
  const { tenantId, reason } = parsed.data;

  try {
    await orderService.cancelOrder(tenantId, orderId, reason, { source: "phone_order" });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === ErrorCodes.ORDER_NOT_FOUND ? 404 : 422;
      return NextResponse.json(
        { success: false, error: { code: error.code } },
        { status }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
});
