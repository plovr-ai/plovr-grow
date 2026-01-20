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

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId, companyId } = session.user;

  try {
    const menu = await menuService.createMenu(tenantId, companyId, input);

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
  status?: "active" | "inactive";
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

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId, companyId } = session.user;

  try {
    // Check if this is the last menu
    const menuCount = await menuService.countMenus(tenantId, companyId);
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

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId, companyId } = session.user;

  try {
    const category = await menuService.createCategory(tenantId, companyId, {
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
  status?: "active" | "inactive";
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
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  sortOrder?: number;
  modifierGroups?: ModifierGroupInput[];
  tags?: string[];
  taxConfigIds?: string[];
}

export async function createMenuItemAction(
  input: CreateMenuItemInput
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId, companyId } = session.user;

  try {
    const item = await menuService.createMenuItem(tenantId, companyId, {
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
      modifierGroups: input.modifierGroups,
      tags: input.tags,
    });

    // Set tax configs if provided
    if (input.taxConfigIds && input.taxConfigIds.length > 0) {
      await menuService.setMenuItemTaxConfigs(item.id, input.taxConfigIds);
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
  sortOrder?: number;
  status?: "active" | "inactive" | "out_of_stock";
  modifierGroups?: ModifierGroupInput[];
  tags?: string[];
  taxConfigIds?: string[];
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
    // Update menu item fields
    const { taxConfigIds, ...updateData } = input;
    await menuService.updateMenuItem(tenantId, id, updateData);

    // Update tax configs if provided
    if (taxConfigIds !== undefined) {
      await menuService.setMenuItemTaxConfigs(id, taxConfigIds);
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

export async function deleteMenuItemAction(id: string): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.deleteMenuItem(tenantId, id);

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

export async function updateMenuItemSortOrderAction(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await menuService.updateMenuItemSortOrders(tenantId, updates);

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
