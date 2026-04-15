import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { withApiHandler } from "@/lib/api";

const leadSchema = z.object({
  email: z.string().email("Invalid email format"),
  revenue: z.number().positive("Revenue must be positive"),
  aov: z.number().positive("AOV must be positive"),
  platform: z.enum(["doordash", "ubereats", "both"]),
  monthlyLoss: z.number().positive("Monthly loss must be positive"),
  source: z.enum(["calculator", "customer-loss"]).default("calculator"),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = leadSchema.safeParse(body);

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
    data: parsed.data,
  });

  return NextResponse.json({ success: true }, { status: 201 });
});
