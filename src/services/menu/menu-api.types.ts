/**
 * Menu API Types
 * 用于 getMenu API 的类型定义
 */

// ==================== Modifier Types ====================

/**
 * 单个修饰项（如 Small、Medium、Large）
 */
export interface Modifier {
  id: string;
  name: string;
  price: number; // 加价金额
}

/**
 * 修饰项组（如 pizza 的 Size、Toppings）
 */
export interface ModifierGroup {
  id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  modifiers: Modifier[];
}

// ==================== Menu Item Types ====================

/**
 * 菜品
 */
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  tags: string[];
  isAvailable: boolean;
  taxConfigId: string | null;
  modifierGroups: ModifierGroup[] | null;
}

// ==================== Menu Category Types ====================

/**
 * 菜单分类（只包含 itemIds 引用）
 */
export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  itemIds: string[];
}

// ==================== Menu Types ====================

/**
 * 菜单
 */
export interface Menu {
  id: string;
  merchantId: string;
  merchantName: string;
  currency: string;
  locale: string;
  categories: MenuCategory[];
}

// ==================== API Response Types ====================

/**
 * getMenu API 响应
 */
export interface MenuApiResponse {
  menu: Menu;
  items: Record<string, MenuItem>; // itemId -> item 实体的 Map
}
