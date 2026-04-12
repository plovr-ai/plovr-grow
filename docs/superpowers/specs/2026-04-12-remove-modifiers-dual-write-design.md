# Remove MenuItem.modifiers JSON Dual-Write

**Issue**: #143
**Date**: 2026-04-12
**Type**: Refactoring (enhancement)

## Background

PR #137 (#128) introduced normalized `ModifierGroup` / `ModifierOption` / `MenuItemModifierGroup` tables. For backward compatibility, a dual-write strategy was adopted: catalog sync writes to both the new structured tables and the legacy `MenuItem.modifiers` JSON field.

All read paths already prefer relational data with JSON as fallback. This refactoring removes the dual-write, JSON fallback reads, and the `modifiers` field entirely.

## Goals

1. Remove all JSON writes to `MenuItem.modifiers`
2. Remove all JSON fallback reads
3. Consolidate modifier persistence logic into `MenuService`
4. Remove `modifiers Json?` field from Prisma schema
5. Add comprehensive unit tests for modifier operations

## Non-Goals

- Changing the storefront UI behavior (already uses relational data)
- Modifying `Order.items` JSON snapshots (order data is independent)
- Changing the cart/checkout `SelectedModifier` structure

## Design

### 1. Consolidate modifier persistence into MenuService

**Current state**: Two independent implementations exist:
- `MenuService.syncModifierGroupsToTables()` — used by dashboard create/update (private, uses top-level `prisma`)
- `SquareService.syncCatalog()` inline block (lines 296-418) — used by Square sync (uses `tx`)

**Change**: Make `MenuService.syncModifierGroups()` the single source of truth.

```typescript
// menu.service.ts — promote to public, accept optional tx
async syncModifierGroups(
  tenantId: string,
  menuItemId: string,
  groups: ModifierGroupInput[],
  tx?: PrismaTransactionClient
): Promise<void>
```

- Uses `tx` if provided, otherwise falls back to top-level `prisma`
- Dashboard calls without `tx` (as before)
- Square sync calls with `tx` to maintain transaction consistency

**Square sync adapter**: Before calling `syncModifierGroups`, Square maps its `MappedModifierGroup[]` (with external IDs) to `ModifierGroupInput[]` (with internal IDs). The ID resolution logic stays in `square.service.ts` since it's integration-specific. The external ID mapping writes also stay in Square sync, within the same `tx`.

Flow within the existing `prisma.$transaction(tx)`:
1. Resolve external IDs → internal IDs for groups and options (Square responsibility)
2. Call `menuService.syncModifierGroups(tenantId, itemId, groups, tx)` (MenuService responsibility)
3. Write ExternalIdMapping records (Square responsibility)

All three steps share the same `tx`, ensuring atomicity.

### 2. Remove JSON write paths

**`menu.service.ts`**:
- `createMenuItem()` (line 405): Remove `modifiers: JSON.parse(JSON.stringify(input.modifierGroups))` from create data
- `updateMenuItem()` (line 440): Remove `data.modifiers = JSON.parse(...)` from update data

**`square.service.ts`**:
- `syncCatalog()` (lines 211-221): Remove `modifiers: item.modifiers ? JSON.parse(...) : null` from both create and update of `tx.menuItem.upsert`
- Replace inline modifier table logic (lines 296-418) with call to `menuService.syncModifierGroups()`

### 3. Remove JSON read fallbacks

**`src/app/(storefront)/r/[merchantSlug]/menu/utils.ts`**:
- Remove `StoredModifier` and `StoredModifierGroup` type definitions
- `parseModifierGroups()`: Remove JSON fallback branch (lines 149-176), keep only relational data parsing
- Simplify signature: no longer needs `options: Prisma.JsonValue | null` parameter

**`menu.service.ts`**:
- `extractDashboardModifierGroups()`: Remove JSON fallback (line 792), only extract from relational `modifierGroups`

### 4. Simplify Square catalog mapping types

**`square-catalog.service.ts`**:
- Remove `modifiers` field from `MappedMenuItem` interface
- Remove `MappedModifiers` type (the `{ groups: MappedModifierGroup[] }` wrapper)
- Keep `MappedModifierGroup` and `MappedModifierOption` — Square sync still needs these for ID resolution before converting to `ModifierGroupInput[]`
- `mapToMenuModels()` return: items no longer carry `modifiers`, modifier groups returned separately or as a dedicated field with the new structure

### 5. Prisma schema migration

- Remove `modifiers Json?` from `MenuItem` model
- Create migration: `ALTER TABLE MenuItem DROP COLUMN modifiers`

### 6. Seed data update

- `prisma/seed.ts`: Remove `modifiers` JSON from MenuItem creates
- Seed modifier data via direct `ModifierGroup` / `ModifierOption` / `MenuItemModifierGroup` inserts (or call `menuService.syncModifierGroups()`)

### 7. Test coverage

**New test files**:

- `__tests__/services/menu/syncModifierGroups.test.ts`
  - Creates modifier groups and options correctly
  - Replaces existing junction records on re-sync
  - Soft-deletes removed options
  - Handles empty groups array (clears all)
  - Works with and without transaction client

- `__tests__/services/square/syncCatalog-modifiers.test.ts`
  - Square sync writes modifier data via MenuService (no JSON)
  - External ID mappings are created correctly
  - Transaction consistency: modifier + mapping in same tx
  - MenuItem.create/update no longer includes `modifiers` field

- `__tests__/storefront/menu/parseModifierGroups.test.ts`
  - Parses relational modifier data correctly
  - Handles items with no modifiers
  - Price decimal conversion works

- `__tests__/services/menu/extractDashboardModifierGroups.test.ts`
  - Extracts from relational data correctly
  - Returns empty array when no modifier groups

## Files Changed

| File | Change |
|------|--------|
| `src/services/menu/menu.service.ts` | Promote `syncModifierGroups` to public with optional `tx`; remove JSON writes in create/update; remove JSON fallback in extract |
| `src/services/menu/menu.types.ts` | Add `PrismaTransactionClient` type if not present |
| `src/services/square/square.service.ts` | Remove JSON writes; replace inline modifier logic with `menuService.syncModifierGroups()` call |
| `src/services/square/square-catalog.service.ts` | Remove `modifiers` from `MappedMenuItem`; remove `MappedModifiers` type |
| `src/app/(storefront)/r/[merchantSlug]/menu/utils.ts` | Remove `StoredModifier`/`StoredModifierGroup` types; remove JSON fallback in `parseModifierGroups` |
| `prisma/schema.prisma` | Remove `modifiers Json?` from MenuItem |
| `prisma/migrations/...` | New migration to drop column |
| `prisma/seed.ts` | Update to use structured tables instead of JSON |
| `__tests__/...` (4 files) | New unit tests |

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Missed JSON read path | Grep for `\.modifiers` across codebase; the exploration found all paths |
| Existing data in `modifiers` column | Structured tables already have all data (dual-write has been active); column drop is safe |
| Transaction consistency in Square sync | `syncModifierGroups` accepts `tx` param; all operations share same transaction |
| Order history | `Order.items` JSON snapshots are independent; they store `selectedModifiers` not raw menu modifiers |
