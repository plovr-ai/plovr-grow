import { NextRequest } from "next/server";
import { orderEventEmitter } from "@/services/order";
import { merchantService } from "@/services/merchant";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  const { slug, orderId } = await params;

  // Validate merchant
  const merchant = await merchantService.getMerchantBySlug(slug);
  if (!merchant) {
    return new Response("Restaurant not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      // Subscribe to all order events
      const unsubscribe = orderEventEmitter.onAny((event) => {
        // Filter for this specific order and merchant
        if (event.orderId === orderId && event.merchantId === merchant.id) {
          const data = {
            type: "status_changed",
            status: event.status,
            previousStatus: event.previousStatus,
            timestamp: event.timestamp,
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        }
      });

      // Handle connection close
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
