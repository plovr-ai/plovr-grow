import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cateringService } from "@/services/catering";
import { merchantService } from "@/services/merchant";

// Validation schema
const cateringFormSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long")
    .trim(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long")
    .trim(),
  phone: z
    .string()
    .regex(
      /^\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
      "Invalid phone number"
    ),
  email: z.string().min(1, "Email is required").email("Invalid email"),
  notes: z.string().max(1000, "Notes are too long").optional().or(z.literal("")),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    // Validate input
    const validation = cateringFormSchema.safeParse(body);
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

    const { firstName, lastName, phone, email, notes } = validation.data;

    // Get merchant by slug
    const merchant = await merchantService.getMerchantBySlug(slug);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const tenantId = merchant.company.tenantId;

    // Create catering lead
    const lead = await cateringService.createLead(tenantId, merchant.id, {
      firstName,
      lastName,
      phone,
      email,
      notes: notes || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: { leadId: lead.id },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Catering lead creation failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to submit catering inquiry";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
