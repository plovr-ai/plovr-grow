import type {
  GetMenuResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
  DashboardMenuResponse,
  DashboardCategory,
  DashboardMenuItem,
  ModifierGroupInput,
  MenuInfo,
  CreateMenuInput,
  UpdateMenuInput,
  AvailableItem,
  FeaturedItemData,
} from "./menu.types";
import type { RoundingMethod } from "./tax-config.types";
import type { DbClient } from "@/lib/db";
import { AppError, ErrorCodes } from "@/lib/errors";

// Lazy load repositories to avoid Prisma initialization at module load time
async function getRepositories() {
  const [
    { menuRepository },
    { menuEntityRepository },
    { merchantRepository },
    { taxConfigRepository },
    { menuCategoryItemRepository },
    { featuredItemRepository },
  ] = await Promise.all([
    import("@/repositories/menu.repository"),
    import("@/repositories/menu-entity.repository"),
    import("@/repositories/merchant.repository"),
    import("@/repositories/tax-config.repository"),
    import("@/repositories/menu-category-item.repository"),
    import("@/repositories/featured-item.repository"),
  ]);
  return { menuRepository, menuEntityRepository, merchantRepository, taxConfigRepository, menuCategoryItemRepository, featuredItemRepository };
}

// ==================== Menu CRUD ====================

/**
 * Get all menus for a company
 */
async function getMenus(tenantId: string): Promise<MenuInfo[]> {
  const { menuEntityRepository } = await getRepositories();
  const menus = await menuEntityRepository.getMenusByCompany(tenantId);
  return menus.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    sortOrder: m.sortOrder,
    status: m.status as MenuInfo["status"],
  }));
}

/**
 * Create a new menu
 */
async function createMenu(tenantId: string, input: CreateMenuInput) {
  const { menuEntityRepository } = await getRepositories();
  return menuEntityRepository.createMenu(tenantId, input);
}

/**
 * Update a menu
 */
async function updateMenu(tenantId: string, menuId: string, input: UpdateMenuInput) {
  const { menuEntityRepository } = await getRepositories();
  return menuEntityRepository.updateMenu(tenantId, menuId, input);
}

/**
 * Delete (deactivate) a menu
 */
async function deleteMenu(tenantId: string, menuId: string) {
  const { menuEntityRepository } = await getRepositories();
  return menuEntityRepository.deleteMenu(tenantId, menuId);
}

/**
 * Count active menus for a company
 */
async function countMenus(tenantId: string) {
  const { menuEntityRepository } = await getRepositories();
  return menuEntityRepository.countMenusByCompany(tenantId);
}

// ==================== Menu Content ====================

/**
 * Count active items per menu in a single query.
 * Returns a Map keyed by menuId; menus with zero items are omitted.
 */
async function countActiveItemsByMenuIds(
  tenantId: string,
  menuIds: string[]
): Promise<Map<string, number>> {
  const { menuRepository } = await getRepositories();
  return menuRepository.countActiveItemsByMenuIds(tenantId, menuIds);
}

/**
 * Count featured items whose underlying menu item is active.
 * getMenu() injects these as a synthetic "Featured" category on the first
 * menu, so the storefront menu switcher must include them when deciding
 * whether the first menu is empty.
 */
async function countActiveFeaturedItems(tenantId: string): Promise<number> {
  const { featuredItemRepository } = await getRepositories();
  return featuredItemRepository.countActiveByTenantId(tenantId);
}

/**
 * Get menu for customer-facing display
 *
 * Populates tax information for each item based on:
 * 1. Menu item's associated tax configs
 * 2. Merchant's specific tax rates for those configs
 *
 * @param tenantId - Tenant ID for isolation
 * @param merchantId - Merchant ID (used to get merchant info)
 * @param menuId - Optional menu ID (defaults to first menu)
 * @param options.preloadedMerchant - Optional already-fetched merchant record
 *   to avoid a duplicate DB query when the caller (e.g. the storefront page)
 *   already resolved the merchant via slug.
 */
async function getMenu(
  tenantId: string,
  merchantId: string,
  menuId?: string,
  options?: {
    preloadedMerchant?: {
      id: string;
      name: string;
      logoUrl: string | null;
    } | null;
  }
): Promise<GetMenuResponse> {
  const { menuRepository, menuEntityRepository, merchantRepository, taxConfigRepository, featuredItemRepository } =
    await getRepositories();

  // Fetch merchant (unless preloaded) and menus in parallel. Previously
  // these were serial AND the merchant was always refetched by id even when
  // the caller had just resolved it by slug.
  const [merchant, menus] = await Promise.all([
    options?.preloadedMerchant !== undefined
      ? Promise.resolve(options.preloadedMerchant)
      : merchantRepository.getById(merchantId),
    menuEntityRepository.getMenusByCompany(tenantId),
  ]);

  if (!merchant) {
    throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
  }

  if (menus.length === 0) {
    throw new AppError(ErrorCodes.MENU_NOT_FOUND, undefined, 404);
  }

  // Use provided menuId or default to first menu
  const currentMenuId =
    menuId && menus.some((m) => m.id === menuId) ? menuId : menus[0].id;
  const isFirstMenu = currentMenuId === menus[0].id;

  // Fetch categories and (only on the first menu) featured items in parallel.
  // Previously featured items were only fetched after categories resolved.
  const [categories, featuredItems] = await Promise.all([
    menuRepository.getCategoriesWithItemsByMenu(tenantId, currentMenuId),
    isFirstMenu
      ? featuredItemRepository.getByTenantId(tenantId)
      : Promise.resolve([] as Awaited<ReturnType<typeof featuredItemRepository.getByTenantId>>),
  ]);

  const activeFeaturedItems = featuredItems.filter(
    (fi) => fi.menuItem.status === "active"
  );

  // Get all item IDs from junction table structure
  const categoryItemIds = categories.flatMap(
    (c: { categoryItems: { menuItem: { id: string } }[] }) =>
      c.categoryItems.map((ci: { menuItem: { id: string } }) => ci.menuItem.id)
  );
  const featuredItemIds = activeFeaturedItems.map((fi) => fi.menuItem.id);
  const allItemIds = [...new Set([...categoryItemIds, ...featuredItemIds])];

  // Single tax-config-id lookup covering both categories and featured items.
  const itemTaxMap = await taxConfigRepository.getMenuItemsTaxConfigIds(allItemIds);

  // Get all unique tax config IDs
  const allTaxConfigIds = [...new Set([...itemTaxMap.values()].flat())];

  // Get tax configs and merchant rates
  const [taxConfigs, merchantTaxRateMap] = await Promise.all([
    taxConfigRepository.getTaxConfigsByIds(tenantId, allTaxConfigIds),
    taxConfigRepository.getMerchantTaxRateMap(merchantId),
  ]);

  // Build tax config lookup map
  const taxConfigMap = new Map(taxConfigs.map((c) => [c.id, c]));

  const buildTaxes = (itemId: string) =>
    (itemTaxMap.get(itemId) || [])
      .map((taxId) => {
        const config = taxConfigMap.get(taxId);
        if (!config) return null;
        return {
          taxConfigId: taxId,
          name: config.name,
          rate: merchantTaxRateMap.get(taxId) || 0,
          roundingMethod: config.roundingMethod as RoundingMethod,
          inclusionType: config.inclusionType,
        };
      })
      .filter((t) => t !== null);

  // Enrich categories with tax info (flatten junction table structure)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedCategories = categories.map((category: any) => ({
    ...category,
    // Transform categoryItems to menuItems for API compatibility
    menuItems: category.categoryItems.map((ci: { menuItem: Record<string, unknown>; sortOrder: number }) => {
      const item = ci.menuItem;
      return {
        ...item,
        sortOrder: ci.sortOrder,
        taxes: buildTaxes(item.id as string),
      };
    }),
  }));

  // Remove categoryItems from response (already flattened to menuItems)
  enrichedCategories.forEach((c: { categoryItems?: unknown }) => delete c.categoryItems);

  let finalCategories = enrichedCategories;

  if (isFirstMenu && activeFeaturedItems.length > 0) {
    // Build featured menu items with tax info
    const featuredMenuItems = activeFeaturedItems.map((fi, index) => ({
      id: fi.menuItem.id,
      tenantId,
      name: fi.menuItem.name,
      description: fi.menuItem.description,
      price: fi.menuItem.price,
      imageUrl: fi.menuItem.imageUrl,
      status: fi.menuItem.status,
      nutrition: fi.menuItem.nutrition,
      tags: fi.menuItem.tags,
      createdAt: new Date(),
      updatedAt: new Date(),
      sortOrder: index,
      taxes: buildTaxes(fi.menuItem.id),
    }));

    // Create Featured category
    const featuredCategory = {
      id: "featured",
      tenantId,
      menuId: currentMenuId,
      name: "Featured",
      description: null,
      imageUrl: null,
      sortOrder: -1, // Ensures it's first
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      menuItems: featuredMenuItems,
    };

    finalCategories = [featuredCategory, ...enrichedCategories];
  }

  return {
    menus: menus.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      sortOrder: m.sortOrder,
      status: m.status as MenuInfo["status"],
    })),
    currentMenuId,
    categories: finalCategories,
    merchantId,
    merchantName: merchant.name,
    merchantLogo: merchant.logoUrl || null,
  };
}

/**
 * Get a single menu item with full details
 */
async function getMenuItem(tenantId: string, itemId: string) {
  const { menuRepository } = await getRepositories();
  return menuRepository.getItemById(tenantId, itemId);
}

/**
 * Get menu items by IDs (for cart validation)
 *
 * @param tenantId - Tenant ID for isolation
 * @param merchantId - Merchant ID (used to validate merchant)
 * @param itemIds - Array of menu item IDs to fetch
 */
async function getMenuItemsByIds(tenantId: string, merchantId: string, itemIds: string[]) {
  const { menuRepository, merchantRepository } = await getRepositories();

  const merchant = await merchantRepository.getById(merchantId);
  if (!merchant) {
    throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
  }

  return menuRepository.getItemsByIdsByCompany(tenantId, itemIds);
}

/**
 * Get menu items by IDs for a tenant (for featured items)
 *
 * @param tenantId - Tenant ID for isolation
 * @param itemIds - Array of menu item IDs to fetch
 */
async function getMenuItemsByTenantId(tenantId: string, itemIds: string[]) {
  const { menuRepository } = await getRepositories();
  return menuRepository.getItemsByIdsByCompany(tenantId, itemIds);
}

/**
 * Create a new category under a specific menu
 */
async function createCategory(
  tenantId: string,
  input: CreateCategoryInput
) {
  const { menuRepository } = await getRepositories();
  return menuRepository.createCategory(tenantId, input.menuId, {
    name: input.name,
    description: input.description,
    imageUrl: input.imageUrl,
    sortOrder: input.sortOrder ?? 0,
  });
}

/**
 * Update a category
 */
async function updateCategory(
  tenantId: string,
  categoryId: string,
  input: UpdateCategoryInput
) {
  const { menuRepository } = await getRepositories();
  return menuRepository.updateCategory(tenantId, categoryId, input);
}

/**
 * Create a new menu item at company level and link to categories
 */
async function createMenuItem(
  tenantId: string,
  input: CreateMenuItemInput
) {
  const { menuRepository, menuCategoryItemRepository } = await getRepositories();

  // Create the menu item (without category association)
  const item = await menuRepository.createItem(tenantId, {
    name: input.name,
    description: input.description,
    price: input.price,
    imageUrl: input.imageUrl,
    tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : null,
  });

  // Link item to categories via junction table
  for (const categoryId of input.categoryIds) {
    const sortOrder = await menuCategoryItemRepository.getNextSortOrder(categoryId);
    await menuCategoryItemRepository.linkItemToCategory(tenantId, categoryId, item.id, sortOrder);
  }

  // Sync modifier groups to normalized tables
  if (input.modifierGroups && input.modifierGroups.length > 0) {
    await syncModifierGroups(tenantId, item.id, input.modifierGroups);
  }

  return item;
}

/**
 * Update a menu item and optionally its category associations
 */
async function updateMenuItem(
  tenantId: string,
  itemId: string,
  input: UpdateMenuItemInput
) {
  const { menuRepository, menuCategoryItemRepository } = await getRepositories();
  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.price !== undefined) data.price = input.price;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.status !== undefined) data.status = input.status;
  if (input.tags !== undefined)
    data.tags = JSON.parse(JSON.stringify(input.tags));

  // Update item properties
  await menuRepository.updateItem(tenantId, itemId, data);

  // Update category associations if provided
  if (input.categoryIds !== undefined) {
    await menuCategoryItemRepository.setItemCategories(tenantId, itemId, input.categoryIds);
  }

  // Sync modifier groups to normalized tables
  if (input.modifierGroups) {
    await syncModifierGroups(tenantId, itemId, input.modifierGroups);
  }
}

/**
 * Delete (deactivate) a menu item
 */
async function deleteMenuItem(tenantId: string, itemId: string) {
  const { menuRepository } = await getRepositories();
  return menuRepository.deleteItem(tenantId, itemId);
}

/**
 * Delete (deactivate) a category
 */
async function deleteCategory(tenantId: string, categoryId: string) {
  const { menuRepository } = await getRepositories();
  return menuRepository.deleteCategory(tenantId, categoryId);
}

/**
 * Batch update category sort orders
 */
async function updateCategorySortOrders(
  tenantId: string,
  updates: Array<{ id: string; sortOrder: number }>
) {
  const { menuRepository } = await getRepositories();
  return menuRepository.updateCategorySortOrders(tenantId, updates);
}

/**
 * Batch update menu item sort orders within a category
 * Sort orders are stored in the junction table
 */
async function updateMenuItemSortOrders(
  categoryId: string,
  updates: Array<{ id: string; sortOrder: number }>
) {
  const { menuRepository } = await getRepositories();
  return menuRepository.updateItemSortOrders(categoryId, updates);
}

/**
 * Batch update menu sort orders
 */
async function updateMenuSortOrders(
  tenantId: string,
  updates: Array<{ id: string; sortOrder: number }>
) {
  const { menuEntityRepository } = await getRepositories();
  return menuEntityRepository.updateMenuSortOrders(tenantId, updates);
}

/**
 * Get menu for Dashboard (includes all statuses)
 * Returns all categories and items without status filtering
 *
 * @param tenantId - Tenant ID for isolation
 * @param menuId - Optional menu ID (defaults to first menu)
 */
async function getMenuForDashboard(
  tenantId: string,
  menuId?: string,
  showArchived: boolean = false
): Promise<DashboardMenuResponse> {
  const { menuRepository, menuEntityRepository, taxConfigRepository, menuCategoryItemRepository } = await getRepositories();

  // Get all menus (including inactive) for dashboard
  const menus = await menuEntityRepository.getMenusByCompanyForDashboard(tenantId);

  // If no menus exist, create a default one
  if (menus.length === 0) {
    const defaultMenu = await menuEntityRepository.createMenu(tenantId, {
      name: "Main Menu",
      sortOrder: 0,
    });
    menus.push(defaultMenu);
  }

  // Use provided menuId or default to first menu
  const currentMenuId =
    menuId && menus.some((m) => m.id === menuId) ? menuId : menus[0].id;

  // Fetch categories for the selected menu (with junction table)
  const categories = await menuRepository.getCategoriesWithItemsByMenuForDashboard(
    tenantId,
    currentMenuId,
    showArchived
  );

  // Get all item IDs from junction table structure
  const itemIds = categories.flatMap((c) => c.categoryItems.map((ci) => ci.menuItem.id));

  // Get tax config IDs and category IDs for all items
  const [itemTaxMap, itemCategoryMap] = await Promise.all([
    taxConfigRepository.getMenuItemsTaxConfigIds(itemIds),
    menuCategoryItemRepository.getItemsCategoryIds(itemIds),
  ]);

  // Transform to dashboard types (flatten junction table structure)
  const dashboardCategories: DashboardCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    imageUrl: category.imageUrl,
    sortOrder: category.sortOrder,
    status: category.status as DashboardCategory["status"],
    menuItems: category.categoryItems.map((ci): DashboardMenuItem => {
      const item = ci.menuItem;
      // Prefer relational modifier data, fall back to JSON
      const modifierGroups = extractDashboardModifierGroups(item);
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        imageUrl: item.imageUrl,
        sortOrder: ci.sortOrder,
        status: item.status as DashboardMenuItem["status"],
        modifierGroups,
        tags: (item.tags as unknown as string[]) || [],
        taxConfigIds: itemTaxMap.get(item.id) || [],
        categoryIds: itemCategoryMap.get(item.id) || [],
      };
    }),
  }));

  return {
    menus: menus.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      sortOrder: m.sortOrder,
      status: m.status as MenuInfo["status"],
    })),
    currentMenuId,
    categories: dashboardCategories,
  };
}

/**
 * Set tax configs for a menu item
 */
async function setMenuItemTaxConfigs(tenantId: string, itemId: string, taxConfigIds: string[]) {
  const { taxConfigRepository } = await getRepositories();
  return taxConfigRepository.setMenuItemTaxConfigs(tenantId, itemId, taxConfigIds);
}

/**
 * Link an existing item to a category
 */
async function linkItemToCategory(
  tenantId: string,
  categoryId: string,
  itemId: string
) {
  const { menuCategoryItemRepository } = await getRepositories();
  const sortOrder = await menuCategoryItemRepository.getNextSortOrder(categoryId);
  return menuCategoryItemRepository.linkItemToCategory(tenantId, categoryId, itemId, sortOrder);
}

/**
 * Unlink an item from a category (remove association only, not delete item)
 */
async function unlinkItemFromCategory(
  tenantId: string,
  categoryId: string,
  itemId: string
) {
  const { menuCategoryItemRepository } = await getRepositories();
  return menuCategoryItemRepository.unlinkItemFromCategory(categoryId, itemId);
}

/**
 * Get items available to add to a category (not currently in that category)
 */
async function getAvailableItems(
  tenantId: string,
  excludeCategoryId: string
): Promise<AvailableItem[]> {
  const { menuCategoryItemRepository } = await getRepositories();
  const items = await menuCategoryItemRepository.getItemsNotInCategory(
    tenantId,
    excludeCategoryId
  );

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    imageUrl: item.imageUrl,
    categoryNames: item.categories.map((ci) => ci.category.name),
  }));
}

/**
 * Count how many categories an item belongs to
 */
async function countItemCategories(itemId: string): Promise<number> {
  const { menuCategoryItemRepository } = await getRepositories();
  return menuCategoryItemRepository.countItemCategories(itemId);
}

/**
 * Sync modifier groups from the dashboard form to normalized tables.
 * Replaces all modifier group associations for the given menu item.
 */
async function syncModifierGroups(
  tenantId: string,
  menuItemId: string,
  groups: ModifierGroupInput[],
  tx?: DbClient
): Promise<void> {
  const { default: prisma } = await import("@/lib/db");
  const db = tx ?? prisma;
  const { generateEntityId } = await import("@/lib/id");

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

/**
 * Extract modifier groups from a menu item, preferring relational data
 * over the legacy JSON field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDashboardModifierGroups(item: Record<string, any>): ModifierGroupInput[] {
  // If relational modifier groups are present (from Prisma include), use them
  const relationalGroups = item.modifierGroups;
  if (Array.isArray(relationalGroups) && relationalGroups.length > 0) {
    return relationalGroups.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (junction: any): ModifierGroupInput => {
        const group = junction.modifierGroup;
        const isSingle = group.maxSelect === 1;
        return {
          id: group.id,
          name: group.name,
          type: isSingle ? "single" : "multiple",
          required: group.required,
          allowQuantity: group.allowQuantity || undefined,
          maxQuantityPerModifier: group.allowQuantity
            ? group.maxQuantityPerModifier
            : undefined,
          modifiers: (group.options || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (opt: any) => ({
              id: opt.id,
              name: opt.name,
              price: Number(opt.price),
              isDefault: opt.isDefault,
              isAvailable: opt.isAvailable,
            })
          ),
        };
      }
    );
  }

  return [];
}

// ==================== Featured Items ====================

/**
 * Get featured items for a company
 */
async function getFeaturedItems(
  tenantId: string
): Promise<FeaturedItemData[]> {
  const { featuredItemRepository } = await getRepositories();
  const items = await featuredItemRepository.getByTenantId(tenantId);
  return items.map((item) => ({
    id: item.id,
    menuItemId: item.menuItemId,
    sortOrder: item.sortOrder,
    menuItem: {
      id: item.menuItem.id,
      name: item.menuItem.name,
      description: item.menuItem.description,
      price: Number(item.menuItem.price),
      imageUrl: item.menuItem.imageUrl,
      status: item.menuItem.status,
    },
  }));
}

/**
 * Set featured items for a company (replace all)
 */
async function setFeaturedItems(
  tenantId: string,
  menuItemIds: string[]
): Promise<void> {
  const { featuredItemRepository } = await getRepositories();
  await featuredItemRepository.setFeaturedItems(tenantId, menuItemIds);
}

/**
 * Add a single featured item
 */
async function addFeaturedItem(
  tenantId: string,
  menuItemId: string
): Promise<void> {
  const { featuredItemRepository } = await getRepositories();
  await featuredItemRepository.addFeaturedItem(tenantId, menuItemId);
}

/**
 * Remove a single featured item
 */
async function removeFeaturedItem(
  tenantId: string,
  menuItemId: string
): Promise<void> {
  const { featuredItemRepository } = await getRepositories();
  await featuredItemRepository.removeFeaturedItem(tenantId, menuItemId);
}

/**
 * Reorder featured items
 */
async function reorderFeaturedItems(
  tenantId: string,
  orderedMenuItemIds: string[]
): Promise<void> {
  const { featuredItemRepository } = await getRepositories();
  await featuredItemRepository.reorderFeaturedItems(tenantId, orderedMenuItemIds);
}

export const menuService = {
  getMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  countMenus,
  countActiveItemsByMenuIds,
  countActiveFeaturedItems,
  getMenu,
  getMenuItem,
  getMenuItemsByIds,
  getMenuItemsByTenantId,
  createCategory,
  updateCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  deleteCategory,
  updateCategorySortOrders,
  updateMenuItemSortOrders,
  updateMenuSortOrders,
  getMenuForDashboard,
  setMenuItemTaxConfigs,
  linkItemToCategory,
  unlinkItemFromCategory,
  getAvailableItems,
  countItemCategories,
  syncModifierGroups,
  getFeaturedItems,
  setFeaturedItems,
  addFeaturedItem,
  removeFeaturedItem,
  reorderFeaturedItems,
};
