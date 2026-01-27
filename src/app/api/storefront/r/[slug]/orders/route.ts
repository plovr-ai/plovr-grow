import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";
import { pointsService, loyaltyConfigService } from "@/services/loyalty";
import { giftCardService } from "@/services/giftcard";
import { checkoutFormSchema } from "@storefront/lib/validations/checkout";
import type { OrderItemData } from "@/types";

interface OrderRequestBody {
  orderMode: string;
  customerFirstName: string;
  customerLastName: string;
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
  // Gift card payment
  giftCardPayment?: {
    giftCardId: string;
    amount: number;
  };
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
      orderMode: body.orderMode,
      customerFirstName: body.customerFirstName,
      customerLastName: body.customerLastName,
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

    // Validate gift card if provided
    let validatedGiftCard: { id: string; balance: number } | null = null;
    if (body.giftCardPayment) {
      const giftCard = await giftCardService.getGiftCard(
        tenantId,
        body.giftCardPayment.giftCardId
      );

      if (!giftCard) {
        return NextResponse.json(
          { success: false, error: "Gift card not found" },
          { status: 400 }
        );
      }

      if (giftCard.status !== "active") {
        return NextResponse.json(
          { success: false, error: `Gift card is ${giftCard.status}` },
          { status: 400 }
        );
      }

      if (giftCard.currentBalance < body.giftCardPayment.amount) {
        return NextResponse.json(
          { success: false, error: "Insufficient gift card balance" },
          { status: 400 }
        );
      }

      validatedGiftCard = {
        id: giftCard.id,
        balance: giftCard.currentBalance,
      };
    }

    // Create order with merchantId and payment breakdown
    const order = await orderService.createOrder(tenantId, {
      companyId: merchant.company.id,
      merchantId: merchant.id,
      loyaltyMemberId: body.loyaltyMemberId,
      customerFirstName: formValidation.data.customerFirstName,
      customerLastName: formValidation.data.customerLastName,
      customerPhone: formValidation.data.customerPhone,
      customerEmail: formValidation.data.customerEmail || undefined,
      orderMode: formValidation.data.orderMode,
      salesChannel: "online_order",
      items: body.items,
      notes: formValidation.data.notes || undefined,
      deliveryAddress: formValidation.data.deliveryAddress,
      tipAmount: formValidation.data.tipAmount,
      giftCardPayment: body.giftCardPayment?.amount,
    });

    // Process gift card redemption after order is created
    if (validatedGiftCard && body.giftCardPayment) {
      try {
        await giftCardService.redeemGiftCard(
          tenantId,
          validatedGiftCard.id,
          order.id,
          body.giftCardPayment.amount
        );
      } catch (error) {
        console.error("Failed to redeem gift card:", error);
        // Note: Order is already created. In production, consider rolling back or marking order for review.
      }
    }

    // Award loyalty points if member is logged in
    // Gift card payment portion earns DOUBLE points (2x)
    if (body.loyaltyMemberId) {
      try {
        const companyId = merchant.company.id;
        const isEnabled = await loyaltyConfigService.isLoyaltyEnabled(
          tenantId,
          companyId
        );

        if (isEnabled) {
          const pointsPerDollar = await loyaltyConfigService.getPointsPerDollar(
            tenantId,
            companyId
          );

          const giftCardPortion = Number(order.giftCardPayment) || 0;
          const cashPortion = Number(order.cashPayment) || 0;

          // Calculate points with double multiplier for gift card portion
          const giftCardPoints = Math.floor(giftCardPortion * pointsPerDollar * 2);
          const cashPoints = Math.floor(cashPortion * pointsPerDollar);
          const totalPoints = giftCardPoints + cashPoints;

          if (totalPoints > 0) {
            // Build description
            let description = `Earned from order #${order.orderNumber}`;
            if (giftCardPortion > 0 && cashPortion > 0) {
              description += ` (${giftCardPoints} pts from gift card at 2x, ${cashPoints} pts from cash)`;
            } else if (giftCardPortion > 0) {
              description += ` (2x bonus on gift card payment)`;
            }

            await pointsService.awardPointsWithCustomAmount(
              tenantId,
              body.loyaltyMemberId,
              {
                merchantId: merchant.id,
                orderId: order.id,
                points: totalPoints,
                description,
              }
            );
          }
        }
      } catch (error) {
        // Log but don't fail the order if points awarding fails
        console.error("Failed to award loyalty points:", error);
      }
    }

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
