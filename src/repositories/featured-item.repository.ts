import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export class FeaturedItemRepository {
  /**
   * Get all featured items for a company with their menu item details
   */
  async getByCompanyId(tenantId: string, companyId: string) {
    return prisma.featuredItem.findMany({
      where: {
        tenantId,
        companyId,
      },
      include: {
        menuItem: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });
  }

  /**
   * Set featured items for a company (replace all)
   * Uses a transaction to delete existing and insert new items
   */
  async setFeaturedItems(
    tenantId: string,
    companyId: string,
    menuItemIds: string[]
  ) {
    return prisma.$transaction(async (tx) => {
      // Delete all existing featured items for this company
      await tx.featuredItem.deleteMany({
        where: {
          tenantId,
          companyId,
        },
      });

      // Insert new featured items with sort order
      if (menuItemIds.length > 0) {
        await tx.featuredItem.createMany({
          data: menuItemIds.map((menuItemId, index) => ({
            id: generateEntityId(),
            tenantId,
            companyId,
            menuItemId,
            sortOrder: index,
          })),
        });
      }
    });
  }

  /**
   * Add a single featured item
   */
  async addFeaturedItem(
    tenantId: string,
    companyId: string,
    menuItemId: string
  ) {
    // Get the current max sort order
    const maxSortOrder = await prisma.featuredItem.aggregate({
      where: {
        tenantId,
        companyId,
      },
      _max: {
        sortOrder: true,
      },
    });

    const newSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

    return prisma.featuredItem.create({
      data: {
        id: generateEntityId(),
        tenantId,
        companyId,
        menuItemId,
        sortOrder: newSortOrder,
      },
    });
  }

  /**
   * Remove a single featured item
   */
  async removeFeaturedItem(
    tenantId: string,
    companyId: string,
    menuItemId: string
  ) {
    return prisma.featuredItem.deleteMany({
      where: {
        tenantId,
        companyId,
        menuItemId,
      },
    });
  }

  /**
   * Reorder featured items
   */
  async reorderFeaturedItems(
    tenantId: string,
    companyId: string,
    orderedMenuItemIds: string[]
  ) {
    const queries = orderedMenuItemIds.map((menuItemId, index) =>
      prisma.featuredItem.updateMany({
        where: {
          tenantId,
          companyId,
          menuItemId,
        },
        data: {
          sortOrder: index,
        },
      })
    );
    return prisma.$transaction(queries);
  }
}

export const featuredItemRepository = new FeaturedItemRepository();
