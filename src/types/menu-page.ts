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
  hasOptions: boolean;
  isAvailable: boolean;
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
