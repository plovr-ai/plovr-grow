# Mistakes Log

## [260] Sentry SDK v10 metrics use `attributes` not `tags`

**Date**: 2026-04-15
**Category**: api-misuse

### What went wrong
Used `tags` property in `Sentry.metrics.count()` options, which matched older Sentry SDK documentation. Sentry v10 `MetricOptions` interface uses `attributes` instead of `tags`, causing a TypeScript compilation error.

### Correct approach
Check the actual TypeScript type definitions in `node_modules/@sentry/core/build/types/metrics/public-api.d.ts` for the `MetricOptions` interface. In v10: `{ attributes: { key: value } }`.

### How to avoid
Before using any Sentry API, verify the type signature in the installed SDK's `.d.ts` files, not from docs or memory.

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
