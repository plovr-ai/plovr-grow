import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class MenuRepository {
  /**
   * Get all active categories with their items for a tenant
   */
  async getCategoriesWithItems(tenantId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        status: "active",
      },
      include: {
        menuItems: {
          where: {
            status: "active",
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    });
  }

  /**
   * Get a single category by ID
   */
  async getCategoryById(tenantId: string, categoryId: string) {
    return prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      include: {
        menuItems: {
          where: {
            status: "active",
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
  }

  /**
   * Get a single menu item by ID
   */
  async getItemById(tenantId: string, itemId: string) {
    return prisma.menuItem.findFirst({
      where: {
        id: itemId,
        tenantId,
      },
      include: {
        category: true,
      },
    });
  }

  /**
   * Get multiple menu items by IDs
   */
  async getItemsByIds(tenantId: string, itemIds: string[]) {
    return prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        tenantId,
        status: "active",
      },
    });
  }

  /**
   * Create a new category
   */
  async createCategory(
    tenantId: string,
    data: Omit<Prisma.MenuCategoryCreateInput, "tenant">
  ) {
    return prisma.menuCategory.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  /**
   * Update a category
   */
  async updateCategory(
    tenantId: string,
    categoryId: string,
    data: Prisma.MenuCategoryUpdateInput
  ) {
    return prisma.menuCategory.updateMany({
      where: {
        id: categoryId,
        tenantId,
      },
      data,
    });
  }

  /**
   * Create a new menu item
   */
  async createItem(
    tenantId: string,
    categoryId: string,
    data: Omit<Prisma.MenuItemCreateInput, "tenant" | "category">
  ) {
    return prisma.menuItem.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        category: { connect: { id: categoryId } },
      },
    });
  }

  /**
   * Update a menu item
   */
  async updateItem(
    tenantId: string,
    itemId: string,
    data: Prisma.MenuItemUpdateInput
  ) {
    return prisma.menuItem.updateMany({
      where: {
        id: itemId,
        tenantId,
      },
      data,
    });
  }

  /**
   * Delete a menu item (soft delete by setting status)
   */
  async deleteItem(tenantId: string, itemId: string) {
    return prisma.menuItem.updateMany({
      where: {
        id: itemId,
        tenantId,
      },
      data: {
        status: "inactive",
      },
    });
  }

  // ==================== Merchant-scoped methods ====================

  /**
   * Get all active categories with their items for a specific merchant
   */
  async getCategoriesWithItemsByMerchant(tenantId: string, merchantId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        merchantId,
        status: "active",
      },
      include: {
        menuItems: {
          where: {
            status: "active",
            merchantId,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    });
  }

  /**
   * Get a single menu item by ID (scoped to merchant)
   */
  async getItemByMerchant(
    tenantId: string,
    merchantId: string,
    itemId: string
  ) {
    return prisma.menuItem.findFirst({
      where: {
        id: itemId,
        tenantId,
        merchantId,
      },
      include: {
        category: true,
      },
    });
  }

  /**
   * Get multiple menu items by IDs (scoped to merchant)
   */
  async getItemsByIdsByMerchant(
    tenantId: string,
    merchantId: string,
    itemIds: string[]
  ) {
    return prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        tenantId,
        merchantId,
        status: "active",
      },
    });
  }
}

export const menuRepository = new MenuRepository();
