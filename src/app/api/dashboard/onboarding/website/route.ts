import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { tenantService } from "@/services/tenant/tenant.service";
import { GooglePlacesClient } from "@/services/generator/google-places.client";
import { z } from "zod";

const requestSchema = z.object({
  placeId: z.string().min(1),
});

/** Only display reviews with this rating or higher on the website */
const MIN_DISPLAY_RATING = 4;

/**
 * POST: Update Tenant + Merchant from Google Places data during onboarding.
 * Fetches place details, updates existing entities, and marks website step complete.
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user?.tenantId) {
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

  // Update existing Tenant + Merchant with real data
  const { tenantSlug } = await tenantService.updateFromPlaceDetails(
    session.user.tenantId,
    {
      name: details.name,
      address: details.address,
      city: details.city,
      state: details.state,
      zipCode: details.zipCode,
      phone: details.phone ?? undefined,
      websiteUrl: details.websiteUrl ?? undefined,
      businessHours: details.businessHours,
      reviews: details.reviews
        .filter((r) => r.rating >= MIN_DISPLAY_RATING)
        .slice(0, 5)
        .map((r) => ({
          author: r.author,
          rating: r.rating,
          text: r.text,
        })),
      primaryType: details.primaryType,
      types: details.types,
    }
  );

  // Mark website step as completed
  await tenantService.updateOnboardingStep(
    session.user.tenantId,
    "website",
    "completed"
  );

  return NextResponse.json({
    success: true,
    data: { companySlug: tenantSlug },
  });
});
