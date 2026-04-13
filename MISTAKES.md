# Mistakes Log

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
