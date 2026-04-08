import { NextResponse } from "next/server";
import { stripeService } from "@/services/stripe";
import { paymentService } from "@/services/payment";
import { stripeConnectService } from "@/services/stripe-connect";
import type { ConnectAccountStatus } from "@/services/stripe-connect/stripe-connect.types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: ReturnType<typeof stripeService.verifyConnectWebhookSignature>;
  try {
    event = stripeService.verifyConnectWebhookSignature(body, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as unknown as {
          id: string;
          status: string;
          charges?: {
            data: Array<{
              payment_method_details?: {
                type?: string;
                card?: { brand?: string; last4?: string };
              };
            }>;
          };
        };
        const cardDetails =
          paymentIntent.charges?.data[0]?.payment_method_details?.card;
        const paymentMethodType =
          paymentIntent.charges?.data[0]?.payment_method_details?.type;

        console.log(
          `[Stripe Connect Webhook] Payment intent succeeded: ${paymentIntent.id}`
        );
        await paymentService.handlePaymentSucceeded({
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status || "succeeded",
          paymentMethodType: paymentMethodType,
          cardBrand: cardDetails?.brand,
          cardLast4: cardDetails?.last4,
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log(
          `[Stripe Connect Webhook] Payment intent failed: ${paymentIntent.id}`
        );
        await paymentService.handlePaymentFailed({
          paymentIntentId: paymentIntent.id,
          failureCode: paymentIntent.last_payment_error?.code,
          failureMessage: paymentIntent.last_payment_error?.message,
        });
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        // For connect events, the account ID is on the event itself
        const stripeAccountId =
          (event as unknown as { account: string }).account ?? account.id;
        const status: ConnectAccountStatus = {
          chargesEnabled: account.charges_enabled ?? false,
          payoutsEnabled: account.payouts_enabled ?? false,
          detailsSubmitted: account.details_submitted ?? false,
        };
        console.log(
          `[Stripe Connect Webhook] Account updated: ${stripeAccountId}`
        );
        await stripeConnectService.handleAccountUpdated(
          stripeAccountId,
          status
        );
        break;
      }

      default:
        console.log(
          `[Stripe Connect Webhook] Unhandled event: ${event.type}`
        );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      `[Stripe Connect Webhook] Error handling ${event.type}:`,
      error
    );
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
