import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateExternalRequest } from "@/lib/external-auth";
import { cartService } from "@/services/cart/cart.service";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";

const modifierSchema = z.object({
  modifierGroupId: z.string().min(1),
  modifierOptionId: z.string().min(1),
  groupName: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  quantity: z.number().int().positive().optional(),
});

const updateItemSchema = z.object({
  tenantId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  selectedModifiers: z.array(modifierSchema).optional(),
  specialInstructions: z.string().optional(),
});

const deleteItemSchema = z.object({
  tenantId: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string; itemId: string }> }
) {
  const caller = await validateExternalRequest(request);
  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    const { cartId, itemId } = await params;
    const body: unknown = await request.json();
    const parsed = updateItemSchema.safeParse(body);

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

    const { tenantId, quantity, selectedModifiers, specialInstructions } = parsed.data;

    const cart = await cartService.updateItem(tenantId, cartId, itemId, {
      quantity,
      selectedModifiers,
      specialInstructions,
    });

    return NextResponse.json({ success: true, data: cart });
  } catch (error) {
    console.error("Update cart item failed:", error);

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string; itemId: string }> }
) {
  const caller = await validateExternalRequest(request);
  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    const { cartId, itemId } = await params;
    const body: unknown = await request.json();
    const parsed = deleteItemSchema.safeParse(body);

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

    const cart = await cartService.removeItem(parsed.data.tenantId, cartId, itemId);
    return NextResponse.json({ success: true, data: cart });
  } catch (error) {
    console.error("Remove cart item failed:", error);

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
