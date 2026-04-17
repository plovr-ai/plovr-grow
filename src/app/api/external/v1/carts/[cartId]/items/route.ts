import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { cartService } from "@/services/cart/cart.service";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";

const modifierSchema = z.object({
  modifierGroupId: z.string().min(1).optional(),
  modifierOptionId: z.string().min(1),
  groupName: z.string().optional(),
  name: z.string().optional(),
  price: z.number().min(0).optional(),
  quantity: z.number().int().positive().optional(),
});

const addItemSchema = z.object({
  tenantId: z.string().min(1),
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  selectedModifiers: z.array(modifierSchema).optional(),
  specialInstructions: z.string().optional(),
});

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
    const parsed = addItemSchema.safeParse(body);

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

    const { tenantId, menuItemId, quantity, selectedModifiers, specialInstructions } =
      parsed.data;

    const cart = await cartService.addItem(tenantId, cartId, {
      menuItemId,
      quantity,
      selectedModifiers,
      specialInstructions,
    });

    return NextResponse.json({ success: true, data: cart }, { status: 201 });
  } catch (error) {
    console.error("Add cart item failed:", error);

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
