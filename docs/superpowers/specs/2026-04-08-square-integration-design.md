# Square POS Integration Migration Design

**Issue**: #3 — Migration integration from allinone
**Scope**: Phase 1 — Core Framework + Square OAuth + Catalog Sync
**Date**: 2026-04-08

## Overview

Migrate SquarePOS integration from the Java allinone service (`plovr-allinone`) to the TypeScript project (`plovr-grow`). This phase covers:

1. **Core integration framework** — generic models and service for managing third-party connections
2. **Square OAuth** — merchant authorization flow to connect Square accounts
3. **Square Catalog Sync** — pull Square catalog and map to internal Menu models

Future phases (separate issues): Square Order push, Square Webhooks, GBP integration.

## Approach

**Pragmatic middle ground** — reusable integration infrastructure that follows existing project patterns (singleton services, provider interfaces like SMS/Payment), using the official Square SDK for API calls. No over-engineered Gateway/Factory abstractions from the Java project.

## Data Models

### IntegrationConnection

Unified model combining Java's IntegrationBinding + ThirdPartyCredential. Stores connection status and OAuth tokens together.

```prisma
model IntegrationConnection {
  id                  String    @id
  tenantId            String    @map("tenant_id")
  merchantId          String    @map("merchant_id")
  type                String    // "POS_SQUARE", "LISTING_GBP"
  category            String    // "POS", "LISTING"
  status              String    @default("active")
  externalAccountId   String?   @map("external_account_id")
  externalLocationId  String?   @map("external_location_id")
  accessToken         String?   @map("access_token")
  refreshToken        String?   @map("refresh_token")
  tokenExpiresAt      DateTime? @map("token_expires_at")
  scopes              String?
  deleted             Boolean   @default(false)
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  tenant              Tenant    @relation(fields: [tenantId], references: [id])
  merchant            Merchant  @relation(fields: [merchantId], references: [id])
  syncRecords         IntegrationSyncRecord[]

  @@unique([tenantId, merchantId, type])
  @@map("integration_connections")
}
```

### ExternalIdMapping

Maps Square object IDs to internal model IDs for reconciliation during sync.

```prisma
model ExternalIdMapping {
  id              String   @id
  tenantId        String   @map("tenant_id")
  internalType    String   @map("internal_type")   // "MenuItem", "MenuCategory", "TaxConfig"
  internalId      String   @map("internal_id")
  externalSource  String   @map("external_source") // "SQUARE"
  externalType    String   @map("external_type")   // "ITEM", "CATEGORY", "TAX"
  externalId      String   @map("external_id")
  deleted         Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, externalSource, externalId])
  @@map("external_id_mappings")
}
```

### IntegrationSyncRecord

Tracks sync history for auditing and debugging.

```prisma
model IntegrationSyncRecord {
  id              String    @id
  tenantId        String    @map("tenant_id")
  connectionId    String    @map("connection_id")
  syncType        String    @map("sync_type")  // "CATALOG_FULL", "CATALOG_DELTA"
  status          String    // "running", "success", "failed"
  objectsSynced   Int       @default(0) @map("objects_synced")
  objectsMapped   Int       @default(0) @map("objects_mapped")
  cursor          String?
  errorMessage    String?   @map("error_message") @db.Text
  startedAt       DateTime  @map("started_at")
  finishedAt      DateTime? @map("finished_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  connection      IntegrationConnection @relation(fields: [connectionId], references: [id])

  @@map("integration_sync_records")
}
```

## Service Layer Architecture

### Directory Structure

```
src/services/
├── integration/                    # Generic integration framework
│   ├── index.ts
│   ├── integration.service.ts      # IntegrationService class
│   ├── integration.types.ts
│   └── integration.repository.ts
│
├── square/                         # Square POS integration
│   ├── index.ts
│   ├── square.service.ts           # SquareService (aggregate entry point)
│   ├── square.types.ts
│   ├── square-oauth.service.ts     # OAuth flow
│   ├── square-catalog.service.ts   # Catalog fetch + mapping
│   └── square.config.ts            # Environment config
```

### Service Responsibilities

**IntegrationService** — generic CRUD for integration infrastructure:
- `getConnection(tenantId, merchantId, type)` — query connection by merchant + type
- `createConnection(tenantId, merchantId, data)` — create new connection
- `updateTokens(connectionId, tokens)` — update OAuth tokens
- `recordSync(connectionId, syncType, status)` — create/update sync record
- `getIdMapping(tenantId, externalSource, externalId)` — lookup ID mapping
- `upsertIdMapping(tenantId, mapping)` — create or update mapping

**SquareService** — aggregate entry point for Square operations:
- `getAuthorizationUrl(tenantId, merchantId, returnUrl)` — build OAuth URL
- `handleOAuthCallback(code, state)` — process OAuth callback (tenantId + merchantId encoded in state)
- `syncCatalog(tenantId, merchantId)` — trigger catalog sync for a merchant
- `getConnectionStatus(tenantId, merchantId)` — query connection status
- `disconnect(tenantId, merchantId)` — disconnect Square account

**SquareOAuthService** — Square OAuth specifics:
- `buildAuthorizationUrl(tenantId, returnUrl)` — generate signed URL
- `exchangeCode(code)` — code to tokens
- `refreshToken(refreshToken)` — refresh expired token
- `listLocations(accessToken)` — fetch Square locations

**SquareCatalogService** — catalog sync and mapping:
- `fetchFullCatalog(accessToken)` — pull full catalog via Square SDK
- `mapToMenuModels(tenantId, companyId, catalogObjects)` — map to internal models
- `syncFull(tenantId)` — end-to-end sync flow

### Call Graph

```
SquareService
  ├── SquareOAuthService  → Square SDK (OAuth API)
  ├── SquareCatalogService → Square SDK (Catalog API)
  │     └── maps to → MenuCategory / MenuItem / ExternalIdMapping
  └── IntegrationService → IntegrationConnection / SyncRecord
```

## Catalog Mapping Logic

### Square → Internal Model Mapping

| Square Object | Internal Model | Notes |
|---|---|---|
| CatalogCategory | MenuCategory | 1:1 mapping |
| CatalogItem | MenuItem | One Item may have multiple Variations |
| CatalogItemVariation | MenuItem.modifiers JSON | Single variation = base price; multiple = modifier group |
| CatalogModifierList | MenuItem.modifiers JSON | Merged into modifier groups |
| CatalogTax | TaxConfig + MerchantTaxRate | Tax rate mapping |

### Mapping Rules

**Category**: Square CatalogCategory maps 1:1 to MenuCategory. Name maps directly, sortOrder assigned by appearance order.

**Item**: Each CatalogItem becomes one MenuItem.
- Single Variation: variation price becomes MenuItem.price
- Multiple Variations: first variation price becomes MenuItem.price, all variations become a modifier group in modifiers JSON

**Modifier**: CatalogModifierList becomes a modifier group in the modifiers JSON field:
```typescript
// MenuItem.modifiers JSON structure
{
  groups: [{
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: [{
      name: string;
      price: number;
      externalId: string;
    }]
  }]
}
```

**Tax**: CatalogTax maps to TaxConfig (name, percentage) and MerchantTaxRate, linked to items via MenuItemTax.

**Sync Strategy**:
- First connection: full sync (CATALOG_FULL)
- Uses ExternalIdMapping for upsert — update if exists, create if not
- Deleted Square objects: mark corresponding internal records deleted = true

### Sync Flow

```
syncFull(tenantId):
  1. Get IntegrationConnection → accessToken
  2. Call Square SDK listCatalog() → fetch full catalog
  3. Group by type: categories, items, modifierLists, taxes
  4. Map taxes → TaxConfig + MerchantTaxRate
  5. Map categories → MenuCategory
  6. Map items + modifierLists → MenuItem (with modifiers JSON)
  7. Create MenuCategoryItem associations
  8. Batch upsert ExternalIdMapping
  9. Update IntegrationSyncRecord (status, counts)
  All within a single Prisma transaction
```

## OAuth Flow

```
User clicks "Connect Square"
    ↓
GET /api/integration/square/oauth/authorize?tenantId=xxx&merchantId=xxx&returnUrl=xxx
    ↓
SquareService.getAuthorizationUrl(tenantId, merchantId, returnUrl)
    → Generate state = base64({tenantId, merchantId, returnUrl}) + "." + hmacSha256(payload, secret)
    → Build Square OAuth URL (clientId, scopes, state, redirectUri)
    ↓
302 redirect to Square authorization page
    ↓
User authorizes on Square
    ↓
Square callback → GET /api/integration/square/oauth/callback?code=xxx&state=xxx
    ↓
SquareService.handleOAuthCallback(code, state)
    → Verify state HMAC signature
    → exchangeCode(code) → get access_token, refresh_token
    → listLocations(accessToken) → get Square locations
    → Create IntegrationConnection (store tokens + locationId)
    → Trigger initial full catalog sync
    ↓
302 redirect to returnUrl
```

### Token Refresh

- Square tokens expire after 30 days
- Check tokenExpiresAt before each API call, auto-refresh if expired
- Update IntegrationConnection with new tokens after refresh

## API Routes

```
src/app/api/integration/square/
├── oauth/
│   ├── authorize/route.ts    # GET  → redirect to Square OAuth
│   └── callback/route.ts     # GET  → handle OAuth callback
├── catalog/
│   └── sync/route.ts         # POST → trigger catalog sync
└── status/route.ts           # GET  → query connection status
```

## Environment Variables

```env
SQUARE_ENABLED=false
SQUARE_APP_ID=                    # Square Application ID
SQUARE_APP_SECRET=                # Square Application Secret
SQUARE_ENVIRONMENT=sandbox        # sandbox | production
SQUARE_OAUTH_STATE_SECRET=        # HMAC signing secret for OAuth state
SQUARE_WEBHOOK_SIGNATURE_KEY=     # Reserved for future webhook support
```

## Retry, Idempotency & Concurrency

### Retry

- Square SDK has built-in automatic retry (network errors, 5xx, 429 Rate Limit) with configurable `maxRetries` (default 3, exponential backoff). No custom retry wrapper needed.
- Token expiry (401): not retried — instead refresh token and re-call once. If refresh fails, throw `INTEGRATION_TOKEN_EXPIRED`.
- Catalog sync runs inside a Prisma transaction — failure auto-rolls back, no dirty data. The `IntegrationSyncRecord` status update happens outside the transaction so failures are always recorded.

### Idempotency

**OAuth callback**:
- `handleOAuthCallback` checks for existing `IntegrationConnection(tenantId, merchantId, type: "POS_SQUARE")` first
- If active: update tokens only, no duplicate creation
- If inactive: reactivate and update tokens
- Unique constraint `@@unique([tenantId, merchantId, type])` prevents duplicate connections at DB level

**Catalog sync**:
- `ExternalIdMapping` has unique constraint `@@unique([tenantId, externalSource, externalId])`
- Same Square object synced multiple times → update only, never duplicate MenuItem/MenuCategory
- Full-replace semantics: Square's current data is the source of truth

**Token refresh**:
- After refresh, new tokens overwrite old ones in DB. Concurrent refreshes are safe — the last write wins, and Square returns a new valid refresh token with each response.

### Concurrency

**Concurrent catalog syncs**:
- `syncFull` creates an `IntegrationSyncRecord(status: "running")` at entry
- Before starting, check for existing `status: "running"` record — if found, reject with `SQUARE_SYNC_ALREADY_RUNNING`
- Stale running records (older than 10 minutes) are auto-expired to prevent deadlocks

**Concurrent token refresh**:
- Use conditional update: `UPDATE ... WHERE token_expires_at < now()` — only the first caller refreshes, second caller sees already-updated token and uses it directly

**Concurrent OAuth callbacks**:
- `@@unique([tenantId, merchantId, type])` constraint on IntegrationConnection prevents duplicate connections at DB level

## Error Handling

Uses AppError + error codes per project i18n conventions:

- `INTEGRATION_NOT_CONNECTED` — no active connection found
- `INTEGRATION_TOKEN_EXPIRED` — token expired and refresh failed
- `INTEGRATION_OAUTH_STATE_INVALID` — OAuth state HMAC verification failed
- `SQUARE_CATALOG_SYNC_FAILED` — catalog sync failed
- `SQUARE_SYNC_ALREADY_RUNNING` — another sync is already in progress

New error codes added to `error-codes.ts` and `shared/en.json`.

## Dependencies

- `square` npm package — official Square SDK for TypeScript

## Out of Scope (Future Phases)

- Square Order push (createOrder, updateOrderStatus)
- Square Webhook handling (catalog/order/payment events)
- GBP OAuth + Location sync
- Credential encryption
- Scheduled sync (cron jobs)
- Delta sync (cursor-based incremental sync)
