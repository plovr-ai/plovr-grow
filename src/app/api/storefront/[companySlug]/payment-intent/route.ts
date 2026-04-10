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
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;

    // Get company by slug
    const company = await merchantService.getTenantBySlug(companySlug);
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

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

    // Create PaymentIntent at company level (no merchantId)
    const result = await paymentService.createPaymentIntent({
      tenantId: company.tenantId,
      merchantId: undefined,
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
