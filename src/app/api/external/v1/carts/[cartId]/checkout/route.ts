import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { cartService } from "@/services/cart/cart.service";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";

const deliveryAddressSchema = z.object({
  street: z.string().min(1),
  apt: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  instructions: z.string().optional(),
});

const checkoutSchema = z
  .object({
    tenantId: z.string().min(1),
    customerFirstName: z.string().min(1),
    customerLastName: z.string().min(1),
    customerPhone: z.string().min(1),
    customerEmail: z.string().email().optional(),
    orderMode: z.union([
      z.literal("pickup"),
      z.literal("delivery"),
      z.literal("dine_in"),
    ]),
    deliveryAddress: deliveryAddressSchema.optional(),
    tipAmount: z.number().nonnegative().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.orderMode === "delivery") {
        return data.deliveryAddress !== undefined;
      }
      return true;
    },
    {
      message: "deliveryAddress is required when orderMode is 'delivery'",
      path: ["deliveryAddress"],
    }
  );

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string }> }
) {
  const caller = await validateExternalRequest(request);
  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    const { cartId } = await params;
    const body: unknown = await request.json();
    const parsed = checkoutSchema.safeParse(body);

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

    const {
      tenantId,
      customerFirstName,
      customerLastName,
      customerPhone,
      customerEmail,
      orderMode,
      deliveryAddress,
      tipAmount,
      notes,
    } = parsed.data;

    const result = await cartService.checkout(tenantId, cartId, {
      customerFirstName,
      customerLastName,
      customerPhone,
      customerEmail,
      orderMode,
      deliveryAddress,
      tipAmount,
      notes,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Cart checkout failed:", error);

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
