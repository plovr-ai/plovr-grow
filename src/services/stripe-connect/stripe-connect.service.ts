import { stripeService } from "@/services/stripe";
import { stripeConnectAccountRepository } from "@/repositories/stripe-connect-account.repository";
import db from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";
import type { ConnectAccountStatus, OAuthCallbackResult } from "./stripe-connect.types";

export class StripeConnectService {
  private get clientId(): string {
    const clientId = process.env.STRIPE_CLIENT_ID;
    if (!clientId) {
      throw new AppError(ErrorCodes.STRIPE_CONNECT_NOT_CONFIGURED, undefined, 500);
    }
    return clientId;
  }

  /**
   * Generate OAuth URL with base64url-encoded state containing tenantId
   */
  generateOAuthUrl(tenantId: string, redirectUri: string): string {
    const state = Buffer.from(JSON.stringify({ tenantId })).toString("base64url");
    return stripeService.generateConnectOAuthUrl(this.clientId, redirectUri, state);
  }

  /**
   * Parse the state param back to get tenantId
   */
  parseOAuthState(state: string): { tenantId: string } {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    return JSON.parse(decoded) as { tenantId: string };
  }

  /**
   * Handle OAuth callback: check no existing account, exchange code, create record, update tenant
   */
  async handleOAuthCallback(code: string, tenantId: string): Promise<OAuthCallbackResult> {
    // Check if tenant already has a connected account
    const existing = await stripeConnectAccountRepository.getByTenantId(tenantId);
    if (existing) {
      throw new AppError(ErrorCodes.STRIPE_CONNECT_ALREADY_CONNECTED, undefined, 400);
    }

    // Exchange code for access token
    let tokenResponse;
    try {
      tokenResponse = await stripeService.handleConnectOAuthCallback(code);
    } catch {
      throw new AppError(ErrorCodes.STRIPE_CONNECT_OAUTH_FAILED, undefined, 400);
    }

    const { stripe_user_id, access_token, refresh_token, scope } = tokenResponse;

    // Get account status from Stripe
    const accountInfo = await stripeService.getConnectAccountStatus(stripe_user_id);

    // Create account record in DB
    await stripeConnectAccountRepository.create(tenantId, {
      stripeAccountId: stripe_user_id,
      accessToken: access_token,
      refreshToken: refresh_token,
      scope,
    });

    // Update tenant stripeConnectStatus
    await db.tenant.update({
      where: { id: tenantId },
      data: { stripeConnectStatus: "connected" },
    });

    return {
      stripeAccountId: stripe_user_id,
      chargesEnabled: accountInfo.charges_enabled,
      payoutsEnabled: accountInfo.payouts_enabled,
      detailsSubmitted: accountInfo.details_submitted,
    };
  }

  /**
   * Get connect account for tenant (or null)
   */
  async getConnectAccount(tenantId: string) {
    return stripeConnectAccountRepository.getByTenantId(tenantId);
  }

  /**
   * Check if tenant has a ready (chargesEnabled) account
   */
  async isAccountReady(tenantId: string): Promise<boolean> {
    const account = await stripeConnectAccountRepository.getByTenantId(tenantId);
    if (!account) return false;
    return account.chargesEnabled === true;
  }

  /**
   * Disconnect: call Stripe, soft delete record, update tenant status
   */
  async disconnectAccount(tenantId: string): Promise<void> {
    const account = await stripeConnectAccountRepository.getByTenantId(tenantId);
    if (!account) {
      throw new AppError(ErrorCodes.STRIPE_CONNECT_ACCOUNT_NOT_FOUND, undefined, 404);
    }

    try {
      await stripeService.disconnectConnectAccount(account.stripeAccountId);
    } catch {
      throw new AppError(ErrorCodes.STRIPE_CONNECT_DISCONNECT_FAILED, undefined, 500);
    }

    await stripeConnectAccountRepository.softDelete(account.id);

    await db.tenant.update({
      where: { id: tenantId },
      data: { stripeConnectStatus: "disconnected" },
    });
  }

  /**
   * Update account status from webhook data
   */
  async handleAccountUpdated(stripeAccountId: string, status: ConnectAccountStatus): Promise<void> {
    const account = await stripeConnectAccountRepository.getByStripeAccountId(stripeAccountId);
    if (!account) {
      // Unknown account — ignore silently
      return;
    }

    await stripeConnectAccountRepository.updateAccountStatus(account.id, {
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
    });
  }
}

export const stripeConnectService = new StripeConnectService();
