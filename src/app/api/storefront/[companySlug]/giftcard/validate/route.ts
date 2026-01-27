import { NextRequest, NextResponse } from "next/server";
import { merchantService } from "@/services/merchant";
import { giftCardService } from "@/services/giftcard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;

    // Get card number from query params
    const cardNumber = request.nextUrl.searchParams.get("cardNumber");

    if (!cardNumber) {
      return NextResponse.json(
        { success: false, error: "Card number is required" },
        { status: 400 }
      );
    }

    // Get company by slug
    const company = await merchantService.getCompanyBySlug(companySlug);
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    // Validate the gift card
    const result = await giftCardService.validateGiftCard(
      company.tenantId,
      company.id,
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
  } catch (error) {
    console.error("Gift card validation failed:", error);

    const message =
      error instanceof Error ? error.message : "Failed to validate gift card";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
