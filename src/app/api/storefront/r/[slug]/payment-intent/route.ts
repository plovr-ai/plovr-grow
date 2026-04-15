import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { paymentService } from "@/services/payment";
import { merchantService } from "@/services/merchant";
import { z } from "zod";

const createPaymentIntentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
});

export const POST = withApiHandler(async (request: NextRequest, context) => {
  const { slug } = await context.params;

  // Get merchant by slug
  const merchant = await merchantService.getMerchantBySlug(slug);
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: "Restaurant not found" },
      { status: 404 }
    );
  }

  // Get tenantId from merchant
  const tenantId = merchant.tenant.tenantId;

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
});
