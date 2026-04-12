import type { GetMenuResponse } from "@/services/menu";
import type {
  MenuCategoryWithItemsViewModel,
  MenuItemViewModel,
  ModifierGroupViewModel,
  ModifierViewModel,
  MenuItemTag,
} from "@/types/menu-page";
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
 * Relational modifier option from Prisma include
 */
interface RelationalModifierOption {
  id: string;
  name: string;
  price: { toNumber?: () => number } | number;
  isDefault: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

/**
 * Relational modifier group from Prisma include
 */
interface RelationalModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  allowQuantity: boolean;
  maxQuantityPerModifier: number;
  options: RelationalModifierOption[];
}

/**
 * Junction record from MenuItemModifierGroup include
 */
interface RelationalMenuItemModifierGroup {
  sortOrder: number;
  modifierGroup: RelationalModifierGroup;
}

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const itemAny = item as Record<string, any>;
          const modifierGroups = parseModifierGroups(
            itemAny.modifierGroups
          );
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
