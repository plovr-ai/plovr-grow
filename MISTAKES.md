# Mistakes Log

## [318] Object-property spies break after class→object-literal refactor when internal calls use bare function names

**Date**: 2026-04-18
**Category**: test-mistake

### What went wrong
After converting `OrderService` class to an object literal, internal calls changed from `this.calculateOrderTotals(...)` to the bare function reference `calculateOrderTotals(...)`. The existing test `vi.spyOn(orderService, "calculateOrderTotals")` silently stopped intercepting — the spy patches the `orderService` object's property but the production code no longer reaches through that object for internal calls. The test still passed because the assertion was loose, which is worse than a failure.

### Correct approach
For in-module internal calls, spy on the *underlying dependency* that the function actually delegates to (e.g., `vi.spyOn(pricing, "calculateOrderPricing")`), or move the spy target up to the module-boundary function. Do not assume object-property spies transparently intercept bare-named internal calls after this refactor pattern.

### How to avoid
When migrating `export class` → object-literal, grep the test file for `vi.spyOn(xxxService, ...)`. Any spy whose target is also called internally by another method of the same service will need to be retargeted at the underlying module or given a different verification strategy.

---

## [294] Binary WS protocols in JSDOM need two compat shims: Blob.arrayBuffer polyfill + Blob-wrap on send

**Date**: 2026-04-17
**Category**: api-misuse

### What went wrong
Implemented a fake phone-ai WS server using `mock-socket` + real `ProtobufFrameSerializer` to exercise the Pipecat SDK end-to-end. The initial naive version sent `serializer.serializeMessage(...)` (Uint8Array) directly via `connectedClient.send(...)`. Two JSDOM-specific failures surfaced: (1) `mock-socket`'s `normalizeSendData` only passes Blob/ArrayBuffer through; Uint8Array gets stringified to comma-joined bytes. (2) Even after wrapping as Blob, the SDK's `ProtobufFrameSerializer.deserialize` calls `data.arrayBuffer()` which does not exist on JSDOM's Blob prototype.

### Correct approach
For any JSDOM-based WS test harness talking a binary protocol:
1. Polyfill `Blob.prototype.arrayBuffer` using `FileReader.readAsArrayBuffer` at fixture module load (guard with `typeof Blob.prototype.arrayBuffer !== "function"`)
2. Always wrap outbound binary as `new Blob([encoded as unknown as ArrayBuffer])` before `client.send(...)`
3. Handle inbound data in three shapes (Blob, ArrayBuffer, stringified-Uint8Array) when decoding what the SDK sent back

See `src/app/(website)/playground/components/__tests__/fixtures/fakePhoneAiServer.ts` for the reference implementation.

### How to avoid
Before shipping a JSDOM+mock-socket fixture that transports binary frames, run the happy-path test early and check for `data.arrayBuffer is not a function` or silent `String(uint8array)` delivery. These are the two canonical failure modes.

---

## [294] Test fixtures must be excluded from coverage, or they drag global thresholds

**Date**: 2026-04-17
**Category**: convention-violation

### What went wrong
Added `src/app/(website)/playground/components/__tests__/fixtures/*.ts` files (browserStubs, rtviMessages, fakePhoneAiServer) as test helpers. Default vitest-v8 coverage config does NOT exclude fixture directories — it only excludes files matching the default test-file glob. Fixture files with defensive branches (error catches, polyfill guards, stringified-payload fallbacks) ran at 70% line / 58% function coverage, dropping the repo's global coverage below the 97% threshold and failing `npm run test:run`.

### Correct approach
When introducing a `fixtures/` subdirectory under `__tests__/`, add `"**/__tests__/fixtures/**"` to `vitest.config.ts` → `coverage.exclude` in the same commit. Test helpers are not product code — their correctness is validated by the tests that depend on them, not by line coverage.

### How to avoid
Any new `__tests__/fixtures/**` or similar test-helper directory MUST be added to `vitest.config.ts` coverage exclusion atomically with the fixture code. Check `npm run test:run` coverage summary before marking the task done.

---

## [280] vi.mock of a service module must be updated when adding new service methods used by migrated routes

**Date**: 2026-04-17
**Category**: test-mistake

### What went wrong
Migrated `api/external/v1/merchants/lookup/route.ts` to call a new `merchantService.lookupByAiPhone` instead of `merchantRepository.getByAiPhone`. Two phone-ai integration tests use `vi.mock("@/services/merchant", () => ({ merchantService: { getMerchantById: ... } }))` to intercept `getMerchantById`. The mock replaces the entire module export, so the new `lookupByAiPhone` method was `undefined` — the lookup handler threw and returned 500 instead of 200/404.

### Correct approach
When moving a route from repository access to a service call, grep for `vi.mock("@/services/<that-service>"` across the test suite. Each mock factory that replaces the whole service export must include either a pass-through for the new method (e.g., `lookupByAiPhone: (phone) => merchantRepository.getByAiPhone(phone)`) or an explicit `vi.fn()` mock alongside existing methods.

### How to avoid
Before committing any `api/**/route.ts` change that introduces a new `service.<method>` call, grep `vi.mock.*<service-path>` and confirm every mock factory already exports the new method.

---

## [262] Pipecat JS SDK API differs from documentation examples

**Date**: 2026-04-15
**Category**: api-misuse

### What went wrong
Planned code used `RTVIClient`, `WebSocketTransport({ url })`, and event names `transcript`/`botText` based on the Pipecat SDK README. The actual installed SDK exports `PipecatClient`, uses `{ wsUrl }` for transport config, and fires `userTranscript`/`botTranscript` events with different data types (`TranscriptData`, `BotLLMTextData`).

### Correct approach
After installing an unfamiliar SDK, check the actual TypeScript type definitions (`node_modules/@pipecat-ai/client-js/dist/`) before writing code. Don't rely solely on README examples.

### How to avoid
For any new third-party SDK, run `npx tsc --noEmit` early and inspect actual exported types rather than trusting documentation examples.

---

## [200] Prisma model field names don't always match intuitive names

**Date**: 2026-04-13
**Category**: wrong-assumption

### What went wrong
Used `subtotalAmount` and `type` as field names when creating Order and OrderFulfillment records in test setup. The actual Prisma schema uses `subtotal` (not `subtotalAmount`) for Order, and OrderFulfillment has no `type` field at all.

### Correct approach
Always check the Prisma schema (`prisma/schema.prisma`) for exact field names before writing `prisma.model.create()` calls. Don't guess field names from other types or service interfaces.

### How to avoid
Before any `prisma.*.create()` in tests, grep `model <ModelName>` in `schema.prisma` to confirm field names.

---

## [128] Integration test cleanup must delete new FK-dependent tables

**Date**: 2026-04-12
**Category**: convention-violation

### What went wrong
Added `ModifierGroup`, `ModifierOption`, and `MenuItemModifierGroup` tables with FK constraints referencing `MenuItem`, but did not update the integration test cleanup functions (`cleanupTestData` and `cleanupCatalogData` in `square-catalog-sync.integration.test.ts`). This caused Prisma P2014 errors when attempting to delete `MenuItem` records.

### Correct approach
When adding new tables with FK constraints on existing tables, always search for integration test cleanup functions that delete from the referenced table and add deletions for the new tables in the correct order (child before parent).

### How to avoid
After adding new FK-constrained tables, grep for `deleteMany` calls on the parent table in integration tests and update cleanup order.

---

## [163] Migration used VARCHAR(20) instead of Prisma default VARCHAR(191)

**Date**: 2026-04-12
**Category**: convention-violation

### What went wrong
The migration SQL used `VARCHAR(20)` for the `payment_type` column, but Prisma maps `String` to `VARCHAR(191)` by default in MySQL. This caused the `prisma migrate diff` CI check to detect drift between migrations and schema.

### Correct approach
Always use `VARCHAR(191)` in migration SQL for Prisma `String` fields (without `@db.VarChar()` annotation). Check existing migrations (e.g., `init` migration) for the column type pattern used by other similar fields.

### How to avoid
Before writing migration SQL, check how Prisma maps the field type by looking at the init migration for similar columns.

---

## [170] Migration used Prisma model name instead of actual MySQL table name

**Date**: 2026-04-13
**Category**: convention-violation

### What went wrong
The migration SQL used `ALTER TABLE \`Order\`` (Prisma model name) instead of `ALTER TABLE \`orders\`` (actual MySQL table name). Prisma models use `@@map("orders")` to map PascalCase model names to snake_case table names, but raw SQL migrations must use the actual database table name.

### Correct approach
Always check the `@@map()` annotation on the Prisma model to determine the actual database table name. For this project, all tables use snake_case names (e.g., `orders`, `menu_items`, `merchants`).

### How to avoid
Before writing any migration SQL, grep for `@@map` on the target model to find the actual table name.

---

## [184] vi.mock factory cannot reference top-level variables (vitest hoisting)

**Date**: 2026-04-13
**Category**: api-misuse

### What went wrong
Created a `PrismaClient` at the top level and referenced it inside a `vi.mock("@/lib/db")` factory function. The factory is hoisted to the top of the file and runs before variable initialization, causing `ReferenceError: Cannot access 'prisma' before initialization`.

### Correct approach
Use `vi.hoisted()` to create any value that needs to be referenced inside a `vi.mock()` factory. `vi.hoisted()` callback runs in the hoisted scope and its return value is available to mock factories.

### How to avoid
When a `vi.mock()` factory needs to reference a variable, always wrap that variable's creation in `vi.hoisted()`.

---

## [184] Event listener leak across integration test describe blocks

**Date**: 2026-04-13
**Category**: test-mistake

### What went wrong
`unregisterOrderEventHandlers()` only sets an `isRegistered` flag to `false` — it does NOT remove the actual event listeners from the emitter. Handlers from one test block remained active in subsequent blocks, consuming `mockRejectedValueOnce` before the intended test could use it.

### Correct approach
Set mock behavior (e.g., `mockRejectedValue`) BEFORE any action that triggers the event (like `createMerchantOrderAtomic`), not after. Assume listeners from prior tests may still be active.

### How to avoid
In tests that rely on event-driven side effects, configure mocks before triggering the event source, and use `mockRejectedValue` (persistent) instead of `mockRejectedValueOnce` when lingering listeners may consume the mock.

---

## [269] Mock that returns fixed list fails when service validates list length

**Date**: 2026-04-16
**Category**: wrong-assumption

### What went wrong
Mocked `menuService.getMenuItemsByIds` to always return all 3 test menu items, regardless of which IDs were requested. The `orderService.createMerchantOrder` validates that `menuItems.length === itemIds.length`, so when the cart had 2 items but the mock returned 3, the check failed with `MENU_ITEMS_UNAVAILABLE`.

### Correct approach
Use `mockImplementation` to filter the returned items by the requested IDs, matching the real service behavior: `ALL_ITEMS.filter(m => requestedIds.includes(m.id))`.

### How to avoid
When mocking a service that returns filtered results, use `mockImplementation` with argument-aware logic instead of `mockResolvedValue` with a static list.

---

## [277] Removing denormalized fields requires tracing ALL consumers, including context providers

**Date**: 2026-04-17
**Category**: wrong-assumption

### What went wrong
Removed `subscriptionPlan`/`subscriptionStatus` from the Tenant model and cleaned up direct references, but missed the `isTrial` field in `MerchantContext` and the `TrialCheckoutBlock` in the checkout page. These were fed by `subscriptionStatus` indirectly through the storefront layout → context → component chain.

### Correct approach
When removing a denormalized field, trace ALL downstream consumers — not just direct `field.name` references, but also derived values (like `isTrial = status === "trial"`) that flow through context providers, hooks, and component props.

### How to avoid
After removing a field, search for both the field name AND any derived boolean/computed values that depended on it. Check React context interfaces for fields that might be fed by the removed data.

---

## [277] Changing function signatures requires checking withApiHandler wrapper callers

**Date**: 2026-04-17
**Category**: wrong-assumption

### What went wrong
Changed subscription service method signatures to require `productLine`, which changed the `withApiHandler` wrapper's expected argument count. Many external API test files (phone-ai, knowledge, links, merchants, sms) called route handlers with 1 arg but the wrapper now expected 2 (request + context with params). These errors were only caught by `tsc`, not by tests.

### Correct approach
When changing a wrapper function's signature or the signature of functions it wraps, search for ALL test files that call routes through that wrapper — not just tests in the changed module.

### How to avoid
After changing a shared wrapper or service method signature, run `npx tsc --noEmit` immediately to catch all callers, before running targeted tests.

---

## [202] New test file for large untested service drops global coverage below thresholds

**Date**: 2026-04-13
**Category**: test-mistake

### What went wrong
Created `tenant.service.test.ts` to test one method of `tenant.service.ts` (447 lines). This pulled the entire file into coverage tracking with only 14% coverage, dropping global coverage below the 97% threshold and failing CI.

### Correct approach
Before creating a new test file for a large untested service, check if the service is already excluded from coverage or if existing test files (e.g., consuming services) already cover the behavior. Add tests to existing test files that already import the dependency chain, or add the service to coverage exclusions if comprehensive testing isn't feasible.

### How to avoid
Before creating test files for previously-untested services, check `vitest.config.ts` coverage thresholds and calculate whether partial coverage will pass.

---

## [278] Prisma `updateMany` with conditional WHERE is NOT atomic CAS on MySQL

**Date**: 2026-04-17
**Category**: api-misuse

### What went wrong
Used `prisma.cart.updateMany({ where: { status: "active", ... }, data: { status: "submitted" } })` as an atomic compare-and-swap in the checkout concurrency guard. Prisma actually compiles this into TWO statements inside an auto-commit transaction: `SELECT id FROM carts WHERE status='active' AND ...` then `UPDATE carts SET status='submitted' WHERE id IN (?)`. The SELECT does not lock rows, so 5 concurrent callers each see status='active' in their snapshot, each UPDATE by id unconditionally, all observe count=1 — breaking the CAS guarantee and creating duplicate orders.

### Correct approach
Use `prisma.$executeRaw` with a single UPDATE-with-conditional-WHERE. InnoDB takes an X-lock on the matched row during the UPDATE, so concurrent sessions serialize and only the winner observes affectedRows=1. Return `{ count: affectedRows }` to preserve the service-layer contract. See `src/repositories/cart.repository.ts:claimForCheckout` for the pattern.

### How to avoid
Any time you need atomic CAS on MySQL via Prisma, use `$executeRaw` with a single UPDATE statement, NOT `updateMany` with a conditional predicate. Empirically verify by running 5 parallel calls — raw SQL returns [1,0,0,0,0], `updateMany` returns [1,1,1,1,1] (the bug).

---

## [297] "Dev-only instrumentation" must not widen shared middleware matcher to compensate for missing request context

**Date**: 2026-04-17
**Category**: convention-violation

### What went wrong
Implementing a dev-only Prisma `$extends` gated on `DB_PERF_LOG=1`, the instrumentation needed a per-request id / route label to bucket queries. The chosen wiring was: middleware injects `x-db-perf-req` / `x-db-perf-route` headers; Prisma extension reads via `next/headers`. Next.js 16's proxy/middleware `config.matcher` is statically analyzed — it does not support env-conditional expressions. To get the headers onto storefront routes, the matcher was widened from `/dashboard|/admin` to the whole app (sans static assets). Even with the header-injection helper gated on the flag, the matcher widening itself permanently runs the existing NextAuth `auth()` wrapper on every request site-wide — a production behavior change that survives even when the flag is off. This violates the "zero runtime cost when flag is unset" guarantee that defines a dev-only tool.

### Correct approach
When you can't feed per-request context to dev instrumentation without widening a shared framework hook, prefer a **request-less fallback**: aggregate queries by a sliding idle window (e.g. 300ms) into `unk_N` buckets and rely on the user's sequential curl pattern + manual label mapping. The instrumentation never touches the middleware/proxy. For this project, that meant `getFallbackBucketKey()` rotating on idle; the analysis findings (query counts + N+1 patterns per route) survive unchanged.

### How to avoid
Rule of thumb for any dev-only tool: if wiring it requires modifying a file that runs on every production request (middleware, proxy, root layout, instrumentation.ts' `register()`), and the modification isn't itself gated on the flag at runtime, reject that approach and fall back to a request-less design. Static-matcher frameworks like Next.js 16 disqualify conditional-matcher workarounds up front.

---
