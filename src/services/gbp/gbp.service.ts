import { gbpConfig } from "./gbp.config";
import { gbpOAuthService } from "./gbp-oauth.service";
import { gbpLocationService } from "./gbp-location.service";
import { integrationRepository } from "@/repositories/integration.repository";
import { AppError, ErrorCodes } from "@/lib/errors";
import type {
  GbpAccount,
  GbpLocation,
  GbpConnectionStatus,
  GbpLocationMerchantData,
} from "./gbp.types";

const INTEGRATION_TYPE = "LISTING_GBP";
const INTEGRATION_CATEGORY = "LISTING";

function getAuthorizationUrl(
  tenantId: string,
  merchantId: string,
  returnUrl: string
): string {
  gbpConfig.assertConfigured();
  return gbpOAuthService.buildAuthorizationUrl(
    tenantId,
    merchantId,
    returnUrl
  );
}

async function handleOAuthCallback(
  code: string,
  state: string
): Promise<{ returnUrl: string; accounts: GbpAccount[] }> {
  const { tenantId, merchantId, returnUrl } =
    gbpOAuthService.verifyAndParseState(state);

  const tokens = await gbpOAuthService.exchangeCode(code);

  // Try to fetch accounts, but don't block token storage if it fails
  // (GBP API requires separate quota approval from Google)
  let accounts: GbpAccount[] = [];
  try {
    accounts = await gbpLocationService.listAccounts(tokens.accessToken);
  } catch (error) {
    console.warn("[GBP] listAccounts failed, storing connection without account info:", error);
  }

  // Store connection (upsert — idempotent for re-auth)
  await integrationRepository.upsertConnection(tenantId, merchantId, {
    type: INTEGRATION_TYPE,
    category: INTEGRATION_CATEGORY,
    externalAccountId: accounts[0]?.name,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: tokens.expiresAt,
    scopes: "https://www.googleapis.com/auth/business.manage",
  });

  return { returnUrl, accounts };
}

async function getConnectionStatus(
  tenantId: string,
  merchantId: string
): Promise<GbpConnectionStatus> {
  const connection = await integrationRepository.getConnection(
    tenantId,
    merchantId,
    INTEGRATION_TYPE
  );

  if (!connection) {
    return { connected: false };
  }

  return {
    connected: true,
    externalAccountId: connection.externalAccountId ?? undefined,
    externalLocationId: connection.externalLocationId ?? undefined,
    tokenExpiresAt: connection.tokenExpiresAt ?? undefined,
  };
}

async function disconnect(tenantId: string, merchantId: string): Promise<void> {
  const connection = await integrationRepository.getConnection(
    tenantId,
    merchantId,
    INTEGRATION_TYPE
  );
  if (!connection) {
    throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
  }
  await integrationRepository.softDeleteConnection(connection.id);
}

async function listLocations(
  tenantId: string,
  merchantId: string
): Promise<GbpLocation[]> {
  const connection = await integrationRepository.getConnection(
    tenantId,
    merchantId,
    INTEGRATION_TYPE
  );
  if (!connection) {
    throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
  }

  const accessToken = await ensureValidToken(connection);

  if (!connection.externalAccountId) {
    throw new AppError(
      ErrorCodes.GBP_ACCOUNT_FETCH_FAILED,
      undefined,
      500
    );
  }

  return gbpLocationService.listLocations(
    accessToken,
    connection.externalAccountId
  );
}

async function syncLocation(
  tenantId: string,
  merchantId: string,
  locationName: string
): Promise<{ merchantData: GbpLocationMerchantData }> {
  const connection = await integrationRepository.getConnection(
    tenantId,
    merchantId,
    INTEGRATION_TYPE
  );
  if (!connection) {
    throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
  }

  const accessToken = await ensureValidToken(connection);

  // Create sync record
  const syncRecord = await integrationRepository.createSyncRecord(
    tenantId,
    connection.id,
    "LOCATION_SYNC"
  );

  try {
    const location = await gbpLocationService.getLocation(
      accessToken,
      locationName
    );

    const merchantData =
      gbpLocationService.mapLocationToMerchantData(location);

    // Update connection with the selected location
    await integrationRepository.upsertConnection(tenantId, merchantId, {
      type: INTEGRATION_TYPE,
      category: INTEGRATION_CATEGORY,
      externalAccountId: connection.externalAccountId ?? undefined,
      externalLocationId: locationName,
      accessToken: connection.accessToken ?? undefined,
      refreshToken: connection.refreshToken ?? undefined,
      tokenExpiresAt: connection.tokenExpiresAt ?? undefined,
      scopes: connection.scopes ?? undefined,
    });

    await integrationRepository.updateSyncRecord(syncRecord.id, {
      status: "success",
      objectsSynced: 1,
      objectsMapped: 1,
    });

    return { merchantData };
  } catch (error) {
    await integrationRepository.updateSyncRecord(syncRecord.id, {
      status: "failed",
      errorMessage:
        error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorCodes.GBP_SYNC_FAILED, undefined, 500);
  }
}

async function ensureValidToken(connection: {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  if (!connection.accessToken) {
    throw new AppError(ErrorCodes.INTEGRATION_TOKEN_EXPIRED, undefined, 401);
  }

  // Check if token expires within 5 minutes
  const bufferMs = 5 * 60 * 1000;
  if (
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() < Date.now() + bufferMs
  ) {
    if (!connection.refreshToken) {
      throw new AppError(
        ErrorCodes.INTEGRATION_TOKEN_EXPIRED,
        undefined,
        401
      );
    }

    const newTokens = await gbpOAuthService.refreshToken(
      connection.refreshToken
    );
    await integrationRepository.updateTokens(connection.id, {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      tokenExpiresAt: newTokens.expiresAt,
    });
    return newTokens.accessToken;
  }

  return connection.accessToken;
}

export const gbpService = {
  getAuthorizationUrl,
  handleOAuthCallback,
  getConnectionStatus,
  disconnect,
  listLocations,
  syncLocation,
};
