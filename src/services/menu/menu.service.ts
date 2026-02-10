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

export class MenuService {
  // ==================== Menu CRUD ====================

  /**
   * Get all menus for a company
   */
  async getMenus(tenantId: string, companyId: string): Promise<MenuInfo[]> {
    const { menuEntityRepository } = await getRepositories();
    const menus = await menuEntityRepository.getMenusByCompany(tenantId, companyId);
    return menus.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      sortOrder: m.sortOrder,
      status: m.status as "active" | "inactive",
    }));
  }

  /**
   * Create a new menu
   */
  async createMenu(tenantId: string, companyId: string, input: CreateMenuInput) {
    const { menuEntityRepository } = await getRepositories();
    return menuEntityRepository.createMenu(tenantId, companyId, input);
  }

  /**
   * Update a menu
   */
  async updateMenu(tenantId: string, menuId: string, input: UpdateMenuInput) {
    const { menuEntityRepository } = await getRepositories();
    return menuEntityRepository.updateMenu(tenantId, menuId, input);
  }

  /**
   * Delete (deactivate) a menu
   */
  async deleteMenu(tenantId: string, menuId: string) {
    const { menuEntityRepository } = await getRepositories();
    return menuEntityRepository.deleteMenu(tenantId, menuId);
  }

  /**
   * Count active menus for a company
   */
  async countMenus(tenantId: string, companyId: string) {
    const { menuEntityRepository } = await getRepositories();
    return menuEntityRepository.countMenusByCompany(tenantId, companyId);
  }

  // ==================== Menu Content ====================

  /**
   * Get menu for customer-facing display
   *
   * Populates tax information for each item based on:
   * 1. Menu item's associated tax configs
   * 2. Merchant's specific tax rates for those configs
   *
   * @param tenantId - Tenant ID for isolation
   * @param merchantId - Merchant ID (used to get companyId and merchant info)
   * @param menuId - Optional menu ID (defaults to first menu)
   */
  async getMenu(
    tenantId: string,
    merchantId: string,
    menuId?: string
  ): Promise<GetMenuResponse> {
    const { menuRepository, menuEntityRepository, merchantRepository, taxConfigRepository, featuredItemRepository } =
      await getRepositories();

    // Get merchant to find companyId
    const merchant = await merchantRepository.getById(merchantId);
    if (!merchant) {
      throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
    }

    // Get all active menus for the company
    const menus = await menuEntityRepository.getMenusByCompany(tenantId, merchant.companyId);
    if (menus.length === 0) {
      throw new AppError(ErrorCodes.MENU_NOT_FOUND, undefined, 404);
    }

    // Use provided menuId or default to first menu
    const currentMenuId =
      menuId && menus.some((m) => m.id === menuId) ? menuId : menus[0].id;

    // Fetch categories for the selected menu (with junction table)
    const categories = await menuRepository.getCategoriesWithItemsByMenu(
      tenantId,
      currentMenuId
    );

    // Get all item IDs from junction table structure
    const itemIds = categories.flatMap((c: { categoryItems: { menuItem: { id: string } }[] }) =>
      c.categoryItems.map((ci: { menuItem: { id: string } }) => ci.menuItem.id)
    );

    // Get tax config IDs for all items
    const itemTaxMap = await taxConfigRepository.getMenuItemsTaxConfigIds(itemIds);

    // Get all unique tax config IDs
    const allTaxConfigIds = [...new Set([...itemTaxMap.values()].flat())];

    // Get tax configs and merchant rates
    const [taxConfigs, merchantTaxRateMap] = await Promise.all([
      taxConfigRepository.getTaxConfigsByIds(tenantId, allTaxConfigIds),
      taxConfigRepository.getMerchantTaxRateMap(merchantId),
    ]);

    // Build tax config lookup map
    const taxConfigMap = new Map(taxConfigs.map((c) => [c.id, c]));

    // Enrich categories with tax info (flatten junction table structure)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedCategories = categories.map((category: any) => ({
      ...category,
      // Transform categoryItems to menuItems for API compatibility
      menuItems: category.categoryItems.map((ci: { menuItem: Record<string, unknown>; sortOrder: number }) => {
        const item = ci.menuItem;
        const taxConfigIds = itemTaxMap.get(item.id as string) || [];
        const taxes = taxConfigIds
          .map((taxId) => {
            const config = taxConfigMap.get(taxId);
            if (!config) return null;
            return {
              taxConfigId: taxId,
              name: config.name,
              rate: merchantTaxRateMap.get(taxId) || 0,
              roundingMethod: config.roundingMethod as RoundingMethod,
            };
          })
          .filter((t) => t !== null);

        return {
          ...item,
          sortOrder: ci.sortOrder,
          taxes,
        };
      }),
    }));

    // Remove categoryItems from response (already flattened to menuItems)
    enrichedCategories.forEach((c: { categoryItems?: unknown }) => delete c.categoryItems);

    // Add Featured category as first category (only for first menu)
    const isFirstMenu = currentMenuId === menus[0].id;
    let finalCategories = enrichedCategories;

    if (isFirstMenu) {
      const featuredItems = await featuredItemRepository.getByCompanyId(tenantId, merchant.companyId);

      // Only add Featured category if there are active featured items
      const activeFeaturedItems = featuredItems.filter(
        (fi) => fi.menuItem.status === "active"
      );

      if (activeFeaturedItems.length > 0) {
        // Get tax info for featured items
        const featuredItemIds = activeFeaturedItems.map((fi) => fi.menuItem.id);
        const featuredItemTaxMap = await taxConfigRepository.getMenuItemsTaxConfigIds(featuredItemIds);
        const featuredTaxConfigIds = [...new Set([...featuredItemTaxMap.values()].flat())];

        // Get any missing tax configs (not already fetched)
        const missingTaxConfigIds = featuredTaxConfigIds.filter(
          (id) => !taxConfigMap.has(id)
        );
        if (missingTaxConfigIds.length > 0) {
          const missingTaxConfigs = await taxConfigRepository.getTaxConfigsByIds(
            tenantId,
            missingTaxConfigIds
          );
          missingTaxConfigs.forEach((c) => taxConfigMap.set(c.id, c));
        }

        // Build featured menu items with tax info
        const featuredMenuItems = activeFeaturedItems.map((fi, index) => {
          const itemTaxConfigIds = featuredItemTaxMap.get(fi.menuItem.id) || [];
          const taxes = itemTaxConfigIds
            .map((taxId) => {
              const config = taxConfigMap.get(taxId);
              if (!config) return null;
              return {
                taxConfigId: taxId,
                name: config.name,
                rate: merchantTaxRateMap.get(taxId) || 0,
                roundingMethod: config.roundingMethod as RoundingMethod,
              };
            })
            .filter((t) => t !== null);

          return {
            id: fi.menuItem.id,
            tenantId,
            companyId: merchant.companyId,
            name: fi.menuItem.name,
            description: fi.menuItem.description,
            price: fi.menuItem.price,
            imageUrl: fi.menuItem.imageUrl,
            status: fi.menuItem.status,
            modifiers: fi.menuItem.modifiers,
            nutrition: fi.menuItem.nutrition,
            tags: fi.menuItem.tags,
            createdAt: new Date(),
            updatedAt: new Date(),
            sortOrder: index,
            taxes,
          };
        });

        // Create Featured category
        const featuredCategory = {
          id: "featured",
          tenantId,
          companyId: merchant.companyId,
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
    }

    return {
      menus: menus.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        sortOrder: m.sortOrder,
        status: m.status as "active" | "inactive",
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
  async getMenuItem(tenantId: string, itemId: string) {
    const { menuRepository } = await getRepositories();
    return menuRepository.getItemById(tenantId, itemId);
  }

  /**
   * Get menu items by IDs (for cart validation)
   *
   * @param tenantId - Tenant ID for isolation
   * @param merchantId - Merchant ID (used to get companyId)
   * @param itemIds - Array of menu item IDs to fetch
   */
  async getMenuItemsByIds(tenantId: string, merchantId: string, itemIds: string[]) {
    const { menuRepository, merchantRepository } = await getRepositories();

    const merchant = await merchantRepository.getById(merchantId);
    if (!merchant) {
      throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
    }

    return menuRepository.getItemsByIdsByCompany(tenantId, merchant.companyId, itemIds);
  }

  /**
   * Get menu items by IDs for a specific company (for featured items)
   *
   * @param tenantId - Tenant ID for isolation
   * @param companyId - Company ID
   * @param itemIds - Array of menu item IDs to fetch
   */
  async getMenuItemsByCompanyId(tenantId: string, companyId: string, itemIds: string[]) {
    const { menuRepository } = await getRepositories();
    return menuRepository.getItemsByIdsByCompany(tenantId, companyId, itemIds);
  }

  /**
   * Create a new category under a specific menu
   */
  async createCategory(
    tenantId: string,
    companyId: string,
    input: CreateCategoryInput
  ) {
    const { menuRepository } = await getRepositories();
    return menuRepository.createCategory(tenantId, companyId, input.menuId, {
      name: input.name,
      description: input.description,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder ?? 0,
    });
  }

  /**
   * Update a category
   */
  async updateCategory(
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
  async createMenuItem(
    tenantId: string,
    companyId: string,
    input: CreateMenuItemInput
  ) {
    const { menuRepository, menuCategoryItemRepository } = await getRepositories();

    // Create the menu item (without category association)
    const item = await menuRepository.createItem(tenantId, companyId, {
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      modifiers: input.modifierGroups ? JSON.parse(JSON.stringify(input.modifierGroups)) : null,
      tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : null,
    });

    // Link item to categories via junction table
    for (const categoryId of input.categoryIds) {
      const sortOrder = await menuCategoryItemRepository.getNextSortOrder(categoryId);
      await menuCategoryItemRepository.linkItemToCategory(categoryId, item.id, sortOrder);
    }

    return item;
  }

  /**
   * Update a menu item and optionally its category associations
   */
  async updateMenuItem(
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
    if (input.modifierGroups !== undefined)
      data.modifiers = JSON.parse(JSON.stringify(input.modifierGroups));
    if (input.tags !== undefined)
      data.tags = JSON.parse(JSON.stringify(input.tags));

    // Update item properties
    await menuRepository.updateItem(tenantId, itemId, data);

    // Update category associations if provided
    if (input.categoryIds !== undefined) {
      await menuCategoryItemRepository.setItemCategories(itemId, input.categoryIds);
    }
  }

  /**
   * Delete (deactivate) a menu item
   */
  async deleteMenuItem(tenantId: string, itemId: string) {
    const { menuRepository } = await getRepositories();
    return menuRepository.deleteItem(tenantId, itemId);
  }

  /**
   * Delete (deactivate) a category
   */
  async deleteCategory(tenantId: string, categoryId: string) {
    const { menuRepository } = await getRepositories();
    return menuRepository.deleteCategory(tenantId, categoryId);
  }

  /**
   * Batch update category sort orders
   */
  async updateCategorySortOrders(
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
  async updateMenuItemSortOrders(
    categoryId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ) {
    const { menuRepository } = await getRepositories();
    return menuRepository.updateItemSortOrders(categoryId, updates);
  }

  /**
   * Batch update menu sort orders
   */
  async updateMenuSortOrders(
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
   * @param companyId - Company ID
   * @param menuId - Optional menu ID (defaults to first menu)
   */
  async getMenuForDashboard(
    tenantId: string,
    companyId: string,
    menuId?: string,
    showArchived: boolean = false
  ): Promise<DashboardMenuResponse> {
    const { menuRepository, menuEntityRepository, taxConfigRepository, menuCategoryItemRepository } = await getRepositories();

    // Get all menus (including inactive) for dashboard
    const menus = await menuEntityRepository.getMenusByCompanyForDashboard(tenantId, companyId);

    // If no menus exist, create a default one
    if (menus.length === 0) {
      const defaultMenu = await menuEntityRepository.createMenu(tenantId, companyId, {
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
      status: category.status as "active" | "inactive",
      menuItems: category.categoryItems.map((ci): DashboardMenuItem => {
        const item = ci.menuItem;
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          price: Number(item.price),
          imageUrl: item.imageUrl,
          sortOrder: ci.sortOrder,
          status: item.status as "active" | "inactive" | "out_of_stock" | "archived",
          modifierGroups: (item.modifiers as unknown as ModifierGroupInput[]) || [],
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
        status: m.status as "active" | "inactive",
      })),
      currentMenuId,
      categories: dashboardCategories,
    };
  }

  /**
   * Set tax configs for a menu item
   */
  async setMenuItemTaxConfigs(itemId: string, taxConfigIds: string[]) {
    const { taxConfigRepository } = await getRepositories();
    return taxConfigRepository.setMenuItemTaxConfigs(itemId, taxConfigIds);
  }

  /**
   * Link an existing item to a category
   */
  async linkItemToCategory(
    tenantId: string,
    categoryId: string,
    itemId: string
  ) {
    const { menuCategoryItemRepository } = await getRepositories();
    const sortOrder = await menuCategoryItemRepository.getNextSortOrder(categoryId);
    return menuCategoryItemRepository.linkItemToCategory(categoryId, itemId, sortOrder);
  }

  /**
   * Unlink an item from a category (remove association only, not delete item)
   */
  async unlinkItemFromCategory(
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
  async getAvailableItems(
    tenantId: string,
    companyId: string,
    excludeCategoryId: string
  ): Promise<AvailableItem[]> {
    const { menuCategoryItemRepository } = await getRepositories();
    const items = await menuCategoryItemRepository.getItemsNotInCategory(
      tenantId,
      companyId,
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
  async countItemCategories(itemId: string): Promise<number> {
    const { menuCategoryItemRepository } = await getRepositories();
    return menuCategoryItemRepository.countItemCategories(itemId);
  }

  // ==================== Featured Items ====================

  /**
   * Get featured items for a company
   */
  async getFeaturedItems(
    tenantId: string,
    companyId: string
  ): Promise<FeaturedItemData[]> {
    const { featuredItemRepository } = await getRepositories();
    const items = await featuredItemRepository.getByCompanyId(tenantId, companyId);
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
  async setFeaturedItems(
    tenantId: string,
    companyId: string,
    menuItemIds: string[]
  ): Promise<void> {
    const { featuredItemRepository } = await getRepositories();
    await featuredItemRepository.setFeaturedItems(tenantId, companyId, menuItemIds);
  }

  /**
   * Add a single featured item
   */
  async addFeaturedItem(
    tenantId: string,
    companyId: string,
    menuItemId: string
  ): Promise<void> {
    const { featuredItemRepository } = await getRepositories();
    await featuredItemRepository.addFeaturedItem(tenantId, companyId, menuItemId);
  }

  /**
   * Remove a single featured item
   */
  async removeFeaturedItem(
    tenantId: string,
    companyId: string,
    menuItemId: string
  ): Promise<void> {
    const { featuredItemRepository } = await getRepositories();
    await featuredItemRepository.removeFeaturedItem(tenantId, companyId, menuItemId);
  }

  /**
   * Reorder featured items
   */
  async reorderFeaturedItems(
    tenantId: string,
    companyId: string,
    orderedMenuItemIds: string[]
  ): Promise<void> {
    const { featuredItemRepository } = await getRepositories();
    await featuredItemRepository.reorderFeaturedItems(tenantId, companyId, orderedMenuItemIds);
  }
}

export const menuService = new MenuService();
