import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";
import { giftCardService } from "@/services/giftcard";
import { paymentService } from "@/services/payment";
import { stripeConnectService } from "@/services/stripe-connect";
import { giftcardApiSchema } from "@storefront/lib/validations/giftcard";
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
    const validation = giftcardApiSchema.safeParse(body);

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

    // Verify payment if stripePaymentIntentId is provided
    if (data.stripePaymentIntentId) {
      const connectAccount = await stripeConnectService.getConnectAccount(company.tenantId);
      if (!connectAccount) {
        return NextResponse.json(
          { success: false, error: "Payment provider not configured" },
          { status: 400 }
        );
      }
      const verification = await paymentService.verifyPayment(
        data.stripePaymentIntentId,
        data.amount,
        connectAccount.stripeAccountId
      );

      if (!verification.success) {
        return NextResponse.json(
          {
            success: false,
            error: verification.error || "Payment verification failed",
          },
          { status: 400 }
        );
      }
    }

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

    // Create company order for giftcard
    const order = await orderService.createCompanyOrder(company.tenantId, {
      companyId: company.id,
      customerFirstName: data.buyerFirstName,
      customerLastName: data.buyerLastName,
      customerPhone: data.buyerPhone,
      customerEmail: data.buyerEmail,
      items: [giftcardItem],
      notes: data.message || undefined,
    });

    // Create payment record if payment was made
    if (data.stripePaymentIntentId) {
      await paymentService.createPaymentRecord({
        tenantId: company.tenantId,
        orderId: order.id,
        stripePaymentIntentId: data.stripePaymentIntentId,
        amount: data.amount,
        currency: "USD",
      });
    }

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
