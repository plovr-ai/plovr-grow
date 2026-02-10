import type { MenuCategory, MenuItem } from "@prisma/client";
import type { ItemTaxInfo } from "@/services/menu/tax-config.types";

// ==================== Menu Types ====================

export interface MenuInfo {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: "active";
}

export interface CreateMenuInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateMenuInput {
  name?: string;
  description?: string;
  sortOrder?: number;
  status?: "active";
}

// ==================== Category & Item Types ====================

export interface MenuItemWithTaxes extends MenuItem {
  taxes?: ItemTaxInfo[];
}

export interface MenuCategoryWithItems extends MenuCategory {
  menuItems: MenuItemWithTaxes[];
}

export interface GetMenuResponse {
  menus: MenuInfo[];
  currentMenuId: string;
  categories: MenuCategoryWithItems[];
  merchantId: string;
  merchantName: string;
  merchantLogo: string | null;
}

export interface CreateCategoryInput {
  menuId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  status?: "active";
}

export interface CreateMenuItemInput {
  categoryIds: string[];
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  modifierGroups?: ModifierGroupInput[];
  tags?: string[];
  taxConfigId?: string;
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  status?: "active" | "out_of_stock" | "archived";
  modifierGroups?: ModifierGroupInput[];
  tags?: string[];
  taxConfigId?: string | null;
  categoryIds?: string[];
}

// Modifier 输入类型
export interface ModifierInput {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;       // 是否默认选中 (默认 false)
  isAvailable?: boolean;     // 是否可用 (默认 true)
  availabilityNote?: string; // 不可用原因 (如 "Sold out")
}

// ModifierGroup 输入类型
export interface ModifierGroupInput {
  id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  allowQuantity?: boolean;         // 是否允许选择数量 (默认 false)
  maxQuantityPerModifier?: number; // 单个 modifier 最大数量 (默认 1)
  modifiers: ModifierInput[];
}

/** @deprecated Use ModifierGroupInput instead */
export type MenuItemOptionInput = ModifierGroupInput;

// ==================== Dashboard Types ====================

export interface DashboardMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  sortOrder: number;
  status: "active" | "out_of_stock" | "archived";
  modifierGroups: ModifierGroupInput[];
  tags: string[];
  taxConfigIds: string[];
  categoryIds: string[];
}

export interface AvailableItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryNames: string[];
}

export interface DashboardCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  status: "active";
  menuItems: DashboardMenuItem[];
}

export interface DashboardMenuResponse {
  menus: MenuInfo[];
  currentMenuId: string;
  categories: DashboardCategory[];
}

export interface TaxConfigOption {
  id: string;
  name: string;
  description: string | null;
}

// ==================== Featured Items Types ====================

export interface FeaturedItemData {
  id: string;
  menuItemId: string;
  sortOrder: number;
  menuItem: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    status: string;
  };
}
