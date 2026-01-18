import { NextResponse } from "next/server";
import { authService } from "@/services/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ valid: false });
  }

  const result = await authService.validateResetToken(token);
  return NextResponse.json(result);
}
