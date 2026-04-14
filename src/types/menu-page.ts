/**
 * Menu Page ViewModel Types
 * 用于 Menu 页面展示的视图模型类型定义
 */

import type { ItemTaxInfo } from "@/services/menu/tax-config.types";

// 菜品标签类型
export type MenuItemTag =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "spicy"
  | "popular"
  | "new";

// Modifier ViewModel 类型
export interface ModifierViewModel {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  isAvailable: boolean;
  availabilityNote?: string; // 不可用原因 (如 "Sold out")
}

export interface ModifierGroupViewModel {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  allowQuantity: boolean;         // 是否允许选择数量 (1x, 2x, 3x)
  maxQuantityPerModifier: number; // 单个 modifier 最大数量
  modifiers: ModifierViewModel[];
}

// 分类 ViewModel
export interface MenuCategoryViewModel {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
}

// 菜品 ViewModel
export interface MenuItemViewModel {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  tags: MenuItemTag[];
  hasModifiers: boolean;
  modifierGroups: ModifierGroupViewModel[];
  isAvailable: boolean;
  taxes: ItemTaxInfo[];
}

// 分类 + 菜品组合
export interface MenuCategoryWithItemsViewModel {
  category: MenuCategoryViewModel;
  items: MenuItemViewModel[];
}

// 页面完整数据
interface MenuPageViewModel {
  merchantName: string;
  merchantLogo: string | null;
  currency: string;
  locale: string;
  categories: MenuCategoryWithItemsViewModel[];
}
