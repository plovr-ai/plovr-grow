import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";
import { AppError } from "@/lib/errors/app-error";

interface RouteParams {
  params: Promise<{ merchantId: string; orderId: string }>;
}

const markPaidSchema = z.object({
  amount: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

// POST: Mark an in-store order as paid
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { merchantId, orderId } = await params;

    // Get merchant to find tenant
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Merchant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.tenant.tenantId;

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const parseResult = markPaidSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error.issues[0]?.message || "Invalid request",
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    await orderService.markCashOrderPaid(tenantId, orderId, input);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Dashboard Mark Paid] Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to mark order as paid" },
      { status: 500 }
    );
  }
}
