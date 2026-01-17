import type { MenuCategory, MenuItem } from "@prisma/client";

export interface MenuCategoryWithItems extends MenuCategory {
  menuItems: MenuItem[];
}

export interface GetMenuResponse {
  categories: MenuCategoryWithItems[];
  merchantId: string;
  merchantName: string;
  merchantLogo: string | null;
}

export interface CreateCategoryInput {
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
  status?: "active" | "inactive";
}

export interface CreateMenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  sortOrder?: number;
  modifierGroups?: ModifierGroupInput[];
  tags?: string[];
  taxConfigId?: string;
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  sortOrder?: number;
  status?: "active" | "inactive" | "out_of_stock";
  modifierGroups?: ModifierGroupInput[];
  tags?: string[];
  taxConfigId?: string | null;
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
