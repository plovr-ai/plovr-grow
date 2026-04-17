import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { leadsService } from "@/services/leads/leads.service";
import { withApiHandler } from "@/lib/api";

const demoLeadSchema = z.object({
  // Step 1 fields
  restaurantName: z.string().min(1, "Restaurant name is required").max(200),
  placeId: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  locations: z.string().max(10).optional(),
  posSystem: z.string().max(50).optional(),

  // Step 2 fields
  email: z.string().email("Invalid email format").max(200),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().min(1, "Phone number is required").max(20),
  smsConsent: z.boolean().optional().default(false),

  // Landing page path
  landingPage: z.string().max(200).optional(),

  // UTM tracking
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  lgref: z.string().max(200).optional(),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = demoLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  await leadsService.createDemoLead(parsed.data);

  return NextResponse.json({ success: true }, { status: 201 });
});
