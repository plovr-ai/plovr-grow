import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { cartService } from "@/services/cart/cart.service";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";

const createCartSchema = z.object({
  tenantId: z.string().min(1),
  merchantId: z.string().min(1),
  salesChannel: z.union([
    z.literal("online_order"),
    z.literal("catering"),
    z.literal("giftcard"),
    z.literal("phone_order"),
  ]),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const caller = await validateExternalRequest(request);
  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    const body: unknown = await request.json();
    const parsed = createCartSchema.safeParse(body);
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

    const { tenantId, merchantId, salesChannel, notes } = parsed.data;
    const cart = await cartService.createCart(tenantId, merchantId, {
      salesChannel,
      notes,
    });

    return NextResponse.json({ success: true, data: cart }, { status: 201 });
  } catch (error) {
    console.error("Create cart failed:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR } },
      { status: 500 }
    );
  }
}
