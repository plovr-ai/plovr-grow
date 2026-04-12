# Remove MenuItem.modifiers JSON Dual-Write Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy `MenuItem.modifiers` JSON field and consolidate all modifier persistence into structured `ModifierGroup`/`ModifierOption` tables.

**Architecture:** Promote `MenuService.syncModifierGroupsToTables()` to a public method accepting an optional Prisma transaction client. Remove all JSON writes/reads, update seed data to use structured tables, and drop the column via migration.

**Tech Stack:** TypeScript, Prisma ORM, Vitest, MySQL

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/menu/menu.service.ts` | Modify | Promote `syncModifierGroups` to public with optional `tx`; remove JSON writes in create/update; remove JSON fallback in `extractDashboardModifierGroups` |
| `src/services/square/square.service.ts` | Modify | Remove JSON writes in `syncCatalog`; replace inline modifier table logic (lines 296-418) with call to `menuService.syncModifierGroups()` |
| `src/services/square/square-catalog.service.ts` | Modify | Remove `modifiers` from `MappedMenuItem`; remove `MappedModifiers` type |
| `src/app/(storefront)/r/[merchantSlug]/menu/utils.ts` | Modify | Remove `StoredModifier`/`StoredModifierGroup`; simplify `parseModifierGroups` to only accept relational data |
| `src/app/(storefront)/r/[merchantSlug]/menu/__tests__/utils.test.ts` | Modify | Remove JSON-based tests; update remaining tests for new signature |
| `src/services/menu/__tests__/menu.service.test.ts` | Modify | Add tests for `syncModifierGroups` with/without tx; update create/update tests |
| `src/services/square/__tests__/square-catalog-sync.integration.test.ts` | Modify | Verify no JSON writes; verify `menuService.syncModifierGroups` is called |
| `prisma/schema.prisma` | Modify | Remove `modifiers Json?` from MenuItem |
| `prisma/migrations/YYYYMMDD_drop_modifiers_json/migration.sql` | Create | `ALTER TABLE menu_items DROP COLUMN modifiers` |
| `prisma/seed.ts` | Modify | Remove `modifiers` from seed items; add structured modifier table inserts |

---

### Task 1: Promote `syncModifierGroups` to public with transaction support

**Files:**
- Modify: `src/services/menu/menu.service.ts:663-751`

- [ ] **Step 1: Write failing test — syncModifierGroups accepts tx parameter**

Add to `src/services/menu/__tests__/menu.service.test.ts`:

```typescript
describe("syncModifierGroups", () => {
  it("should use provided transaction client when given", async () => {
    const mockTx = {
      menuItemModifierGroup: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({}) },
      modifierGroup: { upsert: vi.fn().mockResolvedValue({}) },
      modifierOption: { upsert: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };

    const groups = [
      {
        id: "group-1",
        name: "Size",
        type: "single" as const,
        required: true,
        modifiers: [
          { id: "opt-1", name: "Small", price: 0 },
          { id: "opt-2", name: "Large", price: 2 },
        ],
      },
    ];

    await menuService.syncModifierGroups("tenant-1", "item-1", groups, mockTx as never);

    expect(mockTx.menuItemModifierGroup.deleteMany).toHaveBeenCalledWith({ where: { menuItemId: "item-1" } });
    expect(mockTx.modifierGroup.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.modifierOption.upsert).toHaveBeenCalledTimes(2);
    expect(mockTx.menuItemModifierGroup.create).toHaveBeenCalledTimes(1);
    // Verify default prisma was NOT used
    const prisma = (await import("@/lib/db")).default;
    expect(prisma.menuItemModifierGroup.deleteMany).not.toHaveBeenCalled();
  });

  it("should fall back to default prisma when no tx provided", async () => {
    const prisma = (await import("@/lib/db")).default;
    vi.mocked(prisma.menuItemModifierGroup.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.modifierGroup.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.modifierOption.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.modifierOption.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.menuItemModifierGroup.create).mockResolvedValue({} as never);

    const groups = [
      {
        id: "group-1",
        name: "Size",
        type: "single" as const,
        required: true,
        modifiers: [{ id: "opt-1", name: "Small", price: 0 }],
      },
    ];

    await menuService.syncModifierGroups("tenant-1", "item-1", groups);

    expect(prisma.menuItemModifierGroup.deleteMany).toHaveBeenCalled();
    expect(prisma.modifierGroup.upsert).toHaveBeenCalled();
  });

  it("should clear all modifier groups when given empty array", async () => {
    const prisma = (await import("@/lib/db")).default;
    vi.mocked(prisma.menuItemModifierGroup.deleteMany).mockResolvedValue({ count: 0 });

    await menuService.syncModifierGroups("tenant-1", "item-1", []);

    expect(prisma.menuItemModifierGroup.deleteMany).toHaveBeenCalledWith({ where: { menuItemId: "item-1" } });
    expect(prisma.modifierGroup.upsert).not.toHaveBeenCalled();
  });

  it("should soft-delete removed options", async () => {
    const prisma = (await import("@/lib/db")).default;
    vi.mocked(prisma.menuItemModifierGroup.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.modifierGroup.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.modifierOption.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.modifierOption.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.menuItemModifierGroup.create).mockResolvedValue({} as never);

    const groups = [
      {
        id: "group-1",
        name: "Size",
        type: "single" as const,
        required: true,
        modifiers: [{ id: "opt-1", name: "Small", price: 0 }],
      },
    ];

    await menuService.syncModifierGroups("tenant-1", "item-1", groups);

    expect(prisma.modifierOption.updateMany).toHaveBeenCalledWith({
      where: {
        groupId: "group-1",
        id: { notIn: ["opt-1"] },
        deleted: false,
      },
      data: { deleted: true },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/services/menu/__tests__/menu.service.test.ts -t "syncModifierGroups"`
Expected: FAIL — `syncModifierGroups` is private

- [ ] **Step 3: Implement — promote to public, accept optional tx**

In `src/services/menu/menu.service.ts`, change `syncModifierGroupsToTables` to `syncModifierGroups`:

```typescript
  /**
   * Sync modifier groups to normalized tables.
   * Replaces all modifier group associations for the given menu item.
   * Accepts an optional Prisma transaction client for use within existing transactions.
   */
  async syncModifierGroups(
    tenantId: string,
    menuItemId: string,
    groups: ModifierGroupInput[],
    tx?: DbClient
  ): Promise<void> {
    const { default: prisma } = await import("@/lib/db");
    const { generateEntityId } = await import("@/lib/id");
    const db = tx ?? prisma;

    // Remove existing junction records
    await db.menuItemModifierGroup.deleteMany({
      where: { menuItemId },
    });

    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
      const group = groups[groupIdx];
      const groupId = group.id;

      // Upsert the modifier group
      await db.modifierGroup.upsert({
        where: { id: groupId },
        create: {
          id: groupId,
          tenantId,
          name: group.name,
          required: group.required,
          minSelect: group.required ? 1 : 0,
          maxSelect: group.type === "single" ? 1 : group.modifiers.length,
          allowQuantity: group.allowQuantity ?? false,
          maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1,
        },
        update: {
          name: group.name,
          required: group.required,
          minSelect: group.required ? 1 : 0,
          maxSelect: group.type === "single" ? 1 : group.modifiers.length,
          allowQuantity: group.allowQuantity ?? false,
          maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1,
          deleted: false,
        },
      });

      // Soft-delete existing options for this group that are no longer present
      const currentOptionIds = group.modifiers.map((m) => m.id);
      await db.modifierOption.updateMany({
        where: {
          groupId,
          id: { notIn: currentOptionIds },
          deleted: false,
        },
        data: { deleted: true },
      });

      // Upsert each option
      for (let optIdx = 0; optIdx < group.modifiers.length; optIdx++) {
        const mod = group.modifiers[optIdx];
        await db.modifierOption.upsert({
          where: { id: mod.id },
          create: {
            id: mod.id,
            tenantId,
            groupId,
            name: mod.name,
            price: mod.price,
            isDefault: mod.isDefault ?? false,
            isAvailable: mod.isAvailable ?? true,
            sortOrder: optIdx,
          },
          update: {
            name: mod.name,
            price: mod.price,
            isDefault: mod.isDefault ?? false,
            isAvailable: mod.isAvailable ?? true,
            sortOrder: optIdx,
            deleted: false,
          },
        });
      }

      // Create junction record
      await db.menuItemModifierGroup.create({
        data: {
          id: generateEntityId(),
          menuItemId,
          modifierGroupId: groupId,
          sortOrder: groupIdx,
        },
      });
    }
  }
```

Also update callers within `menu.service.ts`:
- `createMenuItem` line 417: `this.syncModifierGroupsToTables(...)` → `this.syncModifierGroups(...)`
- `updateMenuItem` line 454: `this.syncModifierGroupsToTables(...)` → `this.syncModifierGroups(...)`

Add import for `DbClient` at top of `menu.service.ts`:
```typescript
import type { DbClient } from "@/lib/db";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/services/menu/__tests__/menu.service.test.ts -t "syncModifierGroups"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-143
git add src/services/menu/menu.service.ts src/services/menu/__tests__/menu.service.test.ts
git commit -m "refactor(menu): promote syncModifierGroups to public with optional tx (#143)"
```

---

### Task 2: Remove JSON writes from MenuService create/update

**Files:**
- Modify: `src/services/menu/menu.service.ts:400-456`
- Modify: `src/services/menu/__tests__/menu.service.test.ts`

- [ ] **Step 1: Write failing test — createMenuItem no longer passes modifiers JSON**

Add to `src/services/menu/__tests__/menu.service.test.ts` in the `createMenuItem` describe block:

```typescript
it("should not pass modifiers JSON to repository", async () => {
  vi.mocked(menuRepository.createItem).mockResolvedValue({
    id: "new-item",
    tenantId: "tenant-1",
    name: "Test",
    price: new Prisma.Decimal(10),
  } as never);
  vi.mocked(menuCategoryItemRepository.getNextSortOrder).mockResolvedValue(0);
  vi.mocked(menuCategoryItemRepository.linkItemToCategory).mockResolvedValue({} as never);

  // Mock syncModifierGroups
  const syncSpy = vi.spyOn(menuService, "syncModifierGroups").mockResolvedValue();

  await menuService.createMenuItem("tenant-1", {
    categoryIds: ["cat-1"],
    name: "Test Item",
    price: 10,
    modifierGroups: [
      { id: "g1", name: "Size", type: "single", required: true, modifiers: [{ id: "o1", name: "S", price: 0 }] },
    ],
  });

  // Verify createItem was NOT called with modifiers field
  const createCall = vi.mocked(menuRepository.createItem).mock.calls[0];
  expect(createCall[1]).not.toHaveProperty("modifiers");

  // Verify syncModifierGroups was called instead
  expect(syncSpy).toHaveBeenCalledWith("tenant-1", "new-item", expect.any(Array));

  syncSpy.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/services/menu/__tests__/menu.service.test.ts -t "should not pass modifiers JSON to repository"`
Expected: FAIL — `createItem` still receives `modifiers` field

- [ ] **Step 3: Implement — remove JSON writes**

In `src/services/menu/menu.service.ts`:

`createMenuItem` — remove line 405:
```typescript
// REMOVE this line:
// modifiers: input.modifierGroups ? JSON.parse(JSON.stringify(input.modifierGroups)) : null,
```

`updateMenuItem` — remove lines 439-440:
```typescript
// REMOVE these lines:
// if (input.modifierGroups !== undefined)
//   data.modifiers = JSON.parse(JSON.stringify(input.modifierGroups));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/services/menu/__tests__/menu.service.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-143
git add src/services/menu/menu.service.ts src/services/menu/__tests__/menu.service.test.ts
git commit -m "refactor(menu): remove JSON writes from createMenuItem/updateMenuItem (#143)"
```

---

### Task 3: Remove JSON fallback from `extractDashboardModifierGroups`

**Files:**
- Modify: `src/services/menu/menu.service.ts:758-793`
- Modify: `src/services/menu/__tests__/menu.service.test.ts`

- [ ] **Step 1: Write failing test — extractDashboardModifierGroups only reads relational**

Add to `src/services/menu/__tests__/menu.service.test.ts`. Since `extractDashboardModifierGroups` is private, test it through `getDashboardMenuItem` or similar public method that calls it. If the method is only reachable through internal calls, test the behavior indirectly:

```typescript
describe("extractDashboardModifierGroups (via getDashboardMenuItem)", () => {
  it("should return empty array when no relational modifier groups and JSON modifiers exist", async () => {
    // This tests that we NO LONGER fall back to JSON
    const itemWithOnlyJsonModifiers = {
      id: "item-1",
      tenantId: "tenant-1",
      name: "Test",
      description: null,
      price: new Prisma.Decimal(10),
      imageUrl: null,
      sortOrder: 0,
      status: "active",
      modifiers: [{ id: "g1", name: "Size", type: "single", required: true, modifiers: [] }],
      tags: [],
      modifierGroups: [], // empty relational data
      categories: [{ id: "cat-1" }],
      menuItemTaxes: [],
    };

    vi.mocked(menuRepository.getItemById).mockResolvedValue(itemWithOnlyJsonModifiers as never);
    vi.mocked(menuCategoryItemRepository.getItemsCategoryIds).mockResolvedValue(["cat-1"]);
    vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue([]);

    const result = await menuService.getDashboardMenuItem("tenant-1", "item-1");

    // Should be empty — JSON fallback removed
    expect(result.modifierGroups).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/services/menu/__tests__/menu.service.test.ts -t "should return empty array when no relational"`
Expected: FAIL — currently falls back to JSON

- [ ] **Step 3: Implement — remove JSON fallback**

In `src/services/menu/menu.service.ts`, replace `extractDashboardModifierGroups`:

```typescript
  private extractDashboardModifierGroups(item: Record<string, unknown>): ModifierGroupInput[] {
    const relationalGroups = item.modifierGroups;
    if (!Array.isArray(relationalGroups) || relationalGroups.length === 0) {
      return [];
    }

    return relationalGroups.map(
      (junction: Record<string, unknown>): ModifierGroupInput => {
        const group = junction.modifierGroup as Record<string, unknown>;
        const isSingle = group.maxSelect === 1;
        return {
          id: group.id as string,
          name: group.name as string,
          type: isSingle ? "single" : "multiple",
          required: group.required as boolean,
          allowQuantity: (group.allowQuantity as boolean) || undefined,
          maxQuantityPerModifier: (group.allowQuantity as boolean)
            ? (group.maxQuantityPerModifier as number)
            : undefined,
          modifiers: ((group.options as Record<string, unknown>[]) || []).map(
            (opt) => ({
              id: opt.id as string,
              name: opt.name as string,
              price: Number(opt.price),
              isDefault: opt.isDefault as boolean,
              isAvailable: opt.isAvailable as boolean,
            })
          ),
        };
      }
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/services/menu/__tests__/menu.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-143
git add src/services/menu/menu.service.ts src/services/menu/__tests__/menu.service.test.ts
git commit -m "refactor(menu): remove JSON fallback from extractDashboardModifierGroups (#143)"
```

---

### Task 4: Simplify `parseModifierGroups` — remove JSON fallback

**Files:**
- Modify: `src/app/(storefront)/r/[merchantSlug]/menu/utils.ts:49-176`
- Modify: `src/app/(storefront)/r/[merchantSlug]/menu/__tests__/utils.test.ts`

- [ ] **Step 1: Update tests — remove JSON-only tests, update signature**

In `src/app/(storefront)/r/[merchantSlug]/menu/__tests__/utils.test.ts`:

Remove the entire `import type { Prisma } from "@prisma/client"` if present.

Replace the test file's `parseModifierGroups` tests. Remove:
- `describe("basic parsing")` — these test JSON parsing
- `describe("allowQuantity and maxQuantityPerModifier")` — JSON-only tests
- `describe("isDefault")` — JSON-only tests
- `describe("isAvailable and availabilityNote")` — JSON-only tests
- `describe("backward compatibility (choices field)")` — `choices` is JSON-only
- `describe("empty modifiers and choices")` — JSON-only
- `describe("complete modifier group parsing")` — JSON-only

Keep and update:
- `describe("relational modifier groups")` — update calls: `parseModifierGroups(null, groups)` → `parseModifierGroups(groups)`
- Add: test for empty array, test for undefined

Updated test for relational data (adjust call signatures — no more first `options` param):

```typescript
describe("parseModifierGroups", () => {
  it("should return empty array for undefined input", () => {
    expect(parseModifierGroups(undefined)).toEqual([]);
  });

  it("should return empty array for empty array", () => {
    expect(parseModifierGroups([])).toEqual([]);
  });

  it("should parse relational modifier groups", () => {
    const relationalGroups = [
      {
        sortOrder: 0,
        modifierGroup: {
          id: "mg-1",
          name: "Size",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          maxQuantityPerModifier: 1,
          options: [
            { id: "opt-1", name: "Small", price: 0, isDefault: true, isAvailable: true, sortOrder: 0 },
            { id: "opt-2", name: "Large", price: 2.5, isDefault: false, isAvailable: true, sortOrder: 1 },
          ],
        },
      },
    ];

    const result = parseModifierGroups(relationalGroups);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("mg-1");
    expect(result[0].name).toBe("Size");
    expect(result[0].required).toBe(true);
    expect(result[0].minSelections).toBe(1);
    expect(result[0].maxSelections).toBe(1);
    expect(result[0].modifiers).toHaveLength(2);
    expect(result[0].modifiers[0].price).toBe(0);
    expect(result[0].modifiers[1].price).toBe(2.5);
  });

  it("should handle Decimal price objects with toNumber()", () => {
    const relationalGroups = [
      {
        sortOrder: 0,
        modifierGroup: {
          id: "mg-1",
          name: "Size",
          required: false,
          minSelect: 0,
          maxSelect: 3,
          allowQuantity: true,
          maxQuantityPerModifier: 5,
          options: [
            { id: "opt-1", name: "Cheese", price: { toNumber: () => 1.5 }, isDefault: false, isAvailable: true, sortOrder: 0 },
          ],
        },
      },
    ];

    const result = parseModifierGroups(relationalGroups);

    expect(result[0].modifiers[0].price).toBe(1.5);
    expect(result[0].allowQuantity).toBe(true);
    expect(result[0].maxQuantityPerModifier).toBe(5);
  });

  it("should handle string price values via Number() fallback", () => {
    const relationalGroups = [
      {
        sortOrder: 0,
        modifierGroup: {
          id: "mg-1",
          name: "Test",
          required: false,
          minSelect: 0,
          maxSelect: 1,
          allowQuantity: false,
          maxQuantityPerModifier: 1,
          options: [
            { id: "opt-1", name: "Option", price: "2.50", isDefault: false, isAvailable: true, sortOrder: 0 },
          ],
        },
      },
    ];

    const result = parseModifierGroups(relationalGroups as never);

    expect(result[0].modifiers[0].price).toBe(2.5);
  });
});
```

Also update `convertToMenuDisplayData` tests: the test data at line 528 (`modifiers: null`) and line 589 (`modifiers: [...]`) no longer needs JSON modifiers on items. Update the call in `convertToMenuDisplayData` to match the new `parseModifierGroups` signature (see Task 4 Step 3 for the caller change).

- [ ] **Step 2: Run test to verify they fail**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/app/\(storefront\)/r/\[merchantSlug\]/menu/__tests__/utils.test.ts`
Expected: FAIL — signature mismatch

- [ ] **Step 3: Implement — simplify `parseModifierGroups`**

In `src/app/(storefront)/r/[merchantSlug]/menu/utils.ts`:

Remove `StoredModifier` (lines 50-57) and `StoredModifierGroup` (lines 62-72) interfaces.

Remove the `import type { Prisma } from "@prisma/client"` import if only used by the old parameter.

Replace `parseModifierGroups`:

```typescript
/**
 * Parse modifier groups from relational data.
 */
export function parseModifierGroups(
  relationalGroups?: RelationalMenuItemModifierGroup[]
): ModifierGroupViewModel[] {
  if (!relationalGroups || relationalGroups.length === 0) {
    return [];
  }

  return relationalGroups.map((junction) => {
    const group = junction.modifierGroup;
    return {
      id: group.id,
      name: group.name,
      required: group.required,
      minSelections: group.minSelect,
      maxSelections: group.maxSelect,
      allowQuantity: group.allowQuantity,
      maxQuantityPerModifier: group.maxQuantityPerModifier,
      modifiers: group.options.map(
        (opt): ModifierViewModel => ({
          id: opt.id,
          name: opt.name,
          price:
            typeof opt.price === "number"
              ? opt.price
              : typeof opt.price?.toNumber === "function"
                ? opt.price.toNumber()
                : Number(opt.price),
          isDefault: opt.isDefault,
          isAvailable: opt.isAvailable,
        })
      ),
    };
  });
}
```

Update the caller in `convertToMenuDisplayData` (around line 199):

```typescript
// Before:
// const modifierGroups = parseModifierGroups(item.modifiers, itemAny.modifierGroups);

// After:
const modifierGroups = parseModifierGroups(itemAny.modifierGroups);
```

Remove the `import type { Prisma } from "@prisma/client"` if no longer used.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/app/\(storefront\)/r/\[merchantSlug\]/menu/__tests__/utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-143
git add src/app/\(storefront\)/r/\[merchantSlug\]/menu/utils.ts src/app/\(storefront\)/r/\[merchantSlug\]/menu/__tests__/utils.test.ts
git commit -m "refactor(storefront): remove JSON fallback from parseModifierGroups (#143)"
```

---

### Task 5: Remove `modifiers` from Square catalog types and simplify `syncCatalog`

**Files:**
- Modify: `src/services/square/square-catalog.service.ts:35-54, 309`
- Modify: `src/services/square/square.service.ts:193-418`

- [ ] **Step 1: Write failing test — syncCatalog does not write modifiers JSON**

Add to `src/services/square/__tests__/square-catalog-sync.integration.test.ts` (or create a unit test if easier):

For unit testing, add to a new or existing square test file. Since this involves verifying no JSON field and checking `menuService.syncModifierGroups` is called, a unit test in `src/services/square/__tests__/square.test.ts` is appropriate:

```typescript
it("should not include modifiers JSON in menuItem upsert during syncCatalog", async () => {
  // After sync, verify that tx.menuItem.upsert was called WITHOUT modifiers field
  // This is checked by inspecting the mock calls
  // The existing mock setup already covers this — just add an assertion
  const upsertCalls = vi.mocked(mockTx.menuItem.upsert).mock.calls;
  for (const call of upsertCalls) {
    const createData = call[0].create;
    const updateData = call[0].update;
    expect(createData).not.toHaveProperty("modifiers");
    expect(updateData).not.toHaveProperty("modifiers");
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/services/square/__tests__/square.test.ts -t "should not include modifiers JSON"`
Expected: FAIL — upsert still includes `modifiers`

- [ ] **Step 3: Implement — remove modifiers from types and syncCatalog**

In `src/services/square/square-catalog.service.ts`:

Remove `MappedModifiers` interface (lines 35-37).

Remove `modifiers` from `MappedMenuItem` interface:
```typescript
// REMOVE: modifiers: MappedModifiers | null;
```

Add a new field for the modifier groups (kept separate from item):
```typescript
export interface MappedMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryExternalIds: string[];
  taxExternalIds: string[];
  modifierGroups: MappedModifierGroup[];  // was: modifiers: MappedModifiers | null
  variationMappings: {
    externalId: string;
    name: string;
    groupId?: string;
    optionId?: string;
  }[];
}
```

Update `mapToMenuModels` return (line 309):
```typescript
// Before:
// modifiers: groups.length > 0 ? { groups } : null,

// After:
modifierGroups: groups,
```

In `src/services/square/square.service.ts`:

Remove JSON writes from `menuItem.upsert` (lines 211-213 in create, lines 219-221 in update):
```typescript
// REMOVE from create:
// modifiers: item.modifiers ? JSON.parse(JSON.stringify(item.modifiers)) : null,

// REMOVE from update:
// modifiers: item.modifiers ? JSON.parse(JSON.stringify(item.modifiers)) : null,
```

Replace the inline modifier table logic (lines 296-418) with a call to `menuService.syncModifierGroups`. This requires:

1. Import `menuService`:
```typescript
import { menuService } from "@/services/menu";
```

2. Replace lines 296-418 with ID resolution + `menuService.syncModifierGroups()`:

```typescript
          // Persist modifier groups via MenuService
          if (item.modifierGroups.length > 0) {
            // Resolve external IDs to internal IDs
            const resolvedGroups: ModifierGroupInput[] = [];

            for (let groupIdx = 0; groupIdx < item.modifierGroups.length; groupIdx++) {
              const group = item.modifierGroups[groupIdx];

              // Determine a stable group ID via first option's external ID mapping
              const firstOptionExtId = group.options[0]?.externalId;
              let modifierGroupId: string | undefined;

              if (firstOptionExtId) {
                const existingOptionMapping =
                  await integrationRepository.getIdMappingByExternalId(
                    tenantId, "SQUARE", firstOptionExtId
                  );
                if (existingOptionMapping?.internalType === "ModifierOption") {
                  const existingOption = await tx.modifierOption.findUnique({
                    where: { id: existingOptionMapping.internalId },
                    select: { groupId: true },
                  });
                  if (existingOption) {
                    modifierGroupId = existingOption.groupId;
                  }
                }
              }

              if (!modifierGroupId) {
                modifierGroupId = generateEntityId();
              }

              // Resolve option IDs
              const resolvedModifiers: ModifierInput[] = [];
              for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
                const opt = group.options[optIdx];
                const existingOptMapping =
                  await integrationRepository.getIdMappingByExternalId(
                    tenantId, "SQUARE", opt.externalId
                  );
                const optionId =
                  (existingOptMapping?.internalType === "ModifierOption"
                    ? existingOptMapping?.internalId
                    : undefined) ?? generateEntityId();

                resolvedModifiers.push({
                  id: optionId,
                  name: opt.name,
                  price: opt.price,
                  isDefault: opt.isDefault,
                  isAvailable: true,
                });

                // Create ModifierOption external ID mapping
                await integrationRepository.upsertIdMapping(
                  tenantId,
                  {
                    internalType: "ModifierOption",
                    internalId: optionId,
                    externalSource: "SQUARE",
                    externalType: "MODIFIER",
                    externalId: opt.externalId,
                  },
                  tx
                );
              }

              resolvedGroups.push({
                id: modifierGroupId,
                name: group.name,
                type: group.maxSelect === 1 ? "single" : "multiple",
                required: group.required,
                modifiers: resolvedModifiers,
              });
            }

            await menuService.syncModifierGroups(tenantId, internalId, resolvedGroups, tx);
          }
```

Add the needed imports at the top of `square.service.ts`:
```typescript
import type { ModifierGroupInput, ModifierInput } from "@/services/menu/menu.types";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run src/services/square/__tests__/`
Expected: PASS (all square tests)

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-143
git add src/services/square/square-catalog.service.ts src/services/square/square.service.ts
git commit -m "refactor(square): remove modifiers JSON, use menuService.syncModifierGroups (#143)"
```

---

### Task 6: Prisma schema migration — drop `modifiers` column

**Files:**
- Modify: `prisma/schema.prisma:123`
- Create: `prisma/migrations/YYYYMMDDHHMMSS_drop_menu_item_modifiers_json/migration.sql`

- [ ] **Step 1: Remove field from schema**

In `prisma/schema.prisma`, remove line 123:
```prisma
  modifiers     Json?
```

- [ ] **Step 2: Create migration**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx prisma migrate dev --name drop_menu_item_modifiers_json --create-only`

This will create the migration SQL. Verify it contains:
```sql
ALTER TABLE `menu_items` DROP COLUMN `modifiers`;
```

- [ ] **Step 3: Generate Prisma client**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx prisma generate`
Expected: Prisma Client generated successfully

- [ ] **Step 4: Run type check**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx tsc --noEmit`
Expected: No type errors (all `modifiers` JSON references should already be removed in earlier tasks)

- [ ] **Step 5: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-143
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore(prisma): drop MenuItem.modifiers JSON column (#143)"
```

---

### Task 7: Update seed data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Extract modifier data from seed items**

In `prisma/seed.ts`, the `menuItems` array includes a `modifiers` field on each item. This field will no longer exist on the Prisma model after the migration. Transform the seed to:

1. Remove `modifiers` from the menuItems array entries
2. After creating menuItems, create the modifier data via direct Prisma calls to `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`

Define a helper type and data structure for the seed modifiers:

```typescript
interface SeedModifierGroup {
  id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  allowQuantity?: boolean;
  maxQuantityPerModifier?: number;
  modifiers: {
    id: string;
    name: string;
    price: number;
    isDefault?: boolean;
  }[];
}

interface SeedItemModifiers {
  menuItemId: string;
  groups: SeedModifierGroup[];
}
```

Create the modifier associations data (example for the pizza items that have modifiers) as a separate array after `menuItems`:

```typescript
const itemModifiers: SeedItemModifiers[] = [
  {
    menuItemId: "item-cheese-pizza",
    groups: [
      {
        id: "size", name: "Size", type: "single", required: true,
        modifiers: [
          { id: "size-s", name: 'Small (10")', price: 0, isDefault: true },
          { id: "size-m", name: 'Medium (14")', price: 4 },
          { id: "size-l", name: 'Large (18")', price: 8 },
        ],
      },
      {
        id: "toppings", name: "Extra Toppings", type: "multiple", required: false,
        allowQuantity: true, maxQuantityPerModifier: 3,
        modifiers: [
          { id: "topping-pepperoni", name: "Pepperoni", price: 2 },
          { id: "topping-mushrooms", name: "Mushrooms", price: 1.5 },
          { id: "topping-olives", name: "Black Olives", price: 1.5 },
        ],
      },
    ],
  },
  // ... remaining items with modifiers (coffee drinks with size/milk, etc.)
];
```

Then after the menuItem upsert loop, add:

```typescript
// Create modifier groups, options, and junction records
for (const itemMod of itemModifiers) {
  for (let groupIdx = 0; groupIdx < itemMod.groups.length; groupIdx++) {
    const group = itemMod.groups[groupIdx];
    const groupId = `${itemMod.menuItemId}-${group.id}`;

    await prisma.modifierGroup.upsert({
      where: { id: groupId },
      update: {
        name: group.name,
        required: group.required,
        minSelect: group.required ? 1 : 0,
        maxSelect: group.type === "single" ? 1 : group.modifiers.length,
        allowQuantity: group.allowQuantity ?? false,
        maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1,
      },
      create: {
        id: groupId,
        tenantId: tenant.id,
        name: group.name,
        required: group.required,
        minSelect: group.required ? 1 : 0,
        maxSelect: group.type === "single" ? 1 : group.modifiers.length,
        allowQuantity: group.allowQuantity ?? false,
        maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1,
      },
    });

    for (let optIdx = 0; optIdx < group.modifiers.length; optIdx++) {
      const mod = group.modifiers[optIdx];
      const optionId = `${groupId}-${mod.id}`;

      await prisma.modifierOption.upsert({
        where: { id: optionId },
        update: {
          name: mod.name,
          price: mod.price,
          isDefault: mod.isDefault ?? false,
          sortOrder: optIdx,
        },
        create: {
          id: optionId,
          tenantId: tenant.id,
          groupId,
          name: mod.name,
          price: mod.price,
          isDefault: mod.isDefault ?? false,
          isAvailable: true,
          sortOrder: optIdx,
        },
      });
    }

    await prisma.menuItemModifierGroup.upsert({
      where: {
        menuItemId_modifierGroupId: {
          menuItemId: itemMod.menuItemId,
          modifierGroupId: groupId,
        },
      },
      update: { sortOrder: groupIdx },
      create: {
        id: `mimg-${groupId}`,
        menuItemId: itemMod.menuItemId,
        modifierGroupId: groupId,
        sortOrder: groupIdx,
      },
    });
  }
}

console.log("Created modifier groups and options");
```

- [ ] **Step 2: Also handle Bella Bakery seed items**

Repeat the same pattern for Bella Bakery items (latte, cappuccino, drip coffee with size/milk modifiers). Add their entries to `itemModifiers` array.

- [ ] **Step 3: Verify seed runs**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-143
git add prisma/seed.ts
git commit -m "refactor(seed): use structured modifier tables instead of JSON (#143)"
```

---

### Task 8: Final verification — type check, lint, full test suite

**Files:** All modified files

- [ ] **Step 1: Type check**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Lint**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npm run lint`
Expected: No errors

- [ ] **Step 3: Full test suite**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-143 && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Grep for any remaining references to MenuItem.modifiers JSON**

Run: `grep -rn '\.modifiers' src/ --include='*.ts' | grep -v 'modifierGroups' | grep -v 'selectedModifiers' | grep -v 'node_modules' | grep -v '.test.ts'`

Verify no remaining references to the old JSON `modifiers` field on MenuItem (exclude `modifierGroups` relation and `selectedModifiers` in cart/order).

- [ ] **Step 5: Fix any remaining issues found in Step 4**

If any references remain, update them to use the relational `modifierGroups` data.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-143
git add -A
git commit -m "fix: clean up remaining modifiers JSON references (#143)"
```
