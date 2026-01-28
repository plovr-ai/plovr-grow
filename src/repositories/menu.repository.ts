import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export class MenuRepository {
  // ==================== Menu-scoped query methods ====================

  /**
   * Get all categories with all items for a specific menu (Dashboard)
   * Returns everything including inactive categories and items
   * Uses junction table for N:M relationship
   */
  async getCategoriesWithItemsByMenuForDashboard(
    tenantId: string,
    menuId: string,
    showArchived: boolean = false
  ) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        menuId,
      },
      include: {
        categoryItems: {
          where: {
            menuItem: {
              is: showArchived
                ? { status: "archived" }
                : { status: { not: "archived" } },
            },
          },
          include: {
            menuItem: true,
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
   * Get all active categories with their items for a specific menu (Storefront)
   * Uses junction table for N:M relationship
   */
  async getCategoriesWithItemsByMenu(tenantId: string, menuId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        menuId,
        status: "active",
      },
      include: {
        categoryItems: {
          where: {
            menuItem: {
              is: {
                status: { in: ["active", "out_of_stock"] },
              },
            },
          },
          include: {
            menuItem: true,
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

  // ==================== Company-scoped query methods (legacy) ====================

  /**
   * Get all categories with all items for dashboard (no status filter)
   * Returns everything including inactive categories and items
   * @deprecated Use getCategoriesWithItemsByMenuForDashboard instead
   */
  async getCategoriesWithItemsForDashboard(tenantId: string, companyId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        companyId,
      },
      include: {
        categoryItems: {
          include: {
            menuItem: true,
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
   * Get all active categories with their items for a company
   * All merchants under this company share the same menu
   * @deprecated Use getCategoriesWithItemsByMenu instead
   */
  async getCategoriesWithItemsByCompany(tenantId: string, companyId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        companyId,
        status: "active",
      },
      include: {
        categoryItems: {
          where: {
            menuItem: {
              is: {
                status: "active",
              },
            },
          },
          include: {
            menuItem: true,
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
   * Get a single category by ID with its items
   */
  async getCategoryById(tenantId: string, categoryId: string) {
    return prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      include: {
        categoryItems: {
          where: {
            menuItem: {
              is: {
                status: "active",
              },
            },
          },
          include: {
            menuItem: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
  }

  /**
   * Get a single menu item by ID with its category associations
   */
  async getItemById(tenantId: string, itemId: string) {
    return prisma.menuItem.findFirst({
      where: {
        id: itemId,
        tenantId,
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
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
   * Create a new category under a specific menu
   */
  async createCategory(
    tenantId: string,
    companyId: string,
    menuId: string,
    data: Omit<Prisma.MenuCategoryCreateInput, "id" | "tenant" | "company" | "menu">
  ) {
    return prisma.menuCategory.create({
      data: {
        id: generateEntityId(),
        ...data,
        tenant: { connect: { id: tenantId } },
        company: { connect: { id: companyId } },
        menu: { connect: { id: menuId } },
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
   * Note: Item-category associations are managed separately via MenuCategoryItemRepository
   */
  async createItem(
    tenantId: string,
    companyId: string,
    data: Omit<Prisma.MenuItemCreateInput, "id" | "tenant" | "company">
  ) {
    return prisma.menuItem.create({
      data: {
        id: generateEntityId(),
        ...data,
        tenant: { connect: { id: tenantId } },
        company: { connect: { id: companyId } },
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
        status: "archived",
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
   * Batch update menu item sort orders within a category
   * Sort orders are now stored in the junction table (MenuCategoryItem)
   */
  async updateItemSortOrders(
    categoryId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ) {
    const queries = updates.map((u) =>
      prisma.menuCategoryItem.updateMany({
        where: {
          categoryId,
          menuItemId: u.id,
        },
        data: {
          sortOrder: u.sortOrder,
        },
      })
    );
    return prisma.$transaction(queries);
  }

  /**
   * Get all active items for a company (item pool for "Add Existing" feature)
   */
  async getAllItemsByCompany(tenantId: string, companyId: string) {
    return prisma.menuItem.findMany({
      where: {
        tenantId,
        companyId,
        status: { in: ["active", "out_of_stock"] },
      },
      include: {
        categories: {
          include: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }
}

export const menuRepository = new MenuRepository();
