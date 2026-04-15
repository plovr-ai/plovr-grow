import { NextRequest, NextResponse } from "next/server";
import { stripeService } from "@/services/stripe";
import { invoiceService } from "@/services/invoice";
import { subscriptionService } from "@/services/subscription";
import type {
  StripeSubscriptionData,
  StripeInvoiceData,
  StripeCheckoutSessionData,
} from "@/services/subscription/subscription.types";
import { withApiHandler } from "@/lib/api";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "stripe-webhook" });

export const POST = withApiHandler(async (request: NextRequest) => {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  // Verify webhook signature
  const event = stripeService.verifyWebhookSignature(payload, signature);
  if (!event) {
    log.error("Invalid webhook signature");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  log.info({ eventType: event.type }, "Received event");

  // Handle different event types
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as StripeCheckoutSessionData;

      // Handle subscription checkout
      if (session.mode === "subscription" && session.subscription) {
        log.info({ tenantId: session.metadata?.tenantId }, "Subscription checkout completed");
        await subscriptionService.handleCheckoutSessionCompleted(session);
      }

      // Handle invoice payment (catering)
      const invoiceNumber = (session as { metadata?: { invoiceNumber?: string } }).metadata?.invoiceNumber;
      if (invoiceNumber) {
        log.info({ invoiceNumber }, "Payment completed for invoice");
        await invoiceService.handlePaymentCompleted(invoiceNumber);
      }
      break;
    }

    // ==================== Subscription Events ====================

    case "customer.subscription.created": {
      const subscription = event.data.object as unknown as StripeSubscriptionData;
      log.info({ subscriptionId: subscription.id }, "Subscription created");
      await subscriptionService.handleSubscriptionCreated(subscription);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as StripeSubscriptionData;
      log.info({ subscriptionId: subscription.id, status: subscription.status }, "Subscription updated");
      await subscriptionService.handleSubscriptionUpdated(subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as StripeSubscriptionData;
      log.info({ subscriptionId: subscription.id }, "Subscription deleted");
      await subscriptionService.handleSubscriptionDeleted(subscription);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as unknown as StripeInvoiceData;

      // Handle subscription invoice payment
      if (invoice.subscription) {
        log.info({ invoiceId: invoice.id }, "Subscription invoice payment succeeded");
        await subscriptionService.handleInvoicePaymentSucceeded(invoice);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as StripeInvoiceData;

      // Handle subscription invoice payment failure
      if (invoice.subscription) {
        log.warn({ invoiceId: invoice.id }, "Subscription invoice payment failed");
        await subscriptionService.handleInvoicePaymentFailed(invoice);
      }
      break;
    }

    default:
      log.info({ eventType: event.type }, "Unhandled event type");
  }

  return NextResponse.json({ received: true });
});

// Disable body parsing for webhooks (Stripe needs the raw body)
export const runtime = "nodejs";
