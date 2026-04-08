import { NextRequest, NextResponse } from "next/server";
import { getGeneratorService } from "@/services/generator";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const { generationId } = await params;
    const service = getGeneratorService();
    const status = await service.getStatus(generationId);

    if (!status) {
      return NextResponse.json({ success: false, error: "Generation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: status }, { status: 200 });
  } catch (error) {
    console.error("[Generator] Status error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
