# Phase 2: Micro Service Cluster — class → object literal

**Issue**: [#312](https://github.com/plovr-ai/plovr-grow/issues/312)
**Phase**: 2 of #310 (follows [#311](https://github.com/plovr-ai/plovr-grow/pull/311) merchant+tenant)
**Pattern**: Module-level async functions + object literal aggregation (per `docs/superpowers/specs/2026-04-18-service-class-refactor-design.md`)

## Scope

Migrate 6 services. Keep call sites unchanged. No new tests (refactor = behavior-preserving).

| File | Lines | `this.xxx` | private | Instance state | Migration class |
|------|-------|-----------|---------|----------------|-----------------|
| `auth/auth.service.ts` | 97 | 0 | 0 | no | **Trivial** |
| `leads/leads.service.ts` | 51 | 0 | 0 | no | **Trivial** |
| `email/email.service.ts` | 143 | 2 | 1 method | no | **Simple** |
| `stripe-connect/stripe-connect.service.ts` | 130 | 0 | 1 getter | no | **Simple** |
| `otp/otp.service.ts` | 168 | ~10 | 3 methods + 2 lazy fields | no | **Medium** |
| `integration/webhook-dispatcher.service.ts` | 146 | — | 1 field (Map) | **yes** (`providers`) | **Factory** (CLAUDE.md DI exception) |

## Per-file migration

### 1. auth.service.ts (trivial)

- Drop `class`. Hoist 2 methods (`findOrCreateStytchUser`, `claimTenant`) to module-level async functions.
- `export const authService = { findOrCreateStytchUser, claimTenant }`.
- Test file: **zero changes** (already uses `authService` import).

### 2. leads.service.ts (trivial)

- Same as auth. 2 methods (`createCalculatorLead`, `createDemoLead`).
- Test file: **zero changes**.

### 3. email.service.ts

- Hoist `sendEmail`, `sendInvoiceEmail` as module-level async functions.
- `generateInvoiceEmailHtml` (was `private`) → module-level non-exported function.
- Rewrite `this.sendEmail(...)` → `sendEmail(...)` and `this.generateInvoiceEmailHtml(...)` → `generateInvoiceEmailHtml(...)`.
- `export const emailService = { sendEmail, sendInvoiceEmail }` (exclude the private helper).
- No test file exists for email — only call-site regression coverage via consumers.

### 4. stripe-connect.service.ts

- `private get clientId()` → module-level non-exported `function getClientId()`.
- Hoist all 6 methods (`generateOAuthUrl`, `parseOAuthState`, `handleOAuthCallback`, `getConnectAccount`, `isAccountReady`, `disconnectAccount`, `handleAccountUpdated`) as module-level functions.
- Rewrite `this.clientId` → `getClientId()`.
- `export const stripeConnectService = { ... }`.
- **Test file change** (`stripe-connect.service.test.ts`): 17 sites of the form:
  ```ts
  const { StripeConnectService } = await import("../stripe-connect.service");
  const service = new StripeConnectService();
  // ... service.xxx()
  ```
  Replace each with:
  ```ts
  const { stripeConnectService: service } = await import("../stripe-connect.service");
  // ... service.xxx()
  ```
  Dynamic import is retained (tests mutate `process.env.STRIPE_CLIENT_ID` — re-import isn't strictly needed since `getClientId()` reads env at call time, but minimizing diff keeps the test structure intact).

### 5. otp.service.ts

- Drop `_repository` / `_smsService` lazy fields and their getters entirely. Just use the imported `otpVerificationRepository` and `smsService` directly at function-body level (behavior-equivalent — imports are already resolved at module load).
- Hoist `sendOtp`, `verifyOtp`, `cleanupExpired` as module-level async functions.
- `generateOtpCode`, `getExpirationDate`, `getErrorCode` (all `private`) → module-level non-exported functions.
- Rewrite `this.repository.xxx` → `otpVerificationRepository.xxx`, `this.sms.xxx` → `smsService.xxx`, `this.generateOtpCode()` → `generateOtpCode()`, etc.
- `export const otpService = { sendOtp, verifyOtp, cleanupExpired }`.
- **Test file change** (`otp.service.test.ts`):
  - `import { OtpService } from "../otp.service"` → `import { otpService } from "../otp.service"`
  - Drop `let service: OtpService;` and `service = new OtpService();`. Use imported `otpService` directly in each test (replace `service.` → `otpService.`).

### 6. webhook-dispatcher.service.ts — **factory pattern**

Has instance state (`providers: Map<string, PosWebhookProvider>`). The test suite and `instrumentation.ts` both depend on the ability to create fresh instances (test isolation) or mutate state post-construction (`register()`). This matches the CLAUDE.md "DI exception" guidance: factory function returning an object literal with closure-captured state.

```ts
export interface WebhookDispatcher {
  register(name: string, provider: PosWebhookProvider): void;
  hasProvider(name: string): boolean;
  dispatch(providerName: string, rawBody: string, headers: Record<string, string>): Promise<WebhookDispatchResult>;
}

export function createWebhookDispatcher(): WebhookDispatcher {
  const providers = new Map<string, PosWebhookProvider>();

  function register(name: string, provider: PosWebhookProvider) {
    providers.set(name, provider);
  }
  function hasProvider(name: string) {
    return providers.has(name);
  }
  async function dispatch(providerName: string, rawBody: string, headers: Record<string, string>): Promise<WebhookDispatchResult> {
    const provider = providers.get(providerName);
    // ... (body identical to current class method)
  }

  return { register, hasProvider, dispatch };
}

export const webhookDispatcher = createWebhookDispatcher();
```

- Preserves the `webhookDispatcher` singleton name (used by `instrumentation.ts` and `api/integration/webhook/[provider]/route.ts`).
- **Test file change** (`webhook-dispatcher.test.ts`):
  - `import { WebhookDispatcherService }` → `import { createWebhookDispatcher, type WebhookDispatcher }`.
  - `let dispatcher: WebhookDispatcherService` → `let dispatcher: WebhookDispatcher`.
  - `dispatcher = new WebhookDispatcherService()` → `dispatcher = createWebhookDispatcher()`.

## Verification

1. `npm run lint` — 0 errors in changed files.
2. `npx tsc --noEmit` — no new type errors.
3. `npm run test:run` — all green, coverage unchanged (no new files, same call graph).
4. Grep `export class (Auth|Leads|Email|Otp|WebhookDispatcher|StripeConnect)Service` → **0 matches**.
5. Grep `xxxService\.(` for each — call sites unchanged.

## Non-goals (per issue + spec)

- No other service migrations (generator/sms/google-places remain class per spec DI carve-out).
- No new tests.
- No `cache()` wrapping (that's #303).
- No CLAUDE.md changes (#311 already established the pattern).
