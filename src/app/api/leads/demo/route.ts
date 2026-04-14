import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

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

  // UTM tracking
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  lgref: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
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

    await prisma.lead.create({
      data: {
        ...parsed.data,
        source: "landing-page",
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[Leads/Demo] Create error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
