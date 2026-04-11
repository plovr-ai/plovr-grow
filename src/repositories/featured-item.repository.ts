import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export class FeaturedItemRepository {
  /**
   * Count featured items whose underlying menu item is currently active.
   * Matches the filter MenuService.getMenu applies when injecting the
   * synthetic "Featured" category (status === "active"). Used by the
   * storefront menu page to include featured items in the first menu's
   * switcher count without loading full menu data.
   */
  async countActiveByTenantId(tenantId: string): Promise<number> {
    return prisma.featuredItem.count({
      where: {
        tenantId,
        deleted: false,
        menuItem: {
          is: {
            status: "active",
            deleted: false,
          },
        },
      },
    });
  }

  /**
   * Get all featured items for a tenant with their menu item details
   */
  async getByTenantId(tenantId: string) {
    return prisma.featuredItem.findMany({
      where: {
        tenantId,
        deleted: false,
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
   * Set featured items for a tenant (replace all)
   * Soft deletes existing items, then inserts new ones
   */
  async setFeaturedItems(
    tenantId: string,
    menuItemIds: string[]
  ) {
    return prisma.$transaction(async (tx) => {
      // Soft delete all existing featured items for this tenant
      await tx.featuredItem.updateMany({
        where: {
          tenantId,
          deleted: false,
        },
        data: {
          deleted: true,
          updatedAt: new Date(),
        },
      });

      // Insert new featured items with sort order
      if (menuItemIds.length > 0) {
        await tx.featuredItem.createMany({
          data: menuItemIds.map((menuItemId, index) => ({
            id: generateEntityId(),
            tenantId,
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
    menuItemId: string
  ) {
    // Get the current max sort order
    const maxSortOrder = await prisma.featuredItem.aggregate({
      where: {
        tenantId,
        deleted: false,
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
        menuItemId,
        sortOrder: newSortOrder,
      },
    });
  }

  /**
   * Remove a single featured item (soft delete)
   */
  async removeFeaturedItem(
    tenantId: string,
    menuItemId: string
  ) {
    return prisma.featuredItem.updateMany({
      where: {
        tenantId,
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
   * Reorder featured items
   */
  async reorderFeaturedItems(
    tenantId: string,
    orderedMenuItemIds: string[]
  ) {
    const queries = orderedMenuItemIds.map((menuItemId, index) =>
      prisma.featuredItem.updateMany({
        where: {
          tenantId,
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
