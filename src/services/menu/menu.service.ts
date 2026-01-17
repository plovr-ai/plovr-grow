import { getMockGetMenuResponse } from "@/data/mock/menu-service";
import type {
  GetMenuResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "./menu.types";

// Lazy load repositories to avoid Prisma initialization at module load time
async function getRepositories() {
  const [{ menuRepository }, { merchantRepository }] = await Promise.all([
    import("@/repositories/menu.repository"),
    import("@/repositories/merchant.repository"),
  ]);
  return { menuRepository, merchantRepository };
}

export class MenuService {
  /**
   * Get full menu for customer-facing display
   * @param tenantId - Tenant ID for isolation
   * @param merchantId - Merchant ID for store-specific menu
   * TODO: Replace mock data with database implementation
   */
  async getMenu(tenantId: string, merchantId: string): Promise<GetMenuResponse> {
    // Temporarily use mock data until database is ready
    return getMockGetMenuResponse(tenantId, merchantId);

    // Database implementation (commented out for now):
    // const { menuRepository, merchantRepository } = await getRepositories();
    // const [categories, merchant] = await Promise.all([
    //   menuRepository.getCategoriesWithItemsByMerchant(tenantId, merchantId),
    //   merchantRepository.getById(merchantId),
    // ]);
    // return {
    //   categories,
    //   merchantId,
    //   merchantName: merchant?.name || "",
    //   merchantLogo: merchant?.logoUrl || null,
    // };
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
   */
  async getMenuItemsByIds(tenantId: string, itemIds: string[]) {
    const { menuRepository } = await getRepositories();
    return menuRepository.getItemsByIds(tenantId, itemIds);
  }

  /**
   * Create a new category
   */
  async createCategory(tenantId: string, input: CreateCategoryInput) {
    const { menuRepository } = await getRepositories();
    return menuRepository.createCategory(tenantId, {
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
   * Create a new menu item
   */
  async createMenuItem(tenantId: string, input: CreateMenuItemInput) {
    const { menuRepository } = await getRepositories();
    return menuRepository.createItem(tenantId, input.categoryId, {
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder ?? 0,
      options: input.options ? JSON.parse(JSON.stringify(input.options)) : null,
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
    if (input.options !== undefined)
      data.options = JSON.parse(JSON.stringify(input.options));
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
}

export const menuService = new MenuService();
