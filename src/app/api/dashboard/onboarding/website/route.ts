import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { companyService } from "@/services/company/company.service";
import { GooglePlacesClient } from "@/services/generator/google-places.client";
import { z } from "zod";

const requestSchema = z.object({
  placeId: z.string().min(1),
});

/**
 * POST: Update Company + Merchant from Google Places data during onboarding.
 * Fetches place details, updates existing entities, and marks website step complete.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId || !session?.user?.companyId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { placeId } = validation.data;

    // Fetch Google Places data
    const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
    const placesClient = new GooglePlacesClient(apiKey);
    const details = await placesClient.getPlaceDetails(placeId);

    // Update existing Company + Merchant with real data
    const { companySlug } = await companyService.updateFromPlaceDetails(
      session.user.tenantId,
      session.user.companyId,
      {
        name: details.name,
        address: details.address,
        city: details.city,
        state: details.state,
        zipCode: details.zipCode,
        phone: details.phone ?? undefined,
        websiteUrl: details.websiteUrl ?? undefined,
        businessHours: details.businessHours,
        reviews: details.reviews.slice(0, 5).map((r) => ({
          author: r.author,
          rating: r.rating,
          text: r.text,
        })),
      }
    );

    // Mark website step as completed
    await companyService.updateOnboardingStep(
      session.user.tenantId,
      session.user.companyId,
      "website",
      "completed"
    );

    return NextResponse.json({
      success: true,
      data: { companySlug },
    });
  } catch (error) {
    console.error("[Onboarding Website] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to set up website" },
      { status: 500 }
    );
  }
}
