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
        deleted: false,
      },
      include: {
        categoryItems: {
          where: {
            deleted: false,
            menuItem: {
              is: showArchived
                ? { status: "archived", deleted: false }
                : { status: { not: "archived" }, deleted: false },
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
   * Count active menu items across a set of menus in a single query.
   * Returns a Map of menuId -> total active item count, covering only menus
   * that have at least one active/out_of_stock item. Menus with no items are
   * simply absent from the map.
   *
   * Used by the storefront menu page to filter out empty menus without
   * re-fetching each menu's full content (fixes an N+1).
   */
  async countActiveItemsByMenuIds(
    tenantId: string,
    menuIds: string[]
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (menuIds.length === 0) return result;

    const categories = await prisma.menuCategory.findMany({
      where: {
        tenantId,
        menuId: { in: menuIds },
        status: "active",
        deleted: false,
      },
      select: {
        menuId: true,
        _count: {
          select: {
            categoryItems: {
              where: {
                deleted: false,
                menuItem: {
                  is: {
                    status: { in: ["active", "out_of_stock"] },
                    deleted: false,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const category of categories) {
      const prev = result.get(category.menuId) ?? 0;
      result.set(category.menuId, prev + category._count.categoryItems);
    }
    return result;
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
        deleted: false,
      },
      include: {
        categoryItems: {
          where: {
            deleted: false,
            menuItem: {
              is: {
                status: { in: ["active", "out_of_stock"] },
                deleted: false,
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

  // ==================== Tenant-scoped query methods (legacy) ====================

  /**
   * Get all categories with all items for dashboard (no status filter)
   * Returns everything including inactive categories and items
   * @deprecated Use getCategoriesWithItemsByMenuForDashboard instead
   */
  async getCategoriesWithItemsForDashboard(tenantId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        deleted: false,
      },
      include: {
        categoryItems: {
          where: {
            deleted: false,
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
   * Get all active categories with their items for a company
   * All merchants under this company share the same menu
   * @deprecated Use getCategoriesWithItemsByMenu instead
   */
  async getCategoriesWithItemsByCompany(tenantId: string) {
    return prisma.menuCategory.findMany({
      where: {
        tenantId,
        status: "active",
        deleted: false,
      },
      include: {
        categoryItems: {
          where: {
            deleted: false,
            menuItem: {
              is: {
                status: "active",
                deleted: false,
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
        deleted: false,
      },
      include: {
        categoryItems: {
          where: {
            deleted: false,
            menuItem: {
              is: {
                status: "active",
                deleted: false,
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
        deleted: false,
      },
      include: {
        categories: {
          where: {
            deleted: false,
          },
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
    itemIds: string[]
  ) {
    return prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        tenantId,
        status: "active",
        deleted: false,
      },
    });
  }

  // ==================== Create/Update methods ====================

  /**
   * Create a new category under a specific menu
   */
  async createCategory(
    tenantId: string,
    menuId: string,
    data: Omit<Prisma.MenuCategoryCreateInput, "id" | "tenant" | "menu">
  ) {
    return prisma.menuCategory.create({
      data: {
        id: generateEntityId(),
        ...data,
        tenant: { connect: { id: tenantId } },
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
    data: Omit<Prisma.MenuItemCreateInput, "id" | "tenant">
  ) {
    return prisma.menuItem.create({
      data: {
        id: generateEntityId(),
        ...data,
        tenant: { connect: { id: tenantId } },
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
   * Delete a menu item (soft delete)
   */
  async deleteItem(tenantId: string, itemId: string) {
    return prisma.menuItem.updateMany({
      where: {
        id: itemId,
        tenantId,
      },
      data: {
        status: "archived",
        deleted: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete a category (soft delete)
   */
  async deleteCategory(tenantId: string, categoryId: string) {
    return prisma.menuCategory.updateMany({
      where: {
        id: categoryId,
        tenantId,
      },
      data: {
        status: "inactive",
        deleted: true,
        updatedAt: new Date(),
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
  async getAllItemsByCompany(tenantId: string) {
    return prisma.menuItem.findMany({
      where: {
        tenantId,
        status: { in: ["active", "out_of_stock"] },
        deleted: false,
      },
      include: {
        categories: {
          where: {
            deleted: false,
          },
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
