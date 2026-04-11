import { NextRequest, NextResponse } from "next/server";
import { squareWebhookService } from "@/services/square/square-webhook.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Vercel cron invocations include an Authorization header with CRON_SECRET.
  // Reject anything unauthenticated so manual callers can't spam the retry job.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
