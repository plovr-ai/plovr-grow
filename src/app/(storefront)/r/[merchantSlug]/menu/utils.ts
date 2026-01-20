import type { GetMenuResponse } from "@/services/menu";
import type {
  MenuCategoryWithItemsViewModel,
  MenuItemViewModel,
  ModifierGroupViewModel,
  ModifierViewModel,
  MenuItemTag,
} from "@/types/menu-page";
import type { Prisma } from "@prisma/client";

/**
 * Menu info with item count (for filtering empty menus)
 */
export interface MenuInfoWithItemCount {
  id: string;
  name: string;
  itemCount: number;
}

/**
 * Extended GetMenuResponse with itemCount for filtering
 */
export interface GetMenuResponseWithItemCount
  extends Omit<GetMenuResponse, "menus"> {
  menus: MenuInfoWithItemCount[];
}

/**
 * Menu info for UI rendering
 */
export interface MenuDisplayInfo {
  id: string;
  name: string;
}

/**
 * Menu display data for UI rendering
 * Does not include currency/locale or merchant info (provided by MerchantProvider)
 */
export interface MenuDisplayData {
  companySlug: string;
  menus: MenuDisplayInfo[];
  currentMenuId: string;
  categories: MenuCategoryWithItemsViewModel[];
}

/**
 * Modifier stored in database JSON field
 */
interface StoredModifier {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;
  isAvailable?: boolean;
  availabilityNote?: string;
}

/**
 * ModifierGroup stored in database JSON field
 */
interface StoredModifierGroup {
  id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  allowQuantity?: boolean;
  maxQuantityPerModifier?: number;
  modifiers: StoredModifier[];
  /** @deprecated Use modifiers instead */
  choices?: StoredModifier[];
}

/**
 * Parse modifier groups from database JSON options
 */
export function parseModifierGroups(
  options: Prisma.JsonValue | null
): ModifierGroupViewModel[] {
  if (!options || !Array.isArray(options)) {
    return [];
  }

  return (options as unknown as StoredModifierGroup[]).map((group) => {
    // 兼容旧数据：优先使用 modifiers，回退到 choices
    const modifiers = group.modifiers || group.choices || [];

    return {
      id: group.id,
      name: group.name,
      required: group.required,
      minSelections: group.required ? 1 : 0,
      maxSelections: group.type === "single" ? 1 : modifiers.length,
      allowQuantity: group.allowQuantity ?? false,
      maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1,
      modifiers: modifiers.map(
        (modifier, index): ModifierViewModel => ({
          id: modifier.id,
          name: modifier.name,
          price: modifier.price,
          isDefault: modifier.isDefault ?? (index === 0 && group.required),
          isAvailable: modifier.isAvailable ?? true,
          availabilityNote: modifier.availabilityNote,
        })
      ),
    };
  });
}

/**
 * Convert GetMenuResponse (Prisma model) to MenuDisplayData (UI view model)
 * Filters out empty categories and menus (with itemCount === 0)
 */
export function convertToMenuDisplayData(
  response: GetMenuResponseWithItemCount,
  companySlug: string
): MenuDisplayData {
  // 1. Convert and filter empty categories
  const filteredCategories = response.categories
    .map(
      (category): MenuCategoryWithItemsViewModel => ({
        category: {
          id: category.id,
          name: category.name,
          description: category.description,
          itemCount: category.menuItems.length,
        },
        items: category.menuItems.map((item): MenuItemViewModel => {
          const modifierGroups = parseModifierGroups(item.options);
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            price: Number(item.price),
            imageUrl: item.imageUrl,
            tags: (item.tags as unknown as MenuItemTag[]) || [],
            hasModifiers: modifierGroups.length > 0,
            modifierGroups,
            isAvailable: item.status === "active",
            taxes: item.taxes || [],
          };
        }),
      })
    )
    .filter((categoryData) => categoryData.items.length > 0);

  // 2. Filter empty menus (itemCount === 0)
  const filteredMenus = response.menus
    .filter((m) => m.itemCount > 0)
    .map((m) => ({ id: m.id, name: m.name }));

  return {
    companySlug,
    menus: filteredMenus,
    currentMenuId: response.currentMenuId,
    categories: filteredCategories,
  };
}
