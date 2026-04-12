import { NextRequest, NextResponse } from "next/server";
import { squareOrderRetryService } from "@/services/square/square-order-retry.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

  try {
    const result = await squareOrderRetryService.retryFailedOrderPushes();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[Square Order Push Retry Cron] Failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
