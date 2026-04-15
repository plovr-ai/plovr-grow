import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGeneratorService } from "@/services/generator";
import { withApiHandler } from "@/lib/api";

const createSchema = z.object({
  placeId: z.string().min(1, "placeId is required"),
  placeName: z.string().min(1, "placeName is required"),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const service = getGeneratorService();
  const result = await service.create(parsed.data);

  if (result.existingSlug) {
    return NextResponse.json({ success: true, data: { existingSlug: result.existingSlug } }, { status: 200 });
  }

  if (result.generationId) {
    service.generate(result.generationId).catch((err) => {
      console.error(`[Generator] Background generation failed for ${result.generationId}:`, err);
    });
  }

  return NextResponse.json({ success: true, data: { generationId: result.generationId } }, { status: 201 });
});
