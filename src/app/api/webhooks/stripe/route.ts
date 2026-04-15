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

export const POST = withApiHandler(async (request: NextRequest) => {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  // Verify webhook signature
  const event = stripeService.verifyWebhookSignature(payload, signature);
  if (!event) {
    console.error("[Stripe Webhook] Invalid signature");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  // Handle different event types
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as StripeCheckoutSessionData;

      // Handle subscription checkout
      if (session.mode === "subscription" && session.subscription) {
        console.log(`[Stripe Webhook] Subscription checkout completed for tenant: ${session.metadata?.tenantId}`);
        await subscriptionService.handleCheckoutSessionCompleted(session);
      }

      // Handle invoice payment (catering)
      const invoiceNumber = (session as { metadata?: { invoiceNumber?: string } }).metadata?.invoiceNumber;
      if (invoiceNumber) {
        console.log(`[Stripe Webhook] Payment completed for invoice: ${invoiceNumber}`);
        await invoiceService.handlePaymentCompleted(invoiceNumber);
      }
      break;
    }

    // ==================== Subscription Events ====================

    case "customer.subscription.created": {
      const subscription = event.data.object as unknown as StripeSubscriptionData;
      console.log(`[Stripe Webhook] Subscription created: ${subscription.id}`);
      await subscriptionService.handleSubscriptionCreated(subscription);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as StripeSubscriptionData;
      console.log(`[Stripe Webhook] Subscription updated: ${subscription.id}, status: ${subscription.status}`);
      await subscriptionService.handleSubscriptionUpdated(subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as StripeSubscriptionData;
      console.log(`[Stripe Webhook] Subscription deleted: ${subscription.id}`);
      await subscriptionService.handleSubscriptionDeleted(subscription);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as unknown as StripeInvoiceData;

      // Handle subscription invoice payment
      if (invoice.subscription) {
        console.log(`[Stripe Webhook] Subscription invoice payment succeeded: ${invoice.id}`);
        await subscriptionService.handleInvoicePaymentSucceeded(invoice);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as StripeInvoiceData;

      // Handle subscription invoice payment failure
      if (invoice.subscription) {
        console.log(`[Stripe Webhook] Subscription invoice payment failed: ${invoice.id}`);
        await subscriptionService.handleInvoicePaymentFailed(invoice);
      }
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
});

// Disable body parsing for webhooks (Stripe needs the raw body)
export const runtime = "nodejs";
