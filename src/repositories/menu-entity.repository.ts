import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export class MenuEntityRepository {
  // ==================== Query methods ====================

  /**
   * Get all active menus for a company (for Storefront)
   */
  async getMenusByCompany(tenantId: string, companyId: string) {
    return prisma.menu.findMany({
      where: {
        tenantId,
        companyId,
        status: "active",
      },
      orderBy: {
        sortOrder: "asc",
      },
    });
  }

  /**
   * Get all menus for a company including inactive (for Dashboard)
   */
  async getMenusByCompanyForDashboard(tenantId: string, companyId: string) {
    return prisma.menu.findMany({
      where: {
        tenantId,
        companyId,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });
  }

  /**
   * Get a single menu by ID
   */
  async getMenuById(tenantId: string, menuId: string) {
    return prisma.menu.findFirst({
      where: {
        id: menuId,
        tenantId,
      },
    });
  }

  /**
   * Get menu with categories
   */
  async getMenuWithCategories(tenantId: string, menuId: string) {
    return prisma.menu.findFirst({
      where: {
        id: menuId,
        tenantId,
      },
      include: {
        categories: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
  }

  // ==================== CRUD methods ====================

  /**
   * Create a new menu
   */
  async createMenu(
    tenantId: string,
    companyId: string,
    data: { name: string; description?: string; sortOrder?: number }
  ) {
    // Calculate sortOrder if not provided - new menus should appear at the end
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxResult = await prisma.menu.aggregate({
        where: { tenantId, companyId },
        _max: { sortOrder: true },
      });
      sortOrder = (maxResult._max.sortOrder ?? -1) + 1;
    }

    return prisma.menu.create({
      data: {
        id: generateEntityId(),
        tenantId,
        companyId,
        name: data.name,
        description: data.description,
        sortOrder,
      },
    });
  }

  /**
   * Update a menu
   */
  async updateMenu(
    tenantId: string,
    menuId: string,
    data: Prisma.MenuUpdateInput
  ) {
    return prisma.menu.updateMany({
      where: {
        id: menuId,
        tenantId,
      },
      data,
    });
  }

  /**
   * Delete a menu (soft delete by setting status to inactive)
   */
  async deleteMenu(tenantId: string, menuId: string) {
    return prisma.menu.updateMany({
      where: {
        id: menuId,
        tenantId,
      },
      data: {
        status: "inactive",
      },
    });
  }

  /**
   * Hard delete a menu (use with caution)
   */
  async hardDeleteMenu(tenantId: string, menuId: string) {
    return prisma.menu.deleteMany({
      where: {
        id: menuId,
        tenantId,
      },
    });
  }

  /**
   * Batch update menu sort orders
   */
  async updateMenuSortOrders(
    tenantId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ) {
    const queries = updates.map((u) =>
      prisma.menu.updateMany({
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
   * Count menus for a company (to check if it's the last one)
   */
  async countMenusByCompany(tenantId: string, companyId: string) {
    return prisma.menu.count({
      where: {
        tenantId,
        companyId,
        status: "active",
      },
    });
  }
}

export const menuEntityRepository = new MenuEntityRepository();
