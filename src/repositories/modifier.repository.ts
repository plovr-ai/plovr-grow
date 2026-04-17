import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";

/**
 * Repository for ModifierGroup / ModifierOption read + soft-delete operations.
 *
 * Note: the richer upsert-by-tree flow for modifier groups lives in
 * MenuService.syncModifierGroups (it still touches the raw Prisma client
 * across multiple models in one transaction). This repo covers the narrow
 * helpers the Square catalog sync needs outside of that helper.
 */
export class ModifierRepository {
  /**
   * Return the groupId for a given ModifierOption row, or null if not found.
   * Used by the Square catalog sync to locate the existing ModifierGroup
   * when re-syncing so the group's internal ID stays stable.
   */
  async getOptionGroupId(optionId: string, tx?: DbClient) {
    const db = tx ?? prisma;
    const row = await db.modifierOption.findUnique({
      where: { id: optionId },
      select: { groupId: true },
    });
    return row?.groupId ?? null;
  }

  /**
   * Soft-delete a ModifierGroup by ID (tenant-scoped for safety).
   * Call softDeleteOptionsByGroup alongside this to fully remove a group.
   */
  async softDeleteGroup(tenantId: string, groupId: string, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.modifierGroup.updateMany({
      where: { id: groupId, tenantId },
      data: { deleted: true },
    });
  }

  /**
   * Soft-delete every ModifierOption belonging to a given group.
   * Does not require tenant scoping because groupId is itself unique.
   */
  async softDeleteOptionsByGroup(groupId: string, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.modifierOption.updateMany({
      where: { groupId },
      data: { deleted: true },
    });
  }
}

export const modifierRepository = new ModifierRepository();
