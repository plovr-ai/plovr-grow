import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/payment";
import { merchantService } from "@/services/merchant";
import { z } from "zod";

const createPaymentIntentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
});

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

    // Get tenantId and companyId from merchant
    const tenantId = merchant.company.tenantId;
    const companyId = merchant.company.id;

    // Parse and validate request body
    const body = await request.json();
    const validation = createPaymentIntentSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          fieldErrors: errors,
        },
        { status: 400 }
      );
    }

    const { amount, currency } = validation.data;

    // Create PaymentIntent
    const result = await paymentService.createPaymentIntent({
      tenantId,
      companyId,
      merchantId: merchant.id,
      amount,
      currency,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntentId,
          stripeAccountId: result.stripeAccountId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PaymentIntent creation failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create payment intent";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
