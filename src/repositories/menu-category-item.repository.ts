import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export class MenuCategoryItemRepository {
  /**
   * Link an existing menu item to a category
   */
  async linkItemToCategory(
    tenantId: string,
    categoryId: string,
    menuItemId: string,
    sortOrder: number = 0
  ) {
    return prisma.menuCategoryItem.create({
      data: {
        id: generateEntityId(),
        tenantId,
        categoryId,
        menuItemId,
        sortOrder,
      },
    });
  }

  /**
   * Unlink a menu item from a category (soft delete)
   */
  async unlinkItemFromCategory(categoryId: string, menuItemId: string) {
    return prisma.menuCategoryItem.updateMany({
      where: {
        categoryId,
        menuItemId,
        deleted: false,
      },
      data: {
        deleted: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get the next sort order for a category
   */
  async getNextSortOrder(categoryId: string): Promise<number> {
    const maxItem = await prisma.menuCategoryItem.findFirst({
      where: { categoryId, deleted: false },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return (maxItem?.sortOrder ?? -1) + 1;
  }

  /**
   * Get all category IDs for a menu item
   */
  async getItemCategoryIds(menuItemId: string): Promise<string[]> {
    const links = await prisma.menuCategoryItem.findMany({
      where: { menuItemId, deleted: false },
      select: { categoryId: true },
    });
    return links.map((l) => l.categoryId);
  }

  /**
   * Get category IDs for multiple items (batch)
   */
  async getItemsCategoryIds(
    menuItemIds: string[]
  ): Promise<Map<string, string[]>> {
    const links = await prisma.menuCategoryItem.findMany({
      where: { menuItemId: { in: menuItemIds }, deleted: false },
      select: { menuItemId: true, categoryId: true },
    });

    const result = new Map<string, string[]>();
    for (const link of links) {
      const existing = result.get(link.menuItemId) ?? [];
      existing.push(link.categoryId);
      result.set(link.menuItemId, existing);
    }
    return result;
  }

  /**
   * Set all categories for an item (replaces existing associations)
   * Soft deletes existing associations, then creates new ones
   */
  async setItemCategories(
    tenantId: string,
    menuItemId: string,
    categoryIds: string[]
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Soft delete existing associations
      await tx.menuCategoryItem.updateMany({
        where: { menuItemId, deleted: false },
        data: { deleted: true, updatedAt: new Date() },
      });

      // Create new associations
      if (categoryIds.length > 0) {
        const creates = categoryIds.map((categoryId, index) => ({
          id: generateEntityId(),
          tenantId,
          categoryId,
          menuItemId,
          sortOrder: index,
        }));

        await tx.menuCategoryItem.createMany({
          data: creates,
        });
      }
    });
  }

  /**
   * Update sort orders for items within a category
   */
  async updateSortOrders(
    categoryId: string,
    updates: Array<{ menuItemId: string; sortOrder: number }>
  ): Promise<void> {
    const queries = updates.map((u) =>
      prisma.menuCategoryItem.updateMany({
        where: {
          categoryId,
          menuItemId: u.menuItemId,
        },
        data: {
          sortOrder: u.sortOrder,
        },
      })
    );
    await prisma.$transaction(queries);
  }

  /**
   * Get all items in a specific category with sort order
   */
  async getCategoryItems(categoryId: string) {
    return prisma.menuCategoryItem.findMany({
      where: { categoryId, deleted: false },
      include: {
        menuItem: true,
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  /**
   * Get all items not currently in a specific category (for "Add Existing" feature)
   */
  async getItemsNotInCategory(
    tenantId: string,
    companyId: string,
    categoryId: string
  ) {
    // Get item IDs already in this category
    const existingLinks = await prisma.menuCategoryItem.findMany({
      where: { categoryId, deleted: false },
      select: { menuItemId: true },
    });
    const existingItemIds = existingLinks.map((l) => l.menuItemId);

    // Get all active items not in this category
    return prisma.menuItem.findMany({
      where: {
        tenantId,
        companyId,
        status: "active",
        deleted: false,
        id: { notIn: existingItemIds },
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

  /**
   * Check if an item belongs to a category
   */
  async isItemInCategory(
    categoryId: string,
    menuItemId: string
  ): Promise<boolean> {
    const link = await prisma.menuCategoryItem.findFirst({
      where: {
        categoryId,
        menuItemId,
        deleted: false,
      },
    });
    return link !== null;
  }

  /**
   * Count how many categories an item belongs to
   */
  async countItemCategories(menuItemId: string): Promise<number> {
    return prisma.menuCategoryItem.count({
      where: { menuItemId, deleted: false },
    });
  }
}

export const menuCategoryItemRepository = new MenuCategoryItemRepository();
