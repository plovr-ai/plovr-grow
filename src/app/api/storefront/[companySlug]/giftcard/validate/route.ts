import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { merchantService } from "@/services/merchant";
import { giftCardService } from "@/services/giftcard";

export const GET = withApiHandler(async (request: NextRequest, context) => {
  const { companySlug } = await context.params;

  // Get card number from query params
  const cardNumber = request.nextUrl.searchParams.get("cardNumber");

  if (!cardNumber) {
    return NextResponse.json(
      { success: false, error: "Card number is required" },
      { status: 400 }
    );
  }

  // Get company by slug
  const company = await merchantService.getTenantBySlug(companySlug);
  if (!company) {
    return NextResponse.json(
      { success: false, error: "Company not found" },
      { status: 404 }
    );
  }

  // Validate the gift card
  const result = await giftCardService.validateGiftCard(
    company.tenantId,
    cardNumber
  );

  if (!result.valid) {
    const errorMessages: Record<string, string> = {
      not_found: "Gift card not found",
      depleted: "Gift card has no remaining balance",
      disabled: "Gift card has been disabled",
      invalid_format: "Invalid gift card number format",
    };

    return NextResponse.json(
      {
        success: false,
        error: errorMessages[result.error || "not_found"],
        errorCode: result.error,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      valid: true,
      giftCardId: result.giftCard!.id,
      balance: result.giftCard!.currentBalance,
      cardNumber: result.giftCard!.cardNumber,
    },
  });
});
