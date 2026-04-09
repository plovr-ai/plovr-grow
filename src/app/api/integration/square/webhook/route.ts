import { NextRequest, NextResponse } from "next/server";
import { squareWebhookService } from "@/services/square/square-webhook.service";
import { squareConfig } from "@/services/square/square.config";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";

  if (!squareConfig.enabled || !squareWebhookService.verifySignature(rawBody, signature)) {
    console.error("[Square Webhook] Signature verification failed", {
      ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown",
      hasSignature: !!signature,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    await squareWebhookService.handleWebhook(rawBody);
  } catch (error) {
    console.error("[Square Webhook] Unhandled error:", error);
  }

  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
