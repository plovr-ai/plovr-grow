import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";
import { giftCardService } from "@/services/giftcard";
import { giftcardFormSchema } from "@storefront/lib/validations/giftcard";
import type { OrderItemData } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;

    // Get company by slug
    const company = await merchantService.getCompanyBySlug(companySlug);
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = giftcardFormSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          fieldErrors: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Create giftcard order item (virtual item, not from menu)
    const giftcardItem: OrderItemData = {
      menuItemId: `giftcard-${data.amount}`,
      name: `$${data.amount} Gift Card`,
      price: data.amount,
      quantity: 1,
      totalPrice: data.amount,
      selectedModifiers: [],
      taxes: [], // Giftcards are tax-exempt
    };

    // Create order with salesChannel="giftcard"
    const order = await orderService.createOrder(company.tenantId, {
      companyId: company.id,
      merchantId: undefined, // Company-level order
      customerFirstName: data.buyerFirstName,
      customerLastName: data.buyerLastName,
      customerPhone: data.buyerPhone,
      customerEmail: data.buyerEmail,
      orderMode: "pickup", // Generic fulfillment (actual: digital delivery)
      salesChannel: "giftcard",
      items: [giftcardItem],
      notes: data.message || undefined,
      tipAmount: 0,
    });

    // Create the gift card record with generated card number
    const giftCard = await giftCardService.createGiftCard(
      company.tenantId,
      company.id,
      {
        purchaseOrderId: order.id,
        amount: data.amount,
      }
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          cardNumber: giftCard.cardNumber,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Giftcard order creation failed:", error);

    const message = error instanceof Error ? error.message : "Failed to create order";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
