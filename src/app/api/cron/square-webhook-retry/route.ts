import { NextRequest, NextResponse } from "next/server";
import { squareWebhookService } from "@/services/square/square-webhook.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Vercel cron invocations include an Authorization header with CRON_SECRET.
  // Fail closed: without a configured secret, refuse to run the retry worker
  // so a misconfigured preview/local deployment can't be spammed anonymously.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error(
      "[Square Webhook Retry Cron] CRON_SECRET is not configured; refusing to run."
    );
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await squareWebhookService.retryFailedEvents();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[Square Webhook Retry Cron] Failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
