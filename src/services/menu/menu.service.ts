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
} from "./menu.types";
import type { RoundingMethod } from "./tax-config.types";

// Lazy load repositories to avoid Prisma initialization at module load time
async function getRepositories() {
  const [{ menuRepository }, { merchantRepository }, { taxConfigRepository }] =
    await Promise.all([
      import("@/repositories/menu.repository"),
      import("@/repositories/merchant.repository"),
      import("@/repositories/tax-config.repository"),
    ]);
  return { menuRepository, merchantRepository, taxConfigRepository };
}

export class MenuService {
  /**
   * Get menu for customer-facing display
   *
   * Interface: getMenu(tenantId, merchantId) - kept for compatibility
   * Implementation: Fetches Company-level menu via merchant's companyId
   *
   * Populates tax information for each item based on:
   * 1. Menu item's associated tax configs
   * 2. Merchant's specific tax rates for those configs
   *
   * @param tenantId - Tenant ID for isolation
   * @param merchantId - Merchant ID (used to get companyId and merchant info)
   */
  async getMenu(tenantId: string, merchantId: string): Promise<GetMenuResponse> {
    const { menuRepository, merchantRepository, taxConfigRepository } =
      await getRepositories();

    // Get merchant to find companyId
    const merchant = await merchantRepository.getById(merchantId);
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    // Fetch Company-level menu using companyId
    const categories = await menuRepository.getCategoriesWithItemsByCompany(
      tenantId,
      merchant.companyId
    );

    // Get all item IDs
    const itemIds = categories.flatMap((c: { menuItems: { id: string }[] }) =>
      c.menuItems.map((i: { id: string }) => i.id)
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

    // Enrich categories with tax info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedCategories = categories.map((category: any) => ({
      ...category,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      menuItems: category.menuItems.map((item: any) => {
        const taxConfigIds = itemTaxMap.get(item.id) || [];
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
          taxes,
        };
      }),
    }));

    return {
      categories: enrichedCategories,
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
      throw new Error("Merchant not found");
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
   * Create a new category at company level
   */
  async createCategory(
    tenantId: string,
    companyId: string,
    input: CreateCategoryInput
  ) {
    const { menuRepository } = await getRepositories();
    return menuRepository.createCategory(tenantId, companyId, {
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
   * Create a new menu item at company level
   */
  async createMenuItem(
    tenantId: string,
    companyId: string,
    input: CreateMenuItemInput
  ) {
    const { menuRepository } = await getRepositories();
    return menuRepository.createItem(tenantId, companyId, input.categoryId, {
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder ?? 0,
      options: input.modifierGroups ? JSON.parse(JSON.stringify(input.modifierGroups)) : null,
      tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : null,
    });
  }

  /**
   * Update a menu item
   */
  async updateMenuItem(
    tenantId: string,
    itemId: string,
    input: UpdateMenuItemInput
  ) {
    const { menuRepository } = await getRepositories();
    const data: Record<string, unknown> = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.price !== undefined) data.price = input.price;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.status !== undefined) data.status = input.status;
    if (input.modifierGroups !== undefined)
      data.options = JSON.parse(JSON.stringify(input.modifierGroups));
    if (input.tags !== undefined)
      data.tags = JSON.parse(JSON.stringify(input.tags));

    return menuRepository.updateItem(tenantId, itemId, data);
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
   * Batch update menu item sort orders
   */
  async updateMenuItemSortOrders(
    tenantId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ) {
    const { menuRepository } = await getRepositories();
    return menuRepository.updateItemSortOrders(tenantId, updates);
  }

  /**
   * Get menu for Dashboard (includes all statuses)
   * Returns all categories and items without status filtering
   *
   * @param tenantId - Tenant ID for isolation
   * @param companyId - Company ID
   */
  async getMenuForDashboard(
    tenantId: string,
    companyId: string
  ): Promise<DashboardMenuResponse> {
    const { menuRepository, taxConfigRepository } = await getRepositories();

    // Fetch all categories with all items (no status filter)
    const categories = await menuRepository.getCategoriesWithItemsForDashboard(
      tenantId,
      companyId
    );

    // Get all item IDs
    const itemIds = categories.flatMap((c) => c.menuItems.map((i) => i.id));

    // Get tax config IDs for all items
    const itemTaxMap = await taxConfigRepository.getMenuItemsTaxConfigIds(itemIds);

    // Transform to dashboard types
    const dashboardCategories: DashboardCategory[] = categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      status: category.status as "active" | "inactive",
      menuItems: category.menuItems.map((item): DashboardMenuItem => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        imageUrl: item.imageUrl,
        sortOrder: item.sortOrder,
        status: item.status as "active" | "inactive" | "out_of_stock",
        modifierGroups: (item.options as unknown as ModifierGroupInput[]) || [],
        tags: (item.tags as unknown as string[]) || [],
        taxConfigIds: itemTaxMap.get(item.id) || [],
      })),
    }));

    return {
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
}

export const menuService = new MenuService();
