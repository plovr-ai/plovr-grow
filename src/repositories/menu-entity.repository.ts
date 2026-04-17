import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export class MenuEntityRepository {
  // ==================== Query methods ====================

  /**
   * Get all active menus for a company (for Storefront)
   */
  async getMenusByCompany(tenantId: string) {
    return prisma.menu.findMany({
      where: {
        tenantId,
        status: "active",
        deleted: false,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });
  }

  /**
   * Get all menus for a company including inactive (for Dashboard)
   */
  async getMenusByCompanyForDashboard(tenantId: string) {
    return prisma.menu.findMany({
      where: {
        tenantId,
        deleted: false,
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
        deleted: false,
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
        deleted: false,
      },
      include: {
        categories: {
          where: {
            deleted: false,
          },
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
    data: { name: string; description?: string; sortOrder?: number }
  ) {
    // Calculate sortOrder if not provided - new menus should appear at the end
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxResult = await prisma.menu.aggregate({
        where: { tenantId, deleted: false },
        _max: { sortOrder: true },
      });
      sortOrder = (maxResult._max.sortOrder ?? -1) + 1;
    }

    return prisma.menu.create({
      data: {
        id: generateEntityId(),
        tenantId,
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
   * Delete a menu (soft delete)
   */
  async deleteMenu(tenantId: string, menuId: string) {
    return prisma.menu.updateMany({
      where: {
        id: menuId,
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
   * Hard delete a menu - now uses soft delete (sets deleted flag)
   */
  async hardDeleteMenu(tenantId: string, menuId: string) {
    return prisma.menu.updateMany({
      where: {
        id: menuId,
        tenantId,
      },
      data: {
        deleted: true,
        updatedAt: new Date(),
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
  async countMenusByCompany(tenantId: string) {
    return prisma.menu.count({
      where: {
        tenantId,
        status: "active",
        deleted: false,
      },
    });
  }

  /**
   * Find the first active menu for a tenant.
   * Used by the Square catalog sync pipeline to locate (or create) the
   * default menu that categories are attached to.
   */
  async findDefaultMenu(tenantId: string, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.menu.findFirst({
      where: { tenantId, deleted: false },
    });
  }

  /**
   * Create a default menu for a tenant when none exists yet.
   * Used by the Square catalog sync pipeline.
   */
  async createDefaultMenu(tenantId: string, name: string, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.menu.create({
      data: {
        id: generateEntityId(),
        tenantId,
        name,
        sortOrder: 0,
      },
    });
  }
}

export const menuEntityRepository = new MenuEntityRepository();
