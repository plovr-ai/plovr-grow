import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";
import { checkoutFormSchema } from "@storefront/lib/validations/checkout";
import type { OrderItemData } from "@/types";

interface OrderRequestBody {
  orderType: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  loyaltyMemberId?: string;
  deliveryAddress?: {
    street: string;
    apt?: string;
    city: string;
    state: string;
    zipCode: string;
    instructions?: string;
  };
  tipAmount?: number;
  notes?: string;
  items: OrderItemData[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get merchant by slug
    const merchant = await merchantService.getMerchantBySlug(slug);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 }
      );
    }

    // Get tenantId from merchant -> company -> tenant chain
    const tenantId = merchant.company.tenantId;

    // Parse request body
    const body: OrderRequestBody = await request.json();

    // Validate form data with Zod
    const formValidation = checkoutFormSchema.safeParse({
      orderType: body.orderType,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      deliveryAddress: body.deliveryAddress,
      tipAmount: body.tipAmount,
      notes: body.notes,
    });

    if (!formValidation.success) {
      const errors = formValidation.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          fieldErrors: errors,
        },
        { status: 400 }
      );
    }

    // Validate items exist
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Cart is empty" },
        { status: 400 }
      );
    }

    // Create order with merchantId
    const order = await orderService.createOrder(tenantId, {
      merchantId: merchant.id,
      loyaltyMemberId: body.loyaltyMemberId,
      customerName: formValidation.data.customerName,
      customerPhone: formValidation.data.customerPhone,
      customerEmail: formValidation.data.customerEmail || undefined,
      orderType: formValidation.data.orderType,
      items: body.items,
      notes: formValidation.data.notes || undefined,
      deliveryAddress: formValidation.data.deliveryAddress,
      tipAmount: formValidation.data.tipAmount,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order creation failed:", error);

    const message =
      error instanceof Error ? error.message : "Failed to create order";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
