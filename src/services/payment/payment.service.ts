import { stripeService } from "@/services/stripe";
import type { DbClient } from "@/lib/db";
import {
  paymentRepository,
  type PaymentStatus,
} from "@/repositories/payment.repository";
import {
  stripeCustomerRepository,
  type CreateStripeCustomerInput,
} from "@/repositories/stripe-customer.repository";
import { loyaltyMemberRepository } from "@/repositories/loyalty-member.repository";
import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  PaymentSucceededData,
  PaymentFailedData,
  CreatePaymentRecordInput,
  VerifyPaymentResult,
} from "./payment.types";

export class PaymentService {
  /**
   * Create a PaymentIntent for checkout
   * This is called when user selects "Pay Now" and we need to create a Stripe PaymentIntent
   */
  async createPaymentIntent(
    request: CreatePaymentIntentRequest
  ): Promise<CreatePaymentIntentResponse> {
    let stripeCustomerId: string | undefined;

    // If loyalty member provided, get or create Stripe customer
    if (request.loyaltyMemberId) {
      stripeCustomerId = await this.getOrCreateStripeCustomer(
        request.tenantId,
        request.companyId,
        request.loyaltyMemberId
      );
    }

    // Create PaymentIntent with Stripe
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: request.amount,
      currency: request.currency,
      customerId: stripeCustomerId,
      saveCard: request.saveCard,
      metadata: {
        tenantId: request.tenantId,
        companyId: request.companyId,
        ...(request.merchantId && { merchantId: request.merchantId }),
        ...(request.orderId && { orderId: request.orderId }),
        ...(request.loyaltyMemberId && {
          loyaltyMemberId: request.loyaltyMemberId,
        }),
      },
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
      stripeCustomerId,
    };
  }

  /**
   * Create a payment record in database
   * This is called after order is created to link payment with order
   */
  async createPaymentRecord(input: CreatePaymentRecordInput, tx?: DbClient) {
    return paymentRepository.create(input.tenantId, {
      orderId: input.orderId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeCustomerId: input.stripeCustomerId,
      amount: input.amount,
      currency: input.currency,
    }, tx);
  }

  /**
   * Verify a PaymentIntent status
   * This is called before creating order to ensure payment is successful
   */
  async verifyPayment(
    paymentIntentId: string,
    expectedAmount: number
  ): Promise<VerifyPaymentResult> {
    const paymentIntent =
      await stripeService.retrievePaymentIntent(paymentIntentId);

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

  // ==================== Stripe Customer Methods ====================

  /**
   * Get or create a Stripe customer for a loyalty member
   */
  private async getOrCreateStripeCustomer(
    tenantId: string,
    companyId: string,
    loyaltyMemberId: string
  ): Promise<string> {
    // Check if we already have a Stripe customer mapping
    const existingMapping =
      await stripeCustomerRepository.getByLoyaltyMemberId(loyaltyMemberId);
    if (existingMapping) {
      return existingMapping.stripeCustomerId;
    }

    // Get loyalty member details
    const member = await loyaltyMemberRepository.getById(
      tenantId,
      loyaltyMemberId
    );
    if (!member) {
      throw new Error(`Loyalty member not found: ${loyaltyMemberId}`);
    }

    // Create Stripe customer
    const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
    const stripeCustomerId = await stripeService.createCustomer({
      email: member.email || `${member.phone}@placeholder.local`,
      name: name || member.phone,
      metadata: {
        tenantId,
        companyId,
        loyaltyMemberId,
        phone: member.phone,
      },
    });

    // Save mapping
    await stripeCustomerRepository.create(tenantId, {
      companyId,
      loyaltyMemberId,
      stripeCustomerId,
    });

    return stripeCustomerId;
  }

  /**
   * Get saved payment methods for a loyalty member
   */
  async getSavedPaymentMethods(loyaltyMemberId: string) {
    const stripeCustomer =
      await stripeCustomerRepository.getByLoyaltyMemberId(loyaltyMemberId);
    if (!stripeCustomer) {
      return [];
    }

    return stripeService.listPaymentMethods(stripeCustomer.stripeCustomerId);
  }

  /**
   * Delete a saved payment method
   */
  async deleteSavedPaymentMethod(
    loyaltyMemberId: string,
    paymentMethodId: string
  ): Promise<boolean> {
    const stripeCustomer =
      await stripeCustomerRepository.getByLoyaltyMemberId(loyaltyMemberId);
    if (!stripeCustomer) {
      return false;
    }

    // Verify the payment method belongs to this customer
    const methods = await stripeService.listPaymentMethods(
      stripeCustomer.stripeCustomerId
    );
    const method = methods.find((m) => m.id === paymentMethodId);
    if (!method) {
      return false;
    }

    await stripeService.detachPaymentMethod(paymentMethodId);
    return true;
  }
}

export const paymentService = new PaymentService();
