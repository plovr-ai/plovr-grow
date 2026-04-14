import { NextRequest, NextResponse } from "next/server";
import { validateExternalRequest } from "@/lib/external-auth";

export async function GET(request: NextRequest) {
  const caller = await validateExternalRequest(request);

  if (!caller.authenticated) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
}
