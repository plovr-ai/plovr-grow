import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class MenuRepository {
  // ==================== Company-scoped query methods ====================

  /**
   * Get all categories with all items for dashboard (no status filter)
   * Returns everything including inactive categories and items
   */
  async getCategoriesWithItemsForDashboard(tenantId: string, companyId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        companyId,
      },
      include: {
        menuItems: {
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
   * Get all active categories with their items for a company
   * All merchants under this company share the same menu
   */
  async getCategoriesWithItemsByCompany(tenantId: string, companyId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        companyId,
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
   * Get multiple menu items by IDs (company-scoped)
   */
  async getItemsByIdsByCompany(
    tenantId: string,
    companyId: string,
    itemIds: string[]
  ) {
    return prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        tenantId,
        companyId,
        status: "active",
      },
    });
  }

  // ==================== Create/Update methods ====================

  /**
   * Create a new category at company level
   */
  async createCategory(
    tenantId: string,
    companyId: string,
    data: Omit<Prisma.MenuCategoryCreateInput, "id" | "tenant" | "company">
  ) {
    return prisma.menuCategory.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
        tenant: { connect: { id: tenantId } },
        company: { connect: { id: companyId } },
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
   * Create a new menu item at company level
   */
  async createItem(
    tenantId: string,
    companyId: string,
    categoryId: string,
    data: Omit<Prisma.MenuItemCreateInput, "id" | "tenant" | "company" | "category">
  ) {
    return prisma.menuItem.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
        tenant: { connect: { id: tenantId } },
        company: { connect: { id: companyId } },
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

  /**
   * Delete a category (soft delete by setting status)
   */
  async deleteCategory(tenantId: string, categoryId: string) {
    return prisma.menuCategory.updateMany({
      where: {
        id: categoryId,
        tenantId,
      },
      data: {
        status: "inactive",
      },
    });
  }

  /**
   * Batch update category sort orders
   */
  async updateCategorySortOrders(
    tenantId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ) {
    const queries = updates.map((u) =>
      prisma.menuCategory.updateMany({
        where: {
          id: u.id,
          tenantId,
        },
        data: {
          sortOrder: u.sortOrder,
        },
      })
    );
    return prisma.$transaction(queries);
  }

  /**
   * Batch update menu item sort orders
   */
  async updateItemSortOrders(
    tenantId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ) {
    const queries = updates.map((u) =>
      prisma.menuItem.updateMany({
        where: {
          id: u.id,
          tenantId,
        },
        data: {
          sortOrder: u.sortOrder,
        },
      })
    );
    return prisma.$transaction(queries);
  }
}

export const menuRepository = new MenuRepository();
