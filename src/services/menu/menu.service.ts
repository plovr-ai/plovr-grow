import { getMockGetMenuResponse, mockGetMenuResponse } from "@/data/mock/menu-service";
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
   * Get menu for customer-facing display
   *
   * Interface: getMenu(tenantId, merchantId) - kept for compatibility
   * Implementation: Fetches Company-level menu via merchant's companyId
   *
   * Future extension: Can add merchant-level overrides (price, availability) here
   *
   * @param tenantId - Tenant ID for isolation
   * @param merchantId - Merchant ID (used to get companyId and merchant info)
   */
  async getMenu(tenantId: string, merchantId: string): Promise<GetMenuResponse> {
    // Temporarily use mock data until database is ready
    return getMockGetMenuResponse(tenantId, merchantId);

    // Database implementation (commented out for now):
    // const { menuRepository, merchantRepository } = await getRepositories();
    //
    // // Get merchant to find companyId
    // const merchant = await merchantRepository.getById(merchantId);
    // if (!merchant) {
    //   throw new Error("Merchant not found");
    // }
    //
    // // Fetch Company-level menu using companyId
    // const categories = await menuRepository.getCategoriesWithItemsByCompany(
    //   tenantId,
    //   merchant.companyId
    // );
    //
    // return {
    //   categories,
    //   merchantId,
    //   merchantName: merchant.name,
    //   merchantLogo: merchant.logoUrl || null,
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
   * TODO: Replace mock data with database implementation
   */
  async getMenuItemsByIds(_tenantId: string, itemIds: string[]) {
    // Temporarily use mock data until database is ready
    const allItems = mockGetMenuResponse.categories.flatMap((cat) => cat.menuItems);
    const uniqueItems = new Map(allItems.map((item) => [item.id, item]));
    return itemIds
      .map((id) => uniqueItems.get(id))
      .filter((item): item is NonNullable<typeof item> => item != null);

    // Database implementation (commented out for now):
    // const { menuRepository, merchantRepository } = await getRepositories();
    // const merchant = await merchantRepository.getById(merchantId);
    // if (!merchant) {
    //   throw new Error("Merchant not found");
    // }
    // return menuRepository.getItemsByIdsByCompany(tenantId, merchant.companyId, itemIds);
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
}

export const menuService = new MenuService();
