import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";
import { AppError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ merchantId: string; orderId: string }>;
}

const markPaidSchema = z.object({
  amount: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId, orderId } = await params;

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

    const parsed = markPaidSchema.safeParse(body);
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

    await orderService.markCashOrderPaid(
      merchant.tenant.tenantId,
      orderId,
      parsed.data
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "ORDER_NOT_FOUND" ? 404 : 422;
      return NextResponse.json(
        { success: false, error: error.code },
        { status }
      );
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
