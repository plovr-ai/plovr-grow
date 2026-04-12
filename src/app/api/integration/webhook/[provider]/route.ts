import { NextRequest, NextResponse } from "next/server";
import { webhookDispatcher } from "@/services/integration/webhook-dispatcher.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const rawBody = await request.text();

  // Build a plain headers object from the request
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const result = await webhookDispatcher.dispatch(provider, rawBody, headers);
  return NextResponse.json(result.body, { status: result.status });
}

export const runtime = "nodejs";
