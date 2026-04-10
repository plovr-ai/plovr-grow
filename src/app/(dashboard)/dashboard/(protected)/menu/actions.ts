"use server";

import { auth } from "@/lib/auth";
import { menuService } from "@/services/menu/menu.service";
import { revalidatePath } from "next/cache";
import type { ModifierGroupInput } from "@/services/menu/menu.types";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== Menu Actions ====================

interface CreateMenuInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export async function createMenuAction(
  input: CreateMenuInput
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    const menu = await menuService.createMenu(tenantId, input);

    revalidatePath("/dashboard/menu", "page");

    return { success: true, data: { id: menu.id } };
  } catch (error) {
    console.error("Failed to create menu:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create menu",
    };
  }
}

interface UpdateMenuInput {
  name?: string;
  description?: string;
  sortOrder?: number;
  status?: "active";
}

export async function updateMenuAction(
  id: string,
  input: UpdateMenuInput
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.updateMenu(tenantId, id, input);

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update menu:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update menu",
    };
  }
}

export async function deleteMenuAction(id: string): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    // Check if this is the last menu
    const menuCount = await menuService.countMenus(tenantId);
    if (menuCount <= 1) {
      return { success: false, error: "Cannot delete the last menu" };
    }

    await menuService.deleteMenu(tenantId, id);

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete menu:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete menu",
    };
  }
}

export async function updateMenuSortOrderAction(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.updateMenuSortOrders(tenantId, updates);

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update menu sort order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update menu sort order",
    };
  }
}

// ==================== Category Actions ====================

interface CreateCategoryInput {
  menuId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
}

export async function createCategoryAction(
  input: CreateCategoryInput
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    const category = await menuService.createCategory(tenantId, {
      menuId: input.menuId,
      name: input.name,
      description: input.description,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    });

    revalidatePath("/dashboard/menu", "page");

    return { success: true, data: { id: category.id } };
  } catch (error) {
    console.error("Failed to create category:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create category",
    };
  }
}

interface UpdateCategoryInput {
  name?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  status?: "active";
}

export async function updateCategoryAction(
  id: string,
  input: UpdateCategoryInput
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.updateCategory(tenantId, id, input);

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update category:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update category",
    };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.deleteCategory(tenantId, id);

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete category:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete category",
    };
  }
}

export async function updateCategorySortOrderAction(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.updateCategorySortOrders(tenantId, updates);

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update category sort order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update category sort order",
    };
  }
}

// ==================== Menu Item Actions ====================

interface CreateMenuItemInput {
  categoryIds: string[];
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  modifierGroups?: ModifierGroupInput[];
  tags?: string[];
  taxConfigIds?: string[];
}

export async function createMenuItemAction(
  input: CreateMenuItemInput
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    const item = await menuService.createMenuItem(tenantId, {
      categoryIds: input.categoryIds,
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      modifierGroups: input.modifierGroups,
      tags: input.tags,
    });

    // Set tax configs if provided
    if (input.taxConfigIds && input.taxConfigIds.length > 0) {
      await menuService.setMenuItemTaxConfigs(tenantId, item.id, input.taxConfigIds);
    }

    revalidatePath("/dashboard/menu", "page");

    return { success: true, data: { id: item.id } };
  } catch (error) {
    console.error("Failed to create menu item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create menu item",
    };
  }
}

interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  status?: "active" | "out_of_stock" | "archived";
  modifierGroups?: ModifierGroupInput[];
  tags?: string[];
  taxConfigIds?: string[];
  categoryIds?: string[];
}

export async function updateMenuItemAction(
  id: string,
  input: UpdateMenuItemInput
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    // Update menu item fields (including categoryIds if provided)
    const { taxConfigIds, ...updateData } = input;
    await menuService.updateMenuItem(tenantId, id, updateData);

    // Update tax configs if provided
    if (taxConfigIds !== undefined) {
      await menuService.setMenuItemTaxConfigs(tenantId, id, taxConfigIds);
    }

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update menu item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update menu item",
    };
  }
}

/**
 * Delete or unlink a menu item
 * If categoryId is provided: only remove from that category (item stays in other categories)
 * If categoryId is not provided: permanently delete the item
 */
export async function deleteMenuItemAction(
  id: string,
  options?: { categoryId?: string }
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    if (options?.categoryId) {
      // Just remove from this category
      await menuService.unlinkItemFromCategory(tenantId, options.categoryId, id);
    } else {
      // Permanently delete the item
      await menuService.deleteMenuItem(tenantId, id);
    }

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete menu item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete menu item",
    };
  }
}

/**
 * Update sort orders for items within a category
 */
export async function updateMenuItemSortOrderAction(
  categoryId: string,
  updates: Array<{ id: string; sortOrder: number }>
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await menuService.updateMenuItemSortOrders(categoryId, updates);

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update menu item sort order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update menu item sort order",
    };
  }
}

/**
 * Link an existing item to a category
 */
export async function linkItemToCategoryAction(
  categoryId: string,
  itemId: string
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.linkItemToCategory(tenantId, categoryId, itemId);

    revalidatePath("/dashboard/menu", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to link item to category:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to link item to category",
    };
  }
}

/**
 * Get items available to add to a category (not already in that category)
 */
export async function getAvailableItemsAction(
  categoryId: string
): Promise<ActionResult<import("@/services/menu/menu.types").AvailableItem[]>> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    const items = await menuService.getAvailableItems(tenantId, categoryId);
    return { success: true, data: items };
  } catch (error) {
    console.error("Failed to get available items:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get available items",
    };
  }
}


/**
 * Add a single featured item
 */
export async function addFeaturedItemAction(
  menuItemId: string
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.addFeaturedItem(tenantId, menuItemId);

    revalidatePath("/dashboard/menu/featured", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to add featured item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add featured item",
    };
  }
}

/**
 * Remove a single featured item
 */
export async function removeFeaturedItemAction(
  menuItemId: string
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.removeFeaturedItem(tenantId, menuItemId);

    revalidatePath("/dashboard/menu/featured", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to remove featured item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove featured item",
    };
  }
}

/**
 * Reorder featured items
 */
export async function reorderFeaturedItemsAction(
  orderedMenuItemIds: string[]
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.reorderFeaturedItems(tenantId, orderedMenuItemIds);

    revalidatePath("/dashboard/menu/featured", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to reorder featured items:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder featured items",
    };
  }
}
