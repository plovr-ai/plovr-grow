import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock menuService
vi.mock("@/services/menu/menu.service", () => ({
  menuService: {
    createMenu: vi.fn(),
    updateMenu: vi.fn(),
    deleteMenu: vi.fn(),
    countMenus: vi.fn(),
    updateMenuSortOrders: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    updateCategorySortOrders: vi.fn(),
    createMenuItem: vi.fn(),
    updateMenuItem: vi.fn(),
    deleteMenuItem: vi.fn(),
    unlinkItemFromCategory: vi.fn(),
    updateMenuItemSortOrders: vi.fn(),
    linkItemToCategory: vi.fn(),
    getAvailableItems: vi.fn(),
    addFeaturedItem: vi.fn(),
    removeFeaturedItem: vi.fn(),
    reorderFeaturedItems: vi.fn(),
    setMenuItemTaxConfigs: vi.fn(),
  },
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { menuService } from "@/services/menu/menu.service";

import {
  createMenuAction,
  updateMenuAction,
  deleteMenuAction,
  updateMenuSortOrderAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  updateCategorySortOrderAction,
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
  updateMenuItemSortOrderAction,
  linkItemToCategoryAction,
  getAvailableItemsAction,
  addFeaturedItemAction,
  removeFeaturedItemAction,
  reorderFeaturedItemsAction,
} from "../actions";

const mockAuth = vi.mocked(auth);
const mockMenuService = vi.mocked(menuService);

const TENANT_ID = "tenant-1";
const COMPANY_ID = "company-1";

const authenticatedSession = {
  user: { tenantId: TENANT_ID, companyId: COMPANY_ID },
};

const tenantOnlySession = {
  user: { tenantId: TENANT_ID },
};

describe("Menu Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== createMenuAction ====================

  describe("createMenuAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await createMenuAction({ name: "Lunch" });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when session has no tenantId", async () => {
      mockAuth.mockResolvedValue({ user: {} });
      const result = await createMenuAction({ name: "Lunch" });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when session has no companyId", async () => {
      mockAuth.mockResolvedValue({ user: { tenantId: TENANT_ID } });
      const result = await createMenuAction({ name: "Lunch" });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should create menu successfully", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createMenu.mockResolvedValue({ id: "menu-1" });

      const result = await createMenuAction({
        name: "Lunch",
        description: "Lunch menu",
        sortOrder: 1,
      });

      expect(result).toEqual({ success: true, data: { id: "menu-1" } });
      expect(mockMenuService.createMenu).toHaveBeenCalledWith(
        TENANT_ID,
        COMPANY_ID,
        { name: "Lunch", description: "Lunch menu", sortOrder: 1 }
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createMenu.mockRejectedValue(new Error("DB error"));

      const result = await createMenuAction({ name: "Lunch" });

      expect(result).toEqual({ success: false, error: "DB error" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createMenu.mockRejectedValue("string error");

      const result = await createMenuAction({ name: "Lunch" });

      expect(result).toEqual({
        success: false,
        error: "Failed to create menu",
      });
    });
  });

  // ==================== updateMenuAction ====================

  describe("updateMenuAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await updateMenuAction("menu-1", { name: "Updated" });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should update menu successfully", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenu.mockResolvedValue(undefined);

      const result = await updateMenuAction("menu-1", { name: "Updated" });

      expect(result).toEqual({ success: true });
      expect(mockMenuService.updateMenu).toHaveBeenCalledWith(
        TENANT_ID,
        "menu-1",
        { name: "Updated" }
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenu.mockRejectedValue(new Error("Not found"));

      const result = await updateMenuAction("menu-1", { name: "Updated" });

      expect(result).toEqual({ success: false, error: "Not found" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenu.mockRejectedValue(42);

      const result = await updateMenuAction("menu-1", { name: "X" });

      expect(result).toEqual({
        success: false,
        error: "Failed to update menu",
      });
    });
  });

  // ==================== deleteMenuAction ====================

  describe("deleteMenuAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await deleteMenuAction("menu-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when missing companyId", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      const result = await deleteMenuAction("menu-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should prevent deleting the last menu", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.countMenus.mockResolvedValue(1);

      const result = await deleteMenuAction("menu-1");

      expect(result).toEqual({
        success: false,
        error: "Cannot delete the last menu",
      });
      expect(mockMenuService.deleteMenu).not.toHaveBeenCalled();
    });

    it("should delete menu when more than one exists", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.countMenus.mockResolvedValue(2);
      mockMenuService.deleteMenu.mockResolvedValue(undefined);

      const result = await deleteMenuAction("menu-1");

      expect(result).toEqual({ success: true });
      expect(mockMenuService.deleteMenu).toHaveBeenCalledWith(
        TENANT_ID,
        "menu-1"
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.countMenus.mockResolvedValue(3);
      mockMenuService.deleteMenu.mockRejectedValue(new Error("DB error"));

      const result = await deleteMenuAction("menu-1");

      expect(result).toEqual({ success: false, error: "DB error" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.countMenus.mockRejectedValue(null);

      const result = await deleteMenuAction("menu-1");

      expect(result).toEqual({
        success: false,
        error: "Failed to delete menu",
      });
    });
  });

  // ==================== updateMenuSortOrderAction ====================

  describe("updateMenuSortOrderAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await updateMenuSortOrderAction([]);
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should update sort orders successfully", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuSortOrders.mockResolvedValue(undefined);

      const updates = [
        { id: "m1", sortOrder: 0 },
        { id: "m2", sortOrder: 1 },
      ];
      const result = await updateMenuSortOrderAction(updates);

      expect(result).toEqual({ success: true });
      expect(mockMenuService.updateMenuSortOrders).toHaveBeenCalledWith(
        TENANT_ID,
        updates
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuSortOrders.mockRejectedValue(
        new Error("Fail")
      );

      const result = await updateMenuSortOrderAction([]);

      expect(result).toEqual({ success: false, error: "Fail" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuSortOrders.mockRejectedValue(undefined);

      const result = await updateMenuSortOrderAction([]);

      expect(result).toEqual({
        success: false,
        error: "Failed to update menu sort order",
      });
    });
  });

  // ==================== createCategoryAction ====================

  describe("createCategoryAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await createCategoryAction({
        menuId: "menu-1",
        name: "Appetizers",
      });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when missing companyId", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      const result = await createCategoryAction({
        menuId: "menu-1",
        name: "Appetizers",
      });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should create category successfully", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createCategory.mockResolvedValue({ id: "cat-1" });

      const result = await createCategoryAction({
        menuId: "menu-1",
        name: "Appetizers",
        description: "Start your meal",
        imageUrl: "https://example.com/img.jpg",
        sortOrder: 0,
      });

      expect(result).toEqual({ success: true, data: { id: "cat-1" } });
      expect(mockMenuService.createCategory).toHaveBeenCalledWith(
        TENANT_ID,
        COMPANY_ID,
        {
          menuId: "menu-1",
          name: "Appetizers",
          description: "Start your meal",
          imageUrl: "https://example.com/img.jpg",
          sortOrder: 0,
        }
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createCategory.mockRejectedValue(new Error("Dup name"));

      const result = await createCategoryAction({
        menuId: "menu-1",
        name: "Appetizers",
      });

      expect(result).toEqual({ success: false, error: "Dup name" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createCategory.mockRejectedValue(123);

      const result = await createCategoryAction({
        menuId: "menu-1",
        name: "Test",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to create category",
      });
    });
  });

  // ==================== updateCategoryAction ====================

  describe("updateCategoryAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await updateCategoryAction("cat-1", { name: "Updated" });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should update category successfully", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateCategory.mockResolvedValue(undefined);

      const result = await updateCategoryAction("cat-1", {
        name: "Updated",
        description: "New desc",
      });

      expect(result).toEqual({ success: true });
      expect(mockMenuService.updateCategory).toHaveBeenCalledWith(
        TENANT_ID,
        "cat-1",
        { name: "Updated", description: "New desc" }
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateCategory.mockRejectedValue(new Error("Nope"));

      const result = await updateCategoryAction("cat-1", { name: "X" });

      expect(result).toEqual({ success: false, error: "Nope" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateCategory.mockRejectedValue(false);

      const result = await updateCategoryAction("cat-1", { name: "X" });

      expect(result).toEqual({
        success: false,
        error: "Failed to update category",
      });
    });
  });

  // ==================== deleteCategoryAction ====================

  describe("deleteCategoryAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await deleteCategoryAction("cat-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should delete category successfully", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.deleteCategory.mockResolvedValue(undefined);

      const result = await deleteCategoryAction("cat-1");

      expect(result).toEqual({ success: true });
      expect(mockMenuService.deleteCategory).toHaveBeenCalledWith(
        TENANT_ID,
        "cat-1"
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.deleteCategory.mockRejectedValue(new Error("Fail"));

      const result = await deleteCategoryAction("cat-1");

      expect(result).toEqual({ success: false, error: "Fail" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.deleteCategory.mockRejectedValue(undefined);

      const result = await deleteCategoryAction("cat-1");

      expect(result).toEqual({
        success: false,
        error: "Failed to delete category",
      });
    });
  });

  // ==================== updateCategorySortOrderAction ====================

  describe("updateCategorySortOrderAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await updateCategorySortOrderAction([]);
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should update category sort orders successfully", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateCategorySortOrders.mockResolvedValue(undefined);

      const updates = [{ id: "c1", sortOrder: 0 }];
      const result = await updateCategorySortOrderAction(updates);

      expect(result).toEqual({ success: true });
      expect(mockMenuService.updateCategorySortOrders).toHaveBeenCalledWith(
        TENANT_ID,
        updates
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateCategorySortOrders.mockRejectedValue(
        new Error("DB")
      );

      const result = await updateCategorySortOrderAction([]);

      expect(result).toEqual({ success: false, error: "DB" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateCategorySortOrders.mockRejectedValue(null);

      const result = await updateCategorySortOrderAction([]);

      expect(result).toEqual({
        success: false,
        error: "Failed to update category sort order",
      });
    });
  });

  // ==================== createMenuItemAction ====================

  describe("createMenuItemAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await createMenuItemAction({
        categoryIds: ["cat-1"],
        name: "Burger",
        price: 12.99,
      });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when missing companyId", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      const result = await createMenuItemAction({
        categoryIds: ["cat-1"],
        name: "Burger",
        price: 12.99,
      });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should create menu item successfully without tax configs", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createMenuItem.mockResolvedValue({ id: "item-1" });

      const result = await createMenuItemAction({
        categoryIds: ["cat-1"],
        name: "Burger",
        price: 12.99,
        description: "Tasty",
        imageUrl: "https://example.com/burger.jpg",
        tags: ["popular"],
      });

      expect(result).toEqual({ success: true, data: { id: "item-1" } });
      expect(mockMenuService.createMenuItem).toHaveBeenCalledWith(
        TENANT_ID,
        COMPANY_ID,
        {
          categoryIds: ["cat-1"],
          name: "Burger",
          description: "Tasty",
          price: 12.99,
          imageUrl: "https://example.com/burger.jpg",
          modifierGroups: undefined,
          tags: ["popular"],
        }
      );
      expect(mockMenuService.setMenuItemTaxConfigs).not.toHaveBeenCalled();
    });

    it("should create menu item with tax configs", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createMenuItem.mockResolvedValue({ id: "item-1" });
      mockMenuService.setMenuItemTaxConfigs.mockResolvedValue(undefined);

      const result = await createMenuItemAction({
        categoryIds: ["cat-1"],
        name: "Beer",
        price: 8.0,
        taxConfigIds: ["tax-1", "tax-2"],
      });

      expect(result).toEqual({ success: true, data: { id: "item-1" } });
      expect(mockMenuService.setMenuItemTaxConfigs).toHaveBeenCalledWith(
        TENANT_ID,
        "item-1",
        ["tax-1", "tax-2"]
      );
    });

    it("should not set tax configs when empty array", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createMenuItem.mockResolvedValue({ id: "item-1" });

      const result = await createMenuItemAction({
        categoryIds: ["cat-1"],
        name: "Water",
        price: 0,
        taxConfigIds: [],
      });

      expect(result).toEqual({ success: true, data: { id: "item-1" } });
      expect(mockMenuService.setMenuItemTaxConfigs).not.toHaveBeenCalled();
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createMenuItem.mockRejectedValue(new Error("Bad input"));

      const result = await createMenuItemAction({
        categoryIds: ["cat-1"],
        name: "X",
        price: 1,
      });

      expect(result).toEqual({ success: false, error: "Bad input" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.createMenuItem.mockRejectedValue(undefined);

      const result = await createMenuItemAction({
        categoryIds: ["cat-1"],
        name: "X",
        price: 1,
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to create menu item",
      });
    });
  });

  // ==================== updateMenuItemAction ====================

  describe("updateMenuItemAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await updateMenuItemAction("item-1", { name: "X" });
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should update menu item without tax configs", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItem.mockResolvedValue(undefined);

      const result = await updateMenuItemAction("item-1", {
        name: "Updated Burger",
        price: 14.99,
      });

      expect(result).toEqual({ success: true });
      expect(mockMenuService.updateMenuItem).toHaveBeenCalledWith(
        TENANT_ID,
        "item-1",
        { name: "Updated Burger", price: 14.99 }
      );
      expect(mockMenuService.setMenuItemTaxConfigs).not.toHaveBeenCalled();
    });

    it("should update menu item with tax configs", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItem.mockResolvedValue(undefined);
      mockMenuService.setMenuItemTaxConfigs.mockResolvedValue(undefined);

      const result = await updateMenuItemAction("item-1", {
        name: "Beer",
        taxConfigIds: ["tax-1"],
      });

      expect(result).toEqual({ success: true });
      expect(mockMenuService.setMenuItemTaxConfigs).toHaveBeenCalledWith(
        TENANT_ID,
        "item-1",
        ["tax-1"]
      );
    });

    it("should update menu item with empty tax configs array (clear)", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItem.mockResolvedValue(undefined);
      mockMenuService.setMenuItemTaxConfigs.mockResolvedValue(undefined);

      const result = await updateMenuItemAction("item-1", {
        taxConfigIds: [],
      });

      expect(result).toEqual({ success: true });
      expect(mockMenuService.setMenuItemTaxConfigs).toHaveBeenCalledWith(
        TENANT_ID,
        "item-1",
        []
      );
    });

    it("should update menu item with categoryIds", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItem.mockResolvedValue(undefined);

      const result = await updateMenuItemAction("item-1", {
        categoryIds: ["cat-1", "cat-2"],
      });

      expect(result).toEqual({ success: true });
      expect(mockMenuService.updateMenuItem).toHaveBeenCalledWith(
        TENANT_ID,
        "item-1",
        { categoryIds: ["cat-1", "cat-2"] }
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItem.mockRejectedValue(new Error("Nope"));

      const result = await updateMenuItemAction("item-1", { name: "X" });

      expect(result).toEqual({ success: false, error: "Nope" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItem.mockRejectedValue(null);

      const result = await updateMenuItemAction("item-1", { name: "X" });

      expect(result).toEqual({
        success: false,
        error: "Failed to update menu item",
      });
    });
  });

  // ==================== deleteMenuItemAction ====================

  describe("deleteMenuItemAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await deleteMenuItemAction("item-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should permanently delete item when no categoryId", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.deleteMenuItem.mockResolvedValue(undefined);

      const result = await deleteMenuItemAction("item-1");

      expect(result).toEqual({ success: true });
      expect(mockMenuService.deleteMenuItem).toHaveBeenCalledWith(
        TENANT_ID,
        "item-1"
      );
      expect(mockMenuService.unlinkItemFromCategory).not.toHaveBeenCalled();
    });

    it("should unlink item from category when categoryId provided", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.unlinkItemFromCategory.mockResolvedValue(undefined);

      const result = await deleteMenuItemAction("item-1", {
        categoryId: "cat-1",
      });

      expect(result).toEqual({ success: true });
      expect(mockMenuService.unlinkItemFromCategory).toHaveBeenCalledWith(
        TENANT_ID,
        "cat-1",
        "item-1"
      );
      expect(mockMenuService.deleteMenuItem).not.toHaveBeenCalled();
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.deleteMenuItem.mockRejectedValue(new Error("Fail"));

      const result = await deleteMenuItemAction("item-1");

      expect(result).toEqual({ success: false, error: "Fail" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.deleteMenuItem.mockRejectedValue(0);

      const result = await deleteMenuItemAction("item-1");

      expect(result).toEqual({
        success: false,
        error: "Failed to delete menu item",
      });
    });
  });

  // ==================== updateMenuItemSortOrderAction ====================

  describe("updateMenuItemSortOrderAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await updateMenuItemSortOrderAction("cat-1", []);
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should update item sort orders successfully", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItemSortOrders.mockResolvedValue(undefined);

      const updates = [{ id: "i1", sortOrder: 0 }];
      const result = await updateMenuItemSortOrderAction("cat-1", updates);

      expect(result).toEqual({ success: true });
      expect(mockMenuService.updateMenuItemSortOrders).toHaveBeenCalledWith(
        "cat-1",
        updates
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItemSortOrders.mockRejectedValue(
        new Error("DB")
      );

      const result = await updateMenuItemSortOrderAction("cat-1", []);

      expect(result).toEqual({ success: false, error: "DB" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.updateMenuItemSortOrders.mockRejectedValue(null);

      const result = await updateMenuItemSortOrderAction("cat-1", []);

      expect(result).toEqual({
        success: false,
        error: "Failed to update menu item sort order",
      });
    });
  });

  // ==================== linkItemToCategoryAction ====================

  describe("linkItemToCategoryAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await linkItemToCategoryAction("cat-1", "item-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should link item to category successfully", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.linkItemToCategory.mockResolvedValue(undefined);

      const result = await linkItemToCategoryAction("cat-1", "item-1");

      expect(result).toEqual({ success: true });
      expect(mockMenuService.linkItemToCategory).toHaveBeenCalledWith(
        TENANT_ID,
        "cat-1",
        "item-1"
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.linkItemToCategory.mockRejectedValue(
        new Error("Already linked")
      );

      const result = await linkItemToCategoryAction("cat-1", "item-1");

      expect(result).toEqual({ success: false, error: "Already linked" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      mockMenuService.linkItemToCategory.mockRejectedValue(undefined);

      const result = await linkItemToCategoryAction("cat-1", "item-1");

      expect(result).toEqual({
        success: false,
        error: "Failed to link item to category",
      });
    });
  });

  // ==================== getAvailableItemsAction ====================

  describe("getAvailableItemsAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await getAvailableItemsAction("cat-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when missing companyId", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      const result = await getAvailableItemsAction("cat-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return available items successfully", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      const items = [
        { id: "item-2", name: "Fries", price: 4.99 },
        { id: "item-3", name: "Salad", price: 7.99 },
      ];
      mockMenuService.getAvailableItems.mockResolvedValue(items);

      const result = await getAvailableItemsAction("cat-1");

      expect(result).toEqual({ success: true, data: items });
      expect(mockMenuService.getAvailableItems).toHaveBeenCalledWith(
        TENANT_ID,
        COMPANY_ID,
        "cat-1"
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.getAvailableItems.mockRejectedValue(new Error("Fail"));

      const result = await getAvailableItemsAction("cat-1");

      expect(result).toEqual({ success: false, error: "Fail" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.getAvailableItems.mockRejectedValue(null);

      const result = await getAvailableItemsAction("cat-1");

      expect(result).toEqual({
        success: false,
        error: "Failed to get available items",
      });
    });
  });

  // ==================== addFeaturedItemAction ====================

  describe("addFeaturedItemAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await addFeaturedItemAction("item-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when missing companyId", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      const result = await addFeaturedItemAction("item-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should add featured item successfully", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.addFeaturedItem.mockResolvedValue(undefined);

      const result = await addFeaturedItemAction("item-1");

      expect(result).toEqual({ success: true });
      expect(mockMenuService.addFeaturedItem).toHaveBeenCalledWith(
        TENANT_ID,
        COMPANY_ID,
        "item-1"
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.addFeaturedItem.mockRejectedValue(
        new Error("Max reached")
      );

      const result = await addFeaturedItemAction("item-1");

      expect(result).toEqual({ success: false, error: "Max reached" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.addFeaturedItem.mockRejectedValue(undefined);

      const result = await addFeaturedItemAction("item-1");

      expect(result).toEqual({
        success: false,
        error: "Failed to add featured item",
      });
    });
  });

  // ==================== removeFeaturedItemAction ====================

  describe("removeFeaturedItemAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await removeFeaturedItemAction("item-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when missing companyId", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      const result = await removeFeaturedItemAction("item-1");
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should remove featured item successfully", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.removeFeaturedItem.mockResolvedValue(undefined);

      const result = await removeFeaturedItemAction("item-1");

      expect(result).toEqual({ success: true });
      expect(mockMenuService.removeFeaturedItem).toHaveBeenCalledWith(
        TENANT_ID,
        COMPANY_ID,
        "item-1"
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.removeFeaturedItem.mockRejectedValue(
        new Error("Not featured")
      );

      const result = await removeFeaturedItemAction("item-1");

      expect(result).toEqual({ success: false, error: "Not featured" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.removeFeaturedItem.mockRejectedValue(null);

      const result = await removeFeaturedItemAction("item-1");

      expect(result).toEqual({
        success: false,
        error: "Failed to remove featured item",
      });
    });
  });

  // ==================== reorderFeaturedItemsAction ====================

  describe("reorderFeaturedItemsAction", () => {
    it("should return unauthorized when no session", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await reorderFeaturedItemsAction(["item-1", "item-2"]);
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should return unauthorized when missing companyId", async () => {
      mockAuth.mockResolvedValue(tenantOnlySession);
      const result = await reorderFeaturedItemsAction(["item-1"]);
      expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("should reorder featured items successfully", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.reorderFeaturedItems.mockResolvedValue(undefined);

      const ids = ["item-2", "item-1", "item-3"];
      const result = await reorderFeaturedItemsAction(ids);

      expect(result).toEqual({ success: true });
      expect(mockMenuService.reorderFeaturedItems).toHaveBeenCalledWith(
        TENANT_ID,
        COMPANY_ID,
        ids
      );
    });

    it("should return error when service throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.reorderFeaturedItems.mockRejectedValue(
        new Error("Fail")
      );

      const result = await reorderFeaturedItemsAction([]);

      expect(result).toEqual({ success: false, error: "Fail" });
    });

    it("should return generic error for non-Error throws", async () => {
      mockAuth.mockResolvedValue(authenticatedSession);
      mockMenuService.reorderFeaturedItems.mockRejectedValue(undefined);

      const result = await reorderFeaturedItemsAction([]);

      expect(result).toEqual({
        success: false,
        error: "Failed to reorder featured items",
      });
    });
  });
});
