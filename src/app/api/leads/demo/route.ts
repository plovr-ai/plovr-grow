import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

const demoLeadSchema = z.object({
  // Step 1 fields
  restaurantName: z.string().min(1, "Restaurant name is required"),
  placeId: z.string().optional(),
  address: z.string().optional(),
  locations: z.string().optional(),

  // Step 2 fields
  email: z.string().email("Invalid email format"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phone: z.string().min(1, "Phone number is required"),
  smsConsent: z.boolean().optional().default(false),

  // UTM tracking
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  lgref: z.string().optional(),
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
