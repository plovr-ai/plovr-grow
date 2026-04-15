import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";

const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const POST = withApiHandler(async (request: NextRequest, context) => {
  const { merchantId, orderId } = await context.params;

  const merchant = await merchantService.getMerchantById(merchantId);
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: "Merchant not found" },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = cancelOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  await orderService.cancelOrder(
    merchant.tenant.tenantId,
    orderId,
    parsed.data.reason,
    { source: "manual" }
  );

  return NextResponse.json({ success: true });
});
