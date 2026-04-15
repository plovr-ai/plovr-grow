import { NextRequest, NextResponse } from "next/server";
import { squareOrderRetryService } from "@/services/square/square-order-retry.service";
import { withApiHandler } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (request: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error(
      "[Square Order Push Retry Cron] CRON_SECRET is not configured; refusing to run."
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

  const result = await squareOrderRetryService.retryFailedOrderPushes();
  return NextResponse.json({ ok: true, ...result });
});
