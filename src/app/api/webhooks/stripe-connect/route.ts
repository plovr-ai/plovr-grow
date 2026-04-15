import { NextRequest, NextResponse } from "next/server";
import { stripeService } from "@/services/stripe";
import { paymentService } from "@/services/payment";
import { orderService } from "@/services/order";
import { stripeConnectService } from "@/services/stripe-connect";
import type { ConnectAccountStatus } from "@/services/stripe-connect/stripe-connect.types";
import { withApiHandler } from "@/lib/api";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "stripe-connect-webhook" });

export const runtime = "nodejs";

export const POST = withApiHandler(async (request: NextRequest) => {
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

      log.info({ paymentIntentId: paymentIntent.id }, "Payment intent succeeded");
      await paymentService.handlePaymentSucceeded({
        provider: "stripe",
        providerPaymentId: paymentIntent.id,
        status: paymentIntent.status || "succeeded",
        paymentMethodType: paymentMethodType,
        cardBrand: cardDetails?.brand,
        cardLast4: cardDetails?.last4,
      });

      // Update order status to completed only if payment actually reached succeeded
      // (CAS in handlePaymentSucceeded may have been a no-op if payment was already failed/processed)
      const succeededPayment = await paymentService.getPaymentByProviderPaymentId("stripe", paymentIntent.id);
      if (succeededPayment?.order && succeededPayment.status === "succeeded") {
        await orderService.updatePaymentStatus(
          succeededPayment.order.tenantId,
          succeededPayment.order.id,
          "completed",
          { source: "internal" }
        );
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      log.warn({ paymentIntentId: paymentIntent.id }, "Payment intent failed");
      await paymentService.handlePaymentFailed({
        provider: "stripe",
        providerPaymentId: paymentIntent.id,
        failureCode: paymentIntent.last_payment_error?.code,
        failureMessage: paymentIntent.last_payment_error?.message,
      });

      // Update order status to payment_failed only if payment actually reached failed
      const failedPayment = await paymentService.getPaymentByProviderPaymentId("stripe", paymentIntent.id);
      if (failedPayment?.order && failedPayment.status === "failed") {
        await orderService.updatePaymentStatus(
          failedPayment.order.tenantId,
          failedPayment.order.id,
          "payment_failed",
          { source: "internal" }
        );
      }
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
      log.info({ stripeAccountId }, "Account updated");
      await stripeConnectService.handleAccountUpdated(
        stripeAccountId,
        status
      );
      break;
    }

    default:
      log.info({ eventType: event.type }, "Unhandled event type");
  }

  return NextResponse.json({ received: true });
});
