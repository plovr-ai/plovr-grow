import type { DbClient } from "@/lib/db";
import {
  paymentRepository,
  type PaymentStatus,
} from "@/repositories/payment.repository";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";
import {
  StripeConnectStandardProvider,
  stripeConnectService,
} from "@/services/stripe-connect";
import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  PaymentSucceededData,
  PaymentFailedData,
  CreatePaymentRecordInput,
  VerifyPaymentResult,
} from "./payment.types";

export class PaymentService {
  private provider = new StripeConnectStandardProvider();

  /**
   * Create a PaymentIntent for checkout
   * This is called when user selects "Pay Now" and we need to create a Stripe PaymentIntent
   */
  async createPaymentIntent(
    request: CreatePaymentIntentRequest
  ): Promise<CreatePaymentIntentResponse> {
    // Get connect account for tenant
    const connectAccount = await stripeConnectService.getConnectAccount(
      request.tenantId
    );

    if (!connectAccount || !connectAccount.chargesEnabled) {
      throw new AppError(
        ErrorCodes.STRIPE_CONNECT_CHARGES_NOT_ENABLED,
        undefined,
        400
      );
    }

    const result = await this.provider.createPaymentIntent({
      amount: request.amount,
      currency: request.currency ?? "USD",
      stripeAccountId: connectAccount.stripeAccountId,
      metadata: {
        tenantId: request.tenantId,
        companyId: request.companyId,
        ...(request.merchantId && { merchantId: request.merchantId }),
        ...(request.orderId && { orderId: request.orderId }),
      },
    });

    return {
      paymentIntentId: result.paymentIntentId,
      clientSecret: result.clientSecret,
      stripeAccountId: result.stripeAccountId,
    };
  }

  /**
   * Create a payment record in database
   * This is called after order is created to link payment with order
   */
  async createPaymentRecord(input: CreatePaymentRecordInput, tx?: DbClient) {
    return paymentRepository.create(
      input.tenantId,
      {
        orderId: input.orderId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        stripeAccountId: input.stripeAccountId,
        stripeCustomerId: input.stripeCustomerId,
        amount: input.amount,
        currency: input.currency,
      },
      tx
    );
  }

  /**
   * Verify a PaymentIntent status
   * This is called before creating order to ensure payment is successful
   */
  async verifyPayment(
    paymentIntentId: string,
    expectedAmount: number,
    stripeAccountId: string
  ): Promise<VerifyPaymentResult> {
    const paymentIntent = await this.provider.retrievePaymentIntent(
      paymentIntentId,
      stripeAccountId
    );

    if (!paymentIntent) {
      return {
        success: false,
        paymentIntentId,
        status: "not_found",
        amount: 0,
        error: "Payment not found",
      };
    }

    // Check status
    if (paymentIntent.status !== "succeeded") {
      return {
        success: false,
        paymentIntentId,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        error: `Payment status is ${paymentIntent.status}, expected succeeded`,
      };
    }

    // Verify amount (convert expected to cents for comparison)
    const expectedCents = Math.round(expectedAmount * 100);
    if (paymentIntent.amount !== expectedCents) {
      return {
        success: false,
        paymentIntentId,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        error: `Payment amount mismatch: got ${paymentIntent.amount} cents, expected ${expectedCents} cents`,
      };
    }

    return {
      success: true,
      paymentIntentId,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      cardBrand: paymentIntent.cardBrand,
      cardLast4: paymentIntent.cardLast4,
    };
  }

  /**
   * Handle successful payment from Stripe webhook
   */
  async handlePaymentSucceeded(data: PaymentSucceededData): Promise<void> {
    // Get payment record
    const payment = await paymentRepository.getByPaymentIntentId(
      data.paymentIntentId
    );

    if (!payment) {
      console.warn(
        `Payment not found for PaymentIntent: ${data.paymentIntentId}`
      );
      return;
    }

    // Idempotency check - already processed
    if (payment.status === "succeeded") {
      console.log(
        `Payment already marked as succeeded: ${data.paymentIntentId}`
      );
      return;
    }

    // Update payment status
    await paymentRepository.updateStatus(payment.id, {
      status: "succeeded" as PaymentStatus,
      paymentMethod: data.paymentMethodType || null,
      cardBrand: data.cardBrand || null,
      cardLast4: data.cardLast4 || null,
      paidAt: new Date(),
    });

    console.log(`Payment succeeded: ${data.paymentIntentId}`);
  }

  /**
   * Handle failed payment from Stripe webhook
   */
  async handlePaymentFailed(data: PaymentFailedData): Promise<void> {
    // Get payment record
    const payment = await paymentRepository.getByPaymentIntentId(
      data.paymentIntentId
    );

    if (!payment) {
      console.warn(
        `Payment not found for PaymentIntent: ${data.paymentIntentId}`
      );
      return;
    }

    // Update payment status
    await paymentRepository.updateStatus(payment.id, {
      status: "failed" as PaymentStatus,
      failureCode: data.failureCode || null,
      failureMessage: data.failureMessage || null,
    });

    console.log(`Payment failed: ${data.paymentIntentId}`);
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(tenantId: string, orderId: string) {
    return paymentRepository.getByOrderId(tenantId, orderId);
  }

  /**
   * Get successful payment by order ID
   */
  async getSuccessfulPaymentByOrderId(tenantId: string, orderId: string) {
    return paymentRepository.getSuccessfulPaymentByOrderId(tenantId, orderId);
  }

  /**
   * Get payment by PaymentIntent ID
   */
  async getPaymentByIntentId(paymentIntentId: string) {
    return paymentRepository.getByPaymentIntentId(paymentIntentId);
  }
}

export const paymentService = new PaymentService();
