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
 * Menu display data for UI rendering
 * Does not include currency/locale (provided by MerchantProvider)
 */
export interface MenuDisplayData {
  merchantName: string;
  merchantLogo: string | null;
  categories: MenuCategoryWithItemsViewModel[];
}

/**
 * Options stored in database JSON field
 */
interface StoredOptionGroup {
  id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  choices: {
    id: string;
    name: string;
    price: number;
  }[];
}

/**
 * Parse modifier groups from database JSON options
 */
function parseModifierGroups(
  options: Prisma.JsonValue | null
): ModifierGroupViewModel[] {
  if (!options || !Array.isArray(options)) {
    return [];
  }

  return (options as unknown as StoredOptionGroup[]).map((group) => ({
    id: group.id,
    name: group.name,
    required: group.required,
    minSelections: group.required ? 1 : 0,
    maxSelections: group.type === "single" ? 1 : group.choices.length,
    modifiers: group.choices.map(
      (choice, index): ModifierViewModel => ({
        id: choice.id,
        name: choice.name,
        price: choice.price,
        isDefault: index === 0 && group.required,
        isAvailable: true,
      })
    ),
  }));
}

/**
 * Convert GetMenuResponse (Prisma model) to MenuDisplayData (UI view model)
 */
export function convertToMenuDisplayData(
  response: GetMenuResponse
): MenuDisplayData {
  return {
    merchantName: response.merchantName,
    merchantLogo: response.merchantLogo,
    categories: response.categories.map(
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
            tags: ((item.tags as unknown as MenuItemTag[]) || []),
            hasModifiers: modifierGroups.length > 0,
            modifierGroups,
            isAvailable: item.status === "active",
            taxConfigId: null, // TODO: Add taxConfigId to Prisma schema if needed
          };
        }),
      })
    ),
  };
}
