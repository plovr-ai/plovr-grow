import { NextRequest, NextResponse } from "next/server";
import { stripeService } from "@/services/stripe";
import { invoiceService } from "@/services/invoice";
import { paymentService } from "@/services/payment";
import { subscriptionService } from "@/services/subscription";
import type {
  StripeSubscriptionData,
  StripeInvoiceData,
  StripeCheckoutSessionData,
} from "@/services/subscription/subscription.types";

export async function POST(request: NextRequest) {
  try {
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

      // ==================== Payment Intent Events ====================

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const invoiceNumber = paymentIntent.metadata?.invoiceNumber;

        // Handle invoice payment (catering)
        if (invoiceNumber) {
          console.log(`[Stripe Webhook] Payment intent succeeded for invoice: ${invoiceNumber}`);
          await invoiceService.handlePaymentCompleted(invoiceNumber);
        }

        // Handle order payment (checkout)
        // Note: Payment record should already exist from order creation
        // This is a backup to ensure status is updated
        if (!invoiceNumber) {
          console.log(`[Stripe Webhook] Payment intent succeeded: ${paymentIntent.id}`);
          const cardDetails = paymentIntent.charges?.data[0]?.payment_method_details?.card;
          const paymentMethodType = paymentIntent.charges?.data[0]?.payment_method_details?.type;

          await paymentService.handlePaymentSucceeded({
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status || "succeeded",
            paymentMethodType: paymentMethodType,
            cardBrand: cardDetails?.brand,
            cardLast4: cardDetails?.last4,
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log(`[Stripe Webhook] Payment intent failed: ${paymentIntent.id}`);

        await paymentService.handlePaymentFailed({
          paymentIntentId: paymentIntent.id,
          failureCode: paymentIntent.last_payment_error?.code,
          failureMessage: paymentIntent.last_payment_error?.message,
        });
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// Disable body parsing for webhooks (Stripe needs the raw body)
export const runtime = "nodejs";
