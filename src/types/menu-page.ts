/**
 * Menu Page ViewModel Types
 * 用于 Menu 页面展示的视图模型类型定义
 */

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
}

export interface ModifierGroupViewModel {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
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
  taxConfigId: string | null;
}

// 分类 + 菜品组合
export interface MenuCategoryWithItemsViewModel {
  category: MenuCategoryViewModel;
  items: MenuItemViewModel[];
}

// 页面完整数据
export interface MenuPageViewModel {
  merchantName: string;
  merchantLogo: string | null;
  currency: string;
  locale: string;
  categories: MenuCategoryWithItemsViewModel[];
}
