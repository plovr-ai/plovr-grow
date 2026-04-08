# Stripe Connect Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate storefront payments from direct Stripe to Stripe Connect Standard, so each restaurant receives payments directly into their own Stripe account.

**Architecture:** Strategy Pattern with `PaymentProvider` interface. `StripeConnectStandardProvider` implements it, delegating to a refactored `StripeService` for raw API calls. A new `StripeConnectService` manages OAuth onboarding and account lifecycle. Subscriptions remain on the platform's own Stripe account, untouched.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma ORM, Stripe SDK v20, Vitest

**Design Spec:** `docs/superpowers/specs/2026-04-08-stripe-connect-standard-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/services/stripe-connect/stripe-connect.types.ts` | Connect account types, OAuth types, PaymentProvider interface |
| `src/services/stripe-connect/stripe-connect.service.ts` | OAuth flow, account management, status checks |
| `src/services/stripe-connect/stripe-connect-standard.provider.ts` | PaymentProvider implementation for Connect Standard |
| `src/services/stripe-connect/index.ts` | Barrel export |
| `src/repositories/stripe-connect-account.repository.ts` | StripeConnectAccount CRUD |
| `src/app/api/auth/stripe/connect/route.ts` | OAuth initiation endpoint |
| `src/app/api/auth/stripe/callback/route.ts` | OAuth callback endpoint |
| `src/app/api/webhooks/stripe-connect/route.ts` | Connect webhook handler |
| `src/app/api/dashboard/stripe-connect/route.ts` | Dashboard: get connect status |
| `src/app/api/dashboard/stripe-connect/disconnect/route.ts` | Dashboard: disconnect account |
| `__tests__/` files adjacent to each new source file | Unit tests |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add StripeConnectAccount model, add fields to Payment and Tenant |
| `src/services/stripe/stripe.service.ts` | Remove direct payment methods, add `stripeAccount` param to payment methods |
| `src/services/stripe/stripe.types.ts` | Update types for Connect support |
| `src/services/payment/payment.service.ts` | Refactor to use PaymentProvider, remove direct Stripe calls |
| `src/services/payment/payment.types.ts` | Add `stripeAccountId` to types |
| `src/services/payment/index.ts` | Re-export new types |
| `src/repositories/payment.repository.ts` | Add `stripeAccountId` field handling |
| `src/app/api/webhooks/stripe/route.ts` | Remove payment events, keep subscription only |
| `src/app/api/storefront/r/[slug]/payment-intent/route.ts` | Return `stripeAccountId` in response |
| `src/app/(storefront)/components/checkout/StripeProvider.tsx` | Accept `stripeAccountId` prop |
| `src/app/(storefront)/hooks/usePaymentIntent.ts` | Track `stripeAccountId` from API |
| `src/app/(storefront)/r/[merchantSlug]/checkout/page.tsx` | Pass `stripeAccountId`, support cash-only mode |
| `src/lib/errors/error-codes.ts` | Add Connect-related error codes |
| `.env.example` | Add `STRIPE_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET` |

---

## Task 1: Database Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

- [ ] **Step 1: Add StripeConnectAccount model to Prisma schema**

Add after the StripeCustomer model (after line ~802):

```prisma
model StripeConnectAccount {
  id                    String    @id
  tenantId              String    @unique @map("tenant_id")
  stripeAccountId       String    @unique @map("stripe_account_id")

  accessToken           String?   @map("access_token")
  refreshToken          String?   @map("refresh_token")
  scope                 String?

  chargesEnabled        Boolean   @default(false) @map("charges_enabled")
  payoutsEnabled        Boolean   @default(false) @map("payouts_enabled")
  detailsSubmitted      Boolean   @default(false) @map("details_submitted")

  connectedAt           DateTime? @map("connected_at")
  disconnectedAt        DateTime? @map("disconnected_at")
  deleted               Boolean   @default(false)
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([stripeAccountId])
  @@map("stripe_connect_accounts")
}
```

- [ ] **Step 2: Add stripeAccountId to Payment model**

In the Payment model (around line 753), add after `stripeCustomerId`:

```prisma
  stripeAccountId       String?   @map("stripe_account_id")
```

- [ ] **Step 3: Add stripeConnectStatus to Tenant model**

In the Tenant model, add:

```prisma
  stripeConnectStatus   String?   @map("stripe_connect_status")
```

And add the relation:

```prisma
  stripeConnectAccount  StripeConnectAccount?
```

- [ ] **Step 4: Add new environment variables to .env.example**

Append to the Stripe section:

```
# Stripe Connect
STRIPE_CLIENT_ID=ca_xxx
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxx
```

- [ ] **Step 5: Generate Prisma client and push schema**

Run:
```bash
npm run db:generate
npm run db:push
```

Expected: Prisma client generated successfully, schema synced.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat: add StripeConnectAccount model and schema changes (#15)"
```

---

## Task 2: Add Connect Error Codes

**Files:**
- Modify: `src/lib/errors/error-codes.ts`
- Modify: `src/messages/shared/en.json` (if error messages file exists)

- [ ] **Step 1: Add error codes**

Add to the error codes file after the existing payment error codes:

```typescript
// Stripe Connect
STRIPE_CONNECT_NOT_CONFIGURED: "STRIPE_CONNECT_NOT_CONFIGURED",
STRIPE_CONNECT_ACCOUNT_NOT_FOUND: "STRIPE_CONNECT_ACCOUNT_NOT_FOUND",
STRIPE_CONNECT_CHARGES_NOT_ENABLED: "STRIPE_CONNECT_CHARGES_NOT_ENABLED",
STRIPE_CONNECT_OAUTH_FAILED: "STRIPE_CONNECT_OAUTH_FAILED",
STRIPE_CONNECT_ALREADY_CONNECTED: "STRIPE_CONNECT_ALREADY_CONNECTED",
STRIPE_CONNECT_DISCONNECT_FAILED: "STRIPE_CONNECT_DISCONNECT_FAILED",
```

- [ ] **Step 2: Add corresponding error messages to shared translations**

Add the English messages for each error code.

- [ ] **Step 3: Verify build**

Run:
```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/errors/error-codes.ts src/messages/shared/en.json
git commit -m "feat: add Stripe Connect error codes (#15)"
```

---

## Task 3: StripeConnectAccount Repository

**Files:**
- Create: `src/repositories/stripe-connect-account.repository.ts`
- Create: `src/repositories/__tests__/stripe-connect-account.repository.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    stripeConnectAccount: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"
import { stripeConnectAccountRepository } from "../stripe-connect-account.repository"

describe("StripeConnectAccountRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("create", () => {
    it("should create a connect account record", async () => {
      const mockAccount = {
        id: "sca_123",
        tenantId: "tenant_1",
        stripeAccountId: "acct_123",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      }
      vi.mocked(db.stripeConnectAccount.create).mockResolvedValue(mockAccount as never)

      const result = await stripeConnectAccountRepository.create("tenant_1", {
        stripeAccountId: "acct_123",
        accessToken: "sk_test_xxx",
        refreshToken: "rt_xxx",
        scope: "read_write",
      })

      expect(db.stripeConnectAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          stripeAccountId: "acct_123",
        }),
      })
      expect(result).toEqual(mockAccount)
    })
  })

  describe("getByTenantId", () => {
    it("should find connect account by tenant ID", async () => {
      const mockAccount = { id: "sca_123", tenantId: "tenant_1", stripeAccountId: "acct_123" }
      vi.mocked(db.stripeConnectAccount.findFirst).mockResolvedValue(mockAccount as never)

      const result = await stripeConnectAccountRepository.getByTenantId("tenant_1")

      expect(db.stripeConnectAccount.findFirst).toHaveBeenCalledWith({
        where: { tenantId: "tenant_1", deleted: false },
      })
      expect(result).toEqual(mockAccount)
    })
  })

  describe("getByStripeAccountId", () => {
    it("should find connect account by Stripe account ID", async () => {
      const mockAccount = { id: "sca_123", stripeAccountId: "acct_123" }
      vi.mocked(db.stripeConnectAccount.findFirst).mockResolvedValue(mockAccount as never)

      const result = await stripeConnectAccountRepository.getByStripeAccountId("acct_123")

      expect(db.stripeConnectAccount.findFirst).toHaveBeenCalledWith({
        where: { stripeAccountId: "acct_123", deleted: false },
      })
      expect(result).toEqual(mockAccount)
    })
  })

  describe("updateAccountStatus", () => {
    it("should update charges and payouts enabled status", async () => {
      vi.mocked(db.stripeConnectAccount.update).mockResolvedValue({} as never)

      await stripeConnectAccountRepository.updateAccountStatus("sca_123", {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      })

      expect(db.stripeConnectAccount.update).toHaveBeenCalledWith({
        where: { id: "sca_123" },
        data: {
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        },
      })
    })
  })

  describe("softDelete", () => {
    it("should soft delete and record disconnection time", async () => {
      vi.mocked(db.stripeConnectAccount.update).mockResolvedValue({} as never)

      await stripeConnectAccountRepository.softDelete("sca_123")

      expect(db.stripeConnectAccount.update).toHaveBeenCalledWith({
        where: { id: "sca_123" },
        data: expect.objectContaining({
          deleted: true,
          disconnectedAt: expect.any(Date),
        }),
      })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/repositories/__tests__/stripe-connect-account.repository.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the repository**

```typescript
import { db, type DbClient } from "@/lib/db"
import { generateId } from "@/lib/utils/id"

interface CreateConnectAccountInput {
  stripeAccountId: string
  accessToken?: string
  refreshToken?: string
  scope?: string
}

interface UpdateAccountStatusInput {
  chargesEnabled?: boolean
  payoutsEnabled?: boolean
  detailsSubmitted?: boolean
}

class StripeConnectAccountRepository {
  async create(tenantId: string, data: CreateConnectAccountInput, tx?: DbClient) {
    const client = tx ?? db
    return client.stripeConnectAccount.create({
      data: {
        id: generateId(),
        tenantId,
        stripeAccountId: data.stripeAccountId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        scope: data.scope,
        connectedAt: new Date(),
      },
    })
  }

  async getByTenantId(tenantId: string) {
    return db.stripeConnectAccount.findFirst({
      where: { tenantId, deleted: false },
    })
  }

  async getByStripeAccountId(stripeAccountId: string) {
    return db.stripeConnectAccount.findFirst({
      where: { stripeAccountId, deleted: false },
    })
  }

  async updateAccountStatus(id: string, data: UpdateAccountStatusInput) {
    return db.stripeConnectAccount.update({
      where: { id },
      data,
    })
  }

  async softDelete(id: string) {
    return db.stripeConnectAccount.update({
      where: { id },
      data: {
        deleted: true,
        disconnectedAt: new Date(),
      },
    })
  }
}

export const stripeConnectAccountRepository = new StripeConnectAccountRepository()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/repositories/__tests__/stripe-connect-account.repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/stripe-connect-account.repository.ts src/repositories/__tests__/stripe-connect-account.repository.test.ts
git commit -m "feat: add StripeConnectAccountRepository (#15)"
```

---

## Task 4: PaymentProvider Interface and Connect Types

**Files:**
- Create: `src/services/stripe-connect/stripe-connect.types.ts`

- [ ] **Step 1: Define PaymentProvider interface and all Connect types**

```typescript
// --- PaymentProvider Interface ---

export interface CreateProviderPaymentIntentInput {
  amount: number
  currency: string
  stripeAccountId: string
  metadata?: Record<string, string>
}

export interface ProviderPaymentIntentResult {
  paymentIntentId: string
  clientSecret: string
  stripeAccountId: string
}

export interface ProviderRetrievedPaymentIntent {
  id: string
  status: string
  amount: number
  currency: string
  paymentMethodType?: string
  cardBrand?: string
  cardLast4?: string
}

export interface PaymentProvider {
  readonly type: "stripe_connect_standard" | "stripe_connect_express"

  createPaymentIntent(input: CreateProviderPaymentIntentInput): Promise<ProviderPaymentIntentResult>
  retrievePaymentIntent(paymentIntentId: string, stripeAccountId: string): Promise<ProviderRetrievedPaymentIntent>
  verifyWebhookSignature(payload: string, signature: string): Promise<unknown>
}

// --- Connect Account Types ---

export interface ConnectAccountInfo {
  stripeAccountId: string
  accessToken: string
  refreshToken: string
  scope: string
}

export interface ConnectAccountStatus {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}

export interface OAuthCallbackResult {
  stripeAccountId: string
  accessToken: string
  refreshToken: string
  scope: string
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/stripe-connect/stripe-connect.types.ts
git commit -m "feat: define PaymentProvider interface and Connect types (#15)"
```

---

## Task 5: Refactor StripeService for Connect Support

**Files:**
- Modify: `src/services/stripe/stripe.service.ts`
- Modify: `src/services/stripe/stripe.types.ts`

This task refactors `StripeService` to support Connect operations while keeping subscription methods unchanged.

- [ ] **Step 1: Update stripe.types.ts — add stripeAccount to payment types**

Update `CreatePaymentIntentInput`:

```typescript
export interface CreatePaymentIntentInput {
  amount: number
  currency: string
  stripeAccount?: string  // Connected account ID
  customerId?: string
  saveCard?: boolean
  metadata?: Record<string, string>
}
```

Add new types for Connect OAuth:

```typescript
export interface StripeOAuthTokenResponse {
  access_token: string
  refresh_token: string
  stripe_user_id: string
  scope: string
}

export interface StripeAccountInfo {
  id: string
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}
```

- [ ] **Step 2: Update StripeService — add stripeAccount param to payment methods**

In `createPaymentIntent()`, add `stripeAccount` option:

```typescript
async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
  // ... existing mock check ...

  const params: Stripe.PaymentIntentCreateParams = {
    amount: Math.round(input.amount * 100),
    currency: input.currency.toLowerCase(),
    metadata: input.metadata,
    automatic_payment_methods: { enabled: true },
  }

  if (input.customerId) {
    params.customer = input.customerId
  }
  if (input.saveCard) {
    params.setup_future_usage = "on_session"
  }

  const options: Stripe.RequestOptions | undefined = input.stripeAccount
    ? { stripeAccount: input.stripeAccount }
    : undefined

  const paymentIntent = await this.stripe.paymentIntents.create(params, options)

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret!,
    status: paymentIntent.status,
  }
}
```

Update `retrievePaymentIntent()` to accept optional `stripeAccount`:

```typescript
async retrievePaymentIntent(
  paymentIntentId: string,
  stripeAccount?: string
): Promise<RetrievedPaymentIntent> {
  // ... existing mock check ...

  const options: Stripe.RequestOptions | undefined = stripeAccount
    ? { stripeAccount }
    : undefined

  const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId, undefined, options)
  // ... rest unchanged ...
}
```

- [ ] **Step 3: Add Connect OAuth methods to StripeService**

Add these methods to the StripeService class:

```typescript
generateConnectOAuthUrl(clientId: string, redirectUri: string, state: string): string {
  return `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&stripe_landing=register`
}

async handleConnectOAuthCallback(code: string): Promise<StripeOAuthTokenResponse> {
  if (!this.stripe) {
    throw new Error("Stripe not configured")
  }
  const response = await this.stripe.oauth.token({
    grant_type: "authorization_code",
    code,
  })
  return {
    access_token: response.access_token!,
    refresh_token: response.refresh_token!,
    stripe_user_id: response.stripe_user_id!,
    scope: response.scope!,
  }
}

async getConnectAccountStatus(stripeAccountId: string): Promise<StripeAccountInfo> {
  if (!this.stripe) {
    throw new Error("Stripe not configured")
  }
  const account = await this.stripe.accounts.retrieve(stripeAccountId)
  return {
    id: account.id,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
  }
}

async disconnectConnectAccount(stripeAccountId: string): Promise<void> {
  if (!this.stripe) {
    throw new Error("Stripe not configured")
  }
  await this.stripe.oauth.deauthorize({
    client_id: process.env.STRIPE_CLIENT_ID!,
    stripe_user_id: stripeAccountId,
  })
}

verifyConnectWebhookSignature(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!secret) {
    throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET not configured")
  }
  return this.stripe.webhooks.constructEvent(payload, signature, secret)
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/stripe/stripe.service.ts src/services/stripe/stripe.types.ts
git commit -m "feat: add Connect support to StripeService (#15)"
```

---

## Task 6: StripeConnectService

**Files:**
- Create: `src/services/stripe-connect/stripe-connect.service.ts`
- Create: `src/services/stripe-connect/__tests__/stripe-connect.service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/services/stripe", () => ({
  stripeService: {
    generateConnectOAuthUrl: vi.fn(),
    handleConnectOAuthCallback: vi.fn(),
    getConnectAccountStatus: vi.fn(),
    disconnectConnectAccount: vi.fn(),
    isConfigured: vi.fn().mockReturnValue(true),
  },
}))

vi.mock("@/repositories/stripe-connect-account.repository", () => ({
  stripeConnectAccountRepository: {
    create: vi.fn(),
    getByTenantId: vi.fn(),
    getByStripeAccountId: vi.fn(),
    updateAccountStatus: vi.fn(),
    softDelete: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({
  db: {
    tenant: { update: vi.fn() },
  },
}))

import { stripeService } from "@/services/stripe"
import { stripeConnectAccountRepository } from "@/repositories/stripe-connect-account.repository"
import { db } from "@/lib/db"
import { stripeConnectService } from "../stripe-connect.service"

describe("StripeConnectService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_CLIENT_ID = "ca_test_xxx"
  })

  describe("generateOAuthUrl", () => {
    it("should generate OAuth URL with encrypted state", () => {
      vi.mocked(stripeService.generateConnectOAuthUrl).mockReturnValue("https://connect.stripe.com/oauth/authorize?...")

      const url = stripeConnectService.generateOAuthUrl("tenant_1", "https://example.com/callback")

      expect(stripeService.generateConnectOAuthUrl).toHaveBeenCalledWith(
        "ca_test_xxx",
        "https://example.com/callback",
        expect.any(String)
      )
      expect(url).toBeDefined()
    })
  })

  describe("handleOAuthCallback", () => {
    it("should create connect account and update tenant status", async () => {
      vi.mocked(stripeService.handleConnectOAuthCallback).mockResolvedValue({
        access_token: "sk_test_xxx",
        refresh_token: "rt_xxx",
        stripe_user_id: "acct_123",
        scope: "read_write",
      })
      vi.mocked(stripeService.getConnectAccountStatus).mockResolvedValue({
        id: "acct_123",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      })
      vi.mocked(stripeConnectAccountRepository.getByTenantId).mockResolvedValue(null)
      vi.mocked(stripeConnectAccountRepository.create).mockResolvedValue({
        id: "sca_123",
        stripeAccountId: "acct_123",
      } as never)

      const result = await stripeConnectService.handleOAuthCallback("auth_code_xxx", "tenant_1")

      expect(stripeConnectAccountRepository.create).toHaveBeenCalledWith(
        "tenant_1",
        expect.objectContaining({
          stripeAccountId: "acct_123",
          accessToken: "sk_test_xxx",
        })
      )
      expect(db.tenant.update).toHaveBeenCalledWith({
        where: { id: "tenant_1" },
        data: { stripeConnectStatus: "connected" },
      })
      expect(result.stripeAccountId).toBe("acct_123")
    })

    it("should throw if tenant already has connect account", async () => {
      vi.mocked(stripeConnectAccountRepository.getByTenantId).mockResolvedValue({
        id: "sca_existing",
      } as never)

      await expect(
        stripeConnectService.handleOAuthCallback("auth_code_xxx", "tenant_1")
      ).rejects.toThrow()
    })
  })

  describe("isAccountReady", () => {
    it("should return true when account exists and charges enabled", async () => {
      vi.mocked(stripeConnectAccountRepository.getByTenantId).mockResolvedValue({
        id: "sca_123",
        chargesEnabled: true,
        stripeAccountId: "acct_123",
      } as never)

      const result = await stripeConnectService.isAccountReady("tenant_1")
      expect(result).toBe(true)
    })

    it("should return false when no account exists", async () => {
      vi.mocked(stripeConnectAccountRepository.getByTenantId).mockResolvedValue(null)

      const result = await stripeConnectService.isAccountReady("tenant_1")
      expect(result).toBe(false)
    })

    it("should return false when charges not enabled", async () => {
      vi.mocked(stripeConnectAccountRepository.getByTenantId).mockResolvedValue({
        id: "sca_123",
        chargesEnabled: false,
      } as never)

      const result = await stripeConnectService.isAccountReady("tenant_1")
      expect(result).toBe(false)
    })
  })

  describe("getConnectAccount", () => {
    it("should return connect account for tenant", async () => {
      const mockAccount = { id: "sca_123", stripeAccountId: "acct_123", chargesEnabled: true }
      vi.mocked(stripeConnectAccountRepository.getByTenantId).mockResolvedValue(mockAccount as never)

      const result = await stripeConnectService.getConnectAccount("tenant_1")
      expect(result).toEqual(mockAccount)
    })
  })

  describe("disconnectAccount", () => {
    it("should disconnect and update tenant status", async () => {
      vi.mocked(stripeConnectAccountRepository.getByTenantId).mockResolvedValue({
        id: "sca_123",
        stripeAccountId: "acct_123",
      } as never)

      await stripeConnectService.disconnectAccount("tenant_1")

      expect(stripeService.disconnectConnectAccount).toHaveBeenCalledWith("acct_123")
      expect(stripeConnectAccountRepository.softDelete).toHaveBeenCalledWith("sca_123")
      expect(db.tenant.update).toHaveBeenCalledWith({
        where: { id: "tenant_1" },
        data: { stripeConnectStatus: "disconnected" },
      })
    })
  })

  describe("handleAccountUpdated", () => {
    it("should update account status from webhook", async () => {
      vi.mocked(stripeConnectAccountRepository.getByStripeAccountId).mockResolvedValue({
        id: "sca_123",
        tenantId: "tenant_1",
      } as never)

      await stripeConnectService.handleAccountUpdated("acct_123", {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      })

      expect(stripeConnectAccountRepository.updateAccountStatus).toHaveBeenCalledWith("sca_123", {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/stripe-connect/__tests__/stripe-connect.service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement StripeConnectService**

```typescript
import { stripeService } from "@/services/stripe"
import { stripeConnectAccountRepository } from "@/repositories/stripe-connect-account.repository"
import { db } from "@/lib/db"
import { AppError } from "@/lib/errors/app-error"
import { ErrorCodes } from "@/lib/errors/error-codes"
import type { ConnectAccountStatus } from "./stripe-connect.types"

class StripeConnectService {
  private get clientId(): string {
    const id = process.env.STRIPE_CLIENT_ID
    if (!id) throw new AppError(ErrorCodes.STRIPE_CONNECT_NOT_CONFIGURED)
    return id
  }

  generateOAuthUrl(tenantId: string, redirectUri: string): string {
    const state = Buffer.from(JSON.stringify({ tenantId, ts: Date.now() })).toString("base64url")
    return stripeService.generateConnectOAuthUrl(this.clientId, redirectUri, state)
  }

  parseOAuthState(state: string): { tenantId: string } {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString())
    return { tenantId: decoded.tenantId }
  }

  async handleOAuthCallback(code: string, tenantId: string) {
    const existing = await stripeConnectAccountRepository.getByTenantId(tenantId)
    if (existing) {
      throw new AppError(ErrorCodes.STRIPE_CONNECT_ALREADY_CONNECTED)
    }

    const tokenResponse = await stripeService.handleConnectOAuthCallback(code)
    const accountStatus = await stripeService.getConnectAccountStatus(tokenResponse.stripe_user_id)

    const account = await stripeConnectAccountRepository.create(tenantId, {
      stripeAccountId: tokenResponse.stripe_user_id,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      scope: tokenResponse.scope,
    })

    await db.tenant.update({
      where: { id: tenantId },
      data: { stripeConnectStatus: "connected" },
    })

    return {
      stripeAccountId: tokenResponse.stripe_user_id,
      chargesEnabled: accountStatus.charges_enabled,
      payoutsEnabled: accountStatus.payouts_enabled,
      detailsSubmitted: accountStatus.details_submitted,
    }
  }

  async getConnectAccount(tenantId: string) {
    return stripeConnectAccountRepository.getByTenantId(tenantId)
  }

  async isAccountReady(tenantId: string): Promise<boolean> {
    const account = await stripeConnectAccountRepository.getByTenantId(tenantId)
    return account !== null && account.chargesEnabled === true
  }

  async disconnectAccount(tenantId: string): Promise<void> {
    const account = await stripeConnectAccountRepository.getByTenantId(tenantId)
    if (!account) {
      throw new AppError(ErrorCodes.STRIPE_CONNECT_ACCOUNT_NOT_FOUND)
    }

    await stripeService.disconnectConnectAccount(account.stripeAccountId)
    await stripeConnectAccountRepository.softDelete(account.id)
    await db.tenant.update({
      where: { id: tenantId },
      data: { stripeConnectStatus: "disconnected" },
    })
  }

  async handleAccountUpdated(stripeAccountId: string, status: ConnectAccountStatus): Promise<void> {
    const account = await stripeConnectAccountRepository.getByStripeAccountId(stripeAccountId)
    if (!account) return

    await stripeConnectAccountRepository.updateAccountStatus(account.id, {
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
    })
  }
}

export const stripeConnectService = new StripeConnectService()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/stripe-connect/__tests__/stripe-connect.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/stripe-connect/
git commit -m "feat: add StripeConnectService for OAuth and account management (#15)"
```

---

## Task 7: StripeConnectStandardProvider

**Files:**
- Create: `src/services/stripe-connect/stripe-connect-standard.provider.ts`
- Create: `src/services/stripe-connect/__tests__/stripe-connect-standard.provider.test.ts`
- Create: `src/services/stripe-connect/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/services/stripe", () => ({
  stripeService: {
    createPaymentIntent: vi.fn(),
    retrievePaymentIntent: vi.fn(),
    verifyConnectWebhookSignature: vi.fn(),
    isConfigured: vi.fn().mockReturnValue(true),
  },
}))

import { stripeService } from "@/services/stripe"
import { StripeConnectStandardProvider } from "../stripe-connect-standard.provider"

describe("StripeConnectStandardProvider", () => {
  let provider: StripeConnectStandardProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new StripeConnectStandardProvider()
  })

  it("should have type stripe_connect_standard", () => {
    expect(provider.type).toBe("stripe_connect_standard")
  })

  describe("createPaymentIntent", () => {
    it("should create PaymentIntent on connected account", async () => {
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue({
        id: "pi_123",
        clientSecret: "pi_123_secret",
        status: "requires_payment_method",
      })

      const result = await provider.createPaymentIntent({
        amount: 25.99,
        currency: "USD",
        stripeAccountId: "acct_123",
        metadata: { orderId: "order_1" },
      })

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        amount: 25.99,
        currency: "USD",
        stripeAccount: "acct_123",
        metadata: { orderId: "order_1" },
      })
      expect(result).toEqual({
        paymentIntentId: "pi_123",
        clientSecret: "pi_123_secret",
        stripeAccountId: "acct_123",
      })
    })
  })

  describe("retrievePaymentIntent", () => {
    it("should retrieve PaymentIntent from connected account", async () => {
      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue({
        id: "pi_123",
        status: "succeeded",
        amount: 2599,
        currency: "usd",
        cardBrand: "visa",
        cardLast4: "4242",
      })

      const result = await provider.retrievePaymentIntent("pi_123", "acct_123")

      expect(stripeService.retrievePaymentIntent).toHaveBeenCalledWith("pi_123", "acct_123")
      expect(result).toEqual({
        id: "pi_123",
        status: "succeeded",
        amount: 2599,
        currency: "usd",
        cardBrand: "visa",
        cardLast4: "4242",
      })
    })
  })

  describe("verifyWebhookSignature", () => {
    it("should verify Connect webhook signature", () => {
      const mockEvent = { id: "evt_123", type: "payment_intent.succeeded" }
      vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue(mockEvent as never)

      const result = provider.verifyWebhookSignature("payload", "sig_header")

      expect(stripeService.verifyConnectWebhookSignature).toHaveBeenCalledWith("payload", "sig_header")
      expect(result).toEqual(mockEvent)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/stripe-connect/__tests__/stripe-connect-standard.provider.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the provider**

```typescript
import { stripeService } from "@/services/stripe"
import type {
  PaymentProvider,
  CreateProviderPaymentIntentInput,
  ProviderPaymentIntentResult,
  ProviderRetrievedPaymentIntent,
} from "./stripe-connect.types"

export class StripeConnectStandardProvider implements PaymentProvider {
  readonly type = "stripe_connect_standard" as const

  async createPaymentIntent(input: CreateProviderPaymentIntentInput): Promise<ProviderPaymentIntentResult> {
    const result = await stripeService.createPaymentIntent({
      amount: input.amount,
      currency: input.currency,
      stripeAccount: input.stripeAccountId,
      metadata: input.metadata,
    })

    return {
      paymentIntentId: result.id,
      clientSecret: result.clientSecret,
      stripeAccountId: input.stripeAccountId,
    }
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
    stripeAccountId: string
  ): Promise<ProviderRetrievedPaymentIntent> {
    return stripeService.retrievePaymentIntent(paymentIntentId, stripeAccountId)
  }

  verifyWebhookSignature(payload: string, signature: string) {
    return stripeService.verifyConnectWebhookSignature(payload, signature)
  }
}
```

- [ ] **Step 4: Create barrel export**

```typescript
// src/services/stripe-connect/index.ts
export { stripeConnectService } from "./stripe-connect.service"
export { StripeConnectStandardProvider } from "./stripe-connect-standard.provider"
export * from "./stripe-connect.types"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/stripe-connect/__tests__/stripe-connect-standard.provider.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/stripe-connect/
git commit -m "feat: add StripeConnectStandardProvider implementing PaymentProvider (#15)"
```

---

## Task 8: Refactor PaymentService to Use PaymentProvider

**Files:**
- Modify: `src/services/payment/payment.service.ts`
- Modify: `src/services/payment/payment.types.ts`
- Modify: `src/services/payment/index.ts`
- Modify: `src/repositories/payment.repository.ts`
- Update: existing tests

- [ ] **Step 1: Update payment.types.ts**

Add `stripeAccountId` to the relevant types:

```typescript
export interface CreatePaymentIntentRequest {
  tenantId: string
  companyId: string
  merchantId?: string
  amount: number
  currency?: string
  // Remove loyaltyMemberId and saveCard (shelved to #16)
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string
  clientSecret: string
  stripeAccountId: string
}

export interface CreatePaymentRecordInput {
  tenantId: string
  orderId: string
  stripePaymentIntentId: string
  stripeAccountId?: string
  stripeCustomerId?: string
  amount: number
  currency: string
}
```

- [ ] **Step 2: Update payment.repository.ts — add stripeAccountId**

In the `create` method, include `stripeAccountId` in the data:

```typescript
async create(tenantId: string, data: CreatePaymentInput, tx?: DbClient) {
  const client = tx ?? db
  return client.payment.create({
    data: {
      id: generateId(),
      tenantId,
      orderId: data.orderId,
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeAccountId: data.stripeAccountId,  // NEW
      stripeCustomerId: data.stripeCustomerId,
      amount: data.amount,
      currency: data.currency,
    },
  })
}
```

Update the `CreatePaymentInput` type accordingly to include `stripeAccountId?: string`.

- [ ] **Step 3: Refactor PaymentService**

Replace direct `stripeService` calls with `PaymentProvider`:

```typescript
import { StripeConnectStandardProvider } from "@/services/stripe-connect"
import { stripeConnectService } from "@/services/stripe-connect"
import type { PaymentProvider } from "@/services/stripe-connect"
import { AppError } from "@/lib/errors/app-error"
import { ErrorCodes } from "@/lib/errors/error-codes"
import { paymentRepository } from "@/repositories/payment.repository"
import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  CreatePaymentRecordInput,
  PaymentSucceededData,
  PaymentFailedData,
  VerifyPaymentResult,
} from "./payment.types"

class PaymentService {
  private provider: PaymentProvider

  constructor() {
    this.provider = new StripeConnectStandardProvider()
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    const connectAccount = await stripeConnectService.getConnectAccount(request.tenantId)
    if (!connectAccount || !connectAccount.chargesEnabled) {
      throw new AppError(ErrorCodes.STRIPE_CONNECT_CHARGES_NOT_ENABLED)
    }

    const result = await this.provider.createPaymentIntent({
      amount: request.amount,
      currency: request.currency ?? "USD",
      stripeAccountId: connectAccount.stripeAccountId,
      metadata: {
        tenantId: request.tenantId,
        companyId: request.companyId,
        ...(request.merchantId ? { merchantId: request.merchantId } : {}),
      },
    })

    return {
      paymentIntentId: result.paymentIntentId,
      clientSecret: result.clientSecret,
      stripeAccountId: result.stripeAccountId,
    }
  }

  async verifyPayment(
    paymentIntentId: string,
    expectedAmount: number,
    stripeAccountId: string
  ): Promise<VerifyPaymentResult> {
    const pi = await this.provider.retrievePaymentIntent(paymentIntentId, stripeAccountId)

    if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
      return {
        success: false,
        paymentIntentId,
        status: pi.status,
        amount: pi.amount / 100,
        error: `Payment status is ${pi.status}`,
      }
    }

    const actualAmount = pi.amount / 100
    if (Math.abs(actualAmount - expectedAmount) > 0.01) {
      return {
        success: false,
        paymentIntentId,
        status: pi.status,
        amount: actualAmount,
        error: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`,
      }
    }

    return {
      success: true,
      paymentIntentId,
      status: pi.status,
      amount: actualAmount,
      cardBrand: pi.cardBrand,
      cardLast4: pi.cardLast4,
    }
  }

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
    )
  }

  // handlePaymentSucceeded, handlePaymentFailed, getPaymentByOrderId,
  // getSuccessfulPaymentByOrderId, getPaymentByIntentId — keep unchanged
  // (they don't call Stripe directly, just update DB)

  // Remove: getOrCreateStripeCustomer, getSavedPaymentMethods,
  // deleteSavedPaymentMethod (shelved to #16)
}

export const paymentService = new PaymentService()
```

- [ ] **Step 4: Update barrel export**

```typescript
// src/services/payment/index.ts
export { PaymentService, paymentService } from "./payment.service"
export * from "./payment.types"
```

- [ ] **Step 5: Update existing payment-intent route test**

Update the mock in `src/app/api/storefront/r/[slug]/payment-intent/__tests__/route.test.ts` to match new response shape (adding `stripeAccountId`).

- [ ] **Step 6: Verify build and tests**

Run:
```bash
npx tsc --noEmit
npx vitest run
```

Expected: No type errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/payment/ src/repositories/payment.repository.ts
git commit -m "feat: refactor PaymentService to use PaymentProvider (#15)"
```

---

## Task 9: OAuth API Routes

**Files:**
- Create: `src/app/api/auth/stripe/connect/route.ts`
- Create: `src/app/api/auth/stripe/callback/route.ts`
- Create: `src/app/api/auth/stripe/connect/__tests__/route.test.ts`
- Create: `src/app/api/auth/stripe/callback/__tests__/route.test.ts`

- [ ] **Step 1: Write the connect route test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    generateOAuthUrl: vi.fn(),
  },
}))

import { stripeConnectService } from "@/services/stripe-connect"
import { GET } from "../route"

describe("GET /api/auth/stripe/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should redirect to Stripe OAuth URL", async () => {
    vi.mocked(stripeConnectService.generateOAuthUrl).mockReturnValue(
      "https://connect.stripe.com/oauth/authorize?..."
    )

    const request = new Request("http://localhost/api/auth/stripe/connect?tenantId=tenant_1")
    const response = await GET(request)

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toContain("connect.stripe.com")
  })

  it("should return 400 if tenantId missing", async () => {
    const request = new Request("http://localhost/api/auth/stripe/connect")
    const response = await GET(request)

    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Write the callback route test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    parseOAuthState: vi.fn(),
    handleOAuthCallback: vi.fn(),
  },
}))

import { stripeConnectService } from "@/services/stripe-connect"
import { GET } from "../route"

describe("GET /api/auth/stripe/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should handle successful OAuth callback", async () => {
    vi.mocked(stripeConnectService.parseOAuthState).mockReturnValue({ tenantId: "tenant_1" })
    vi.mocked(stripeConnectService.handleOAuthCallback).mockResolvedValue({
      stripeAccountId: "acct_123",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    })

    const request = new Request(
      "http://localhost/api/auth/stripe/callback?code=ac_xxx&state=encoded_state"
    )
    const response = await GET(request)

    expect(response.status).toBe(302)
    expect(stripeConnectService.handleOAuthCallback).toHaveBeenCalledWith("ac_xxx", "tenant_1")
  })

  it("should handle OAuth error", async () => {
    const request = new Request(
      "http://localhost/api/auth/stripe/callback?error=access_denied&error_description=denied"
    )
    const response = await GET(request)

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")!
    expect(location).toContain("error")
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/app/api/auth/stripe/`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement connect route**

```typescript
// src/app/api/auth/stripe/connect/route.ts
import { NextResponse } from "next/server"
import { stripeConnectService } from "@/services/stripe-connect"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tenantId = url.searchParams.get("tenantId")

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
  }

  const baseUrl = `${url.protocol}//${url.host}`
  const redirectUri = `${baseUrl}/api/auth/stripe/callback`

  const oauthUrl = stripeConnectService.generateOAuthUrl(tenantId, redirectUri)

  return NextResponse.redirect(oauthUrl)
}
```

- [ ] **Step 5: Implement callback route**

```typescript
// src/app/api/auth/stripe/callback/route.ts
import { NextResponse } from "next/server"
import { stripeConnectService } from "@/services/stripe-connect"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const dashboardUrl = `${url.protocol}//${url.host}/dashboard/settings`

  if (error) {
    const errorDesc = url.searchParams.get("error_description") ?? "Unknown error"
    return NextResponse.redirect(
      `${dashboardUrl}?stripe_connect=error&message=${encodeURIComponent(errorDesc)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(`${dashboardUrl}?stripe_connect=error&message=Missing+parameters`)
  }

  try {
    const { tenantId } = stripeConnectService.parseOAuthState(state)
    await stripeConnectService.handleOAuthCallback(code, tenantId)

    return NextResponse.redirect(`${dashboardUrl}?stripe_connect=success`)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed"
    return NextResponse.redirect(
      `${dashboardUrl}?stripe_connect=error&message=${encodeURIComponent(message)}`
    )
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/app/api/auth/stripe/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/auth/stripe/
git commit -m "feat: add OAuth connect and callback routes (#15)"
```

---

## Task 10: Connect Webhook Route

**Files:**
- Create: `src/app/api/webhooks/stripe-connect/route.ts`
- Create: `src/app/api/webhooks/stripe-connect/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/services/stripe", () => ({
  stripeService: {
    verifyConnectWebhookSignature: vi.fn(),
  },
}))

vi.mock("@/services/payment", () => ({
  paymentService: {
    handlePaymentSucceeded: vi.fn(),
    handlePaymentFailed: vi.fn(),
  },
}))

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    handleAccountUpdated: vi.fn(),
  },
}))

import { stripeService } from "@/services/stripe"
import { paymentService } from "@/services/payment"
import { stripeConnectService } from "@/services/stripe-connect"
import { POST } from "../route"

describe("POST /api/webhooks/stripe-connect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should handle payment_intent.succeeded event", async () => {
    vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue({
      type: "payment_intent.succeeded",
      account: "acct_123",
      data: {
        object: {
          id: "pi_123",
          status: "succeeded",
          payment_method_types: ["card"],
          charges: { data: [{ payment_method_details: { card: { brand: "visa", last4: "4242" } } }] },
        },
      },
    } as never)

    const request = new Request("http://localhost/api/webhooks/stripe-connect", {
      method: "POST",
      body: "raw_body",
      headers: { "stripe-signature": "sig_xxx" },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(paymentService.handlePaymentSucceeded).toHaveBeenCalled()
  })

  it("should handle account.updated event", async () => {
    vi.mocked(stripeService.verifyConnectWebhookSignature).mockReturnValue({
      type: "account.updated",
      account: "acct_123",
      data: {
        object: {
          id: "acct_123",
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
        },
      },
    } as never)

    const request = new Request("http://localhost/api/webhooks/stripe-connect", {
      method: "POST",
      body: "raw_body",
      headers: { "stripe-signature": "sig_xxx" },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(stripeConnectService.handleAccountUpdated).toHaveBeenCalledWith("acct_123", {
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    })
  })

  it("should return 400 on invalid signature", async () => {
    vi.mocked(stripeService.verifyConnectWebhookSignature).mockImplementation(() => {
      throw new Error("Invalid signature")
    })

    const request = new Request("http://localhost/api/webhooks/stripe-connect", {
      method: "POST",
      body: "raw_body",
      headers: { "stripe-signature": "bad_sig" },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/webhooks/stripe-connect/__tests__/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the Connect webhook route**

```typescript
// src/app/api/webhooks/stripe-connect/route.ts
import { NextResponse } from "next/server"
import { stripeService } from "@/services/stripe"
import { paymentService } from "@/services/payment"
import { stripeConnectService } from "@/services/stripe-connect"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event
  try {
    event = stripeService.verifyConnectWebhookSignature(body, signature)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as {
          id: string
          status: string
          payment_method_types?: string[]
          charges?: { data: Array<{ payment_method_details?: { card?: { brand?: string; last4?: string } } }> }
        }
        const charge = pi.charges?.data?.[0]
        await paymentService.handlePaymentSucceeded({
          paymentIntentId: pi.id,
          status: pi.status,
          paymentMethodType: pi.payment_method_types?.[0],
          cardBrand: charge?.payment_method_details?.card?.brand,
          cardLast4: charge?.payment_method_details?.card?.last4,
        })
        break
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as {
          id: string
          last_payment_error?: { code?: string; message?: string }
        }
        await paymentService.handlePaymentFailed({
          paymentIntentId: pi.id,
          failureCode: pi.last_payment_error?.code,
          failureMessage: pi.last_payment_error?.message,
        })
        break
      }

      case "account.updated": {
        const account = event.data.object as {
          id: string
          charges_enabled?: boolean
          payouts_enabled?: boolean
          details_submitted?: boolean
        }
        await stripeConnectService.handleAccountUpdated(account.id, {
          chargesEnabled: account.charges_enabled ?? false,
          payoutsEnabled: account.payouts_enabled ?? false,
          detailsSubmitted: account.details_submitted ?? false,
        })
        break
      }

      default:
        console.log(`[Stripe Connect Webhook] Unhandled event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`[Stripe Connect Webhook] Error handling ${event.type}:`, error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/webhooks/stripe-connect/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe-connect/
git commit -m "feat: add Connect webhook handler for payment and account events (#15)"
```

---

## Task 11: Clean Up Existing Webhook (Remove Payment Events)

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Remove payment_intent events from existing webhook**

Edit the webhook handler to remove the `payment_intent.succeeded` and `payment_intent.payment_failed` cases. Keep only subscription and invoice events:

- Keep: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Remove: `payment_intent.succeeded`, `payment_intent.payment_failed`

In the `payment_intent.succeeded` handler (around lines 96-123), there is logic that also handles invoice payments. Move the invoice payment logic to the `invoice.payment_succeeded` handler if not already there, then remove the entire `payment_intent.succeeded` and `payment_intent.payment_failed` cases.

- [ ] **Step 2: Update existing webhook test**

Remove test cases for `payment_intent.succeeded` and `payment_intent.payment_failed` from the existing webhook test file.

- [ ] **Step 3: Verify build and tests**

Run:
```bash
npx tsc --noEmit
npx vitest run
```

Expected: No type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/
git commit -m "refactor: remove payment events from platform webhook, now handled by Connect webhook (#15)"
```

---

## Task 12: Update Payment Intent API Route

**Files:**
- Modify: `src/app/api/storefront/r/[slug]/payment-intent/route.ts`
- Update: `src/app/api/storefront/r/[slug]/payment-intent/__tests__/route.test.ts`

- [ ] **Step 1: Update the route to return stripeAccountId**

The route currently calls `paymentService.createPaymentIntent()`. The response type now includes `stripeAccountId`. Update the response:

```typescript
return NextResponse.json({
  success: true,
  data: {
    clientSecret: result.clientSecret,
    paymentIntentId: result.paymentIntentId,
    stripeAccountId: result.stripeAccountId,
  },
})
```

Also remove `loyaltyMemberId` and `saveCard` from the request schema (shelved to #16):

```typescript
const requestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("USD"),
})
```

Remove `stripeCustomerId` from the response since saved cards are shelved.

- [ ] **Step 2: Update the test**

Update the mock to return `stripeAccountId`:

```typescript
vi.mocked(paymentService.createPaymentIntent).mockResolvedValue({
  paymentIntentId: "pi_123",
  clientSecret: "pi_123_secret",
  stripeAccountId: "acct_123",
})
```

Verify the response includes `stripeAccountId`:

```typescript
expect(json.data.stripeAccountId).toBe("acct_123")
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/app/api/storefront/r/[slug]/payment-intent/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/storefront/r/[slug]/payment-intent/
git commit -m "feat: return stripeAccountId from payment-intent API for Connect (#15)"
```

---

## Task 13: Frontend — StripeProvider and usePaymentIntent

**Files:**
- Modify: `src/app/(storefront)/components/checkout/StripeProvider.tsx`
- Modify: `src/app/(storefront)/hooks/usePaymentIntent.ts`

- [ ] **Step 1: Update StripeProvider to accept stripeAccountId**

Update the props interface:

```typescript
interface StripeProviderProps {
  clientSecret: string
  stripeAccountId?: string
  defaultCountry?: string
  children: ReactNode
}
```

Update the `loadStripe` call to pass `stripeAccount`:

```typescript
const stripePromise = useMemo(() => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  return loadStripe(key, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined)
}, [stripeAccountId])
```

Note: The `loadStripe` call needs to move inside the component (or use `useMemo`) because `stripeAccountId` is now dynamic per merchant. Currently it's called at module level — this needs to change.

- [ ] **Step 2: Update usePaymentIntent to track stripeAccountId**

Update the return interface:

```typescript
interface UsePaymentIntentReturn {
  clientSecret: string | null
  paymentIntentId: string | null
  stripeAccountId: string | null  // NEW
  isCreatingPaymentIntent: boolean
  error: string | null
  reset: () => void
}
```

Add state for `stripeAccountId`:

```typescript
const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
```

Parse it from the API response:

```typescript
// In the fetch success handler:
setStripeAccountId(data.stripeAccountId)
```

Reset it in the `reset()` function:

```typescript
setStripeAccountId(null)
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors (there will be errors in checkout page — fixed in next task).

- [ ] **Step 4: Commit**

```bash
git add src/app/(storefront)/components/checkout/StripeProvider.tsx src/app/(storefront)/hooks/usePaymentIntent.ts
git commit -m "feat: update StripeProvider and usePaymentIntent for Connect (#15)"
```

---

## Task 14: Frontend — Checkout Page (Cash-Only + Connect)

**Files:**
- Modify: `src/app/(storefront)/r/[merchantSlug]/checkout/page.tsx`

- [ ] **Step 1: Pass stripeAccountId to StripeProvider**

Destructure `stripeAccountId` from `usePaymentIntent`:

```typescript
const {
  clientSecret,
  paymentIntentId,
  stripeAccountId,  // NEW
  isCreatingPaymentIntent,
  error: paymentError,
  reset: resetPaymentIntent,
} = usePaymentIntent({ ... })
```

Pass to StripeProvider:

```typescript
<StripeProvider clientSecret={clientSecret} stripeAccountId={stripeAccountId}>
  <CardPaymentForm ref={cardPaymentFormRef} ... />
</StripeProvider>
```

- [ ] **Step 2: Add cash-only mode when Connect not available**

Add a mechanism to detect whether the merchant's tenant has Connect enabled. This can be done by checking if the payment-intent API returns an error for non-connected merchants.

In the checkout page, handle the case where `paymentError` indicates no Connect account:

```typescript
const isOnlinePaymentAvailable = !paymentError?.includes("STRIPE_CONNECT_CHARGES_NOT_ENABLED")

// In payment method selection:
{isOnlinePaymentAvailable ? (
  // Show Card + Cash options
) : (
  // Show only Cash option, with info message
)}
```

- [ ] **Step 3: Pass stripeAccountId in order creation**

When creating the order, include `stripeAccountId` in the API request if paying by card:

```typescript
stripeAccountId: formState.paymentMethod === "card" ? stripeAccountId : undefined,
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/(storefront)/r/[merchantSlug]/checkout/page.tsx
git commit -m "feat: update checkout page for Connect and cash-only mode (#15)"
```

---

## Task 15: Dashboard — Stripe Connect Status API

**Files:**
- Create: `src/app/api/dashboard/stripe-connect/route.ts`
- Create: `src/app/api/dashboard/stripe-connect/disconnect/route.ts`
- Create: `src/app/api/dashboard/stripe-connect/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test for GET status**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    getConnectAccount: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn().mockResolvedValue({ tenantId: "tenant_1" }),
}))

import { stripeConnectService } from "@/services/stripe-connect"
import { GET } from "../route"

describe("GET /api/dashboard/stripe-connect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return connect account status", async () => {
    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue({
      id: "sca_123",
      stripeAccountId: "acct_123",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      connectedAt: new Date(),
    } as never)

    const request = new Request("http://localhost/api/dashboard/stripe-connect")
    const response = await GET(request)
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.data.connected).toBe(true)
    expect(json.data.chargesEnabled).toBe(true)
  })

  it("should return not connected when no account", async () => {
    vi.mocked(stripeConnectService.getConnectAccount).mockResolvedValue(null)

    const request = new Request("http://localhost/api/dashboard/stripe-connect")
    const response = await GET(request)
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.data.connected).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/dashboard/stripe-connect/__tests__/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement GET status route**

```typescript
// src/app/api/dashboard/stripe-connect/route.ts
import { NextResponse } from "next/server"
import { stripeConnectService } from "@/services/stripe-connect"
import { getAuthSession } from "@/lib/auth"

export async function GET() {
  const session = await getAuthSession()
  const account = await stripeConnectService.getConnectAccount(session.tenantId)

  if (!account) {
    return NextResponse.json({
      success: true,
      data: { connected: false },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      connected: true,
      stripeAccountId: account.stripeAccountId,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      connectedAt: account.connectedAt,
    },
  })
}
```

- [ ] **Step 4: Implement POST disconnect route**

```typescript
// src/app/api/dashboard/stripe-connect/disconnect/route.ts
import { NextResponse } from "next/server"
import { stripeConnectService } from "@/services/stripe-connect"
import { getAuthSession } from "@/lib/auth"

export async function POST() {
  const session = await getAuthSession()

  try {
    await stripeConnectService.disconnectAccount(session.tenantId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to disconnect" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/app/api/dashboard/stripe-connect/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/dashboard/stripe-connect/
git commit -m "feat: add Dashboard API for Stripe Connect status and disconnect (#15)"
```

---

## Task 16: Remove Saved Cards Code from PaymentService

**Files:**
- Modify: `src/services/payment/payment.service.ts`
- Modify: `src/services/payment/payment.types.ts`

This task cleans up the code shelved to #16.

- [ ] **Step 1: Remove saved card methods from PaymentService**

Remove these methods:
- `getOrCreateStripeCustomer()`
- `getSavedPaymentMethods()`
- `deleteSavedPaymentMethod()`

And remove unused imports (`stripeCustomerRepository`, `loyaltyMemberRepository`, `stripeService` for customer operations).

- [ ] **Step 2: Remove unused types from payment.types.ts**

Remove `loyaltyMemberId` and `saveCard` from `CreatePaymentIntentRequest` if not already done in Task 8. Remove `stripeCustomerId` from `CreatePaymentIntentResponse`.

- [ ] **Step 3: Verify build and tests**

Run:
```bash
npx tsc --noEmit
npx vitest run
```

Expected: No type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/payment/
git commit -m "refactor: remove saved cards code from PaymentService, deferred to #16 (#15)"
```

---

## Task 17: Remove Direct Payment Code from CardPaymentForm

**Files:**
- Modify: `src/app/(storefront)/components/checkout/CardPaymentForm.tsx`

- [ ] **Step 1: Remove saved card checkbox and loyalty integration**

Remove:
- The `useLoyalty()` import and usage
- The "Save card for future orders" checkbox
- Any logic that references `saveCard` or `stripeCustomerId`

Keep:
- PaymentElement rendering
- `confirmPayment()` imperative handle
- Error handling

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(storefront)/components/checkout/CardPaymentForm.tsx
git commit -m "refactor: remove saved cards UI from CardPaymentForm, deferred to #16 (#15)"
```

---

## Task 18: Update Mock Mode for Connect

**Files:**
- Modify: `src/services/stripe/stripe.service.ts`

- [ ] **Step 1: Update mock responses for Connect methods**

In the mock mode sections of `StripeService`, add mock responses for the new Connect methods:

```typescript
// In generateConnectOAuthUrl — no mock needed, it just builds a URL string

// In handleConnectOAuthCallback mock:
if (!this.stripe) {
  console.log("[Stripe Mock] handleConnectOAuthCallback")
  return {
    access_token: "mock_sk_test_xxx",
    refresh_token: "mock_rt_xxx",
    stripe_user_id: "mock_acct_" + Math.random().toString(36).slice(2, 10),
    scope: "read_write",
  }
}

// In getConnectAccountStatus mock:
if (!this.stripe) {
  console.log("[Stripe Mock] getConnectAccountStatus:", stripeAccountId)
  return {
    id: stripeAccountId,
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
  }
}

// In disconnectConnectAccount mock:
if (!this.stripe) {
  console.log("[Stripe Mock] disconnectConnectAccount:", stripeAccountId)
  return
}

// In verifyConnectWebhookSignature — throw in mock mode (webhooks need real verification)
```

Also update the existing `createPaymentIntent` mock to handle `stripeAccount` option.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/stripe/stripe.service.ts
git commit -m "feat: update mock mode for Connect operations (#15)"
```

---

## Task 19: Final Verification and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Review all changed files**

Run: `git diff origin/main --stat`

Verify no unexpected files changed, no debug code left, no `console.log` in production code (except mock mode).

- [ ] **Step 5: Final commit if needed**

If any cleanup was needed:

```bash
git add -A
git commit -m "chore: final cleanup for Stripe Connect Standard migration (#15)"
```
