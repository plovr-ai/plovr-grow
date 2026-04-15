import { NextRequest, NextResponse } from "next/server";
import { getGeneratorService } from "@/services/generator";
import { withApiHandler } from "@/lib/api";

export const GET = withApiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) => {
  const { generationId } = await params;
  const service = getGeneratorService();
  const status = await service.getStatus(generationId);

  if (!status) {
    return NextResponse.json({ success: false, error: "Generation not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: status }, { status: 200 });
});
