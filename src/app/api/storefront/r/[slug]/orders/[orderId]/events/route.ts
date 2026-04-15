import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { orderEventEmitter } from "@/services/order";
import { merchantService } from "@/services/merchant";
import type {
  PaymentStatusChangedEvent,
  FulfillmentStatusChangedEvent,
} from "@/services/order/order-events.types";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (request: NextRequest, context) => {
  const { slug, orderId } = await context.params;

  // Validate merchant
  const merchant = await merchantService.getMerchantBySlug(slug);
  if (!merchant) {
    return new NextResponse("Restaurant not found", { status: 404 });
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
          // Check if this is a payment status change event
          if ("status" in event) {
            const paymentEvent = event as PaymentStatusChangedEvent;
            const data = {
              type: "payment_status_changed",
              status: paymentEvent.status,
              previousStatus: paymentEvent.previousStatus,
              timestamp: paymentEvent.timestamp,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          }

          // Check if this is a fulfillment status change event
          if ("fulfillmentStatus" in event) {
            const fulfillmentEvent = event as FulfillmentStatusChangedEvent;
            const data = {
              type: "fulfillment_status_changed",
              fulfillmentStatus: fulfillmentEvent.fulfillmentStatus,
              previousFulfillmentStatus: fulfillmentEvent.previousFulfillmentStatus,
              timestamp: fulfillmentEvent.timestamp,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          }
        }
      });

      // Handle connection close
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
