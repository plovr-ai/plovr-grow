import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { squareWebhookService } from "@/services/square/square-webhook.service";
import { withApiHandler } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (request: NextRequest) => {
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

  const result = await Sentry.withMonitor(
    "square-webhook-retry",
    async () => squareWebhookService.retryFailedEvents(),
    {
      schedule: { type: "crontab", value: "*/5 * * * *" },
      checkinMargin: 2,
      maxRuntime: 10,
      timezone: "America/New_York",
    }
  );
  return NextResponse.json({ ok: true, ...result });
});
