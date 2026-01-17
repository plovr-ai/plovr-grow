import type { Prisma } from "@prisma/client";

// Re-export tax types for convenience
export type { TaxBreakdownItem } from "@/services/menu/tax-config.types";

// Re-export company and merchant types
export * from "./company";
export * from "./merchant";

// ==================== Modifier Types ====================

export interface Modifier {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: Modifier[];
}

// 选中的 Modifier（用于购物车和订单）
export interface SelectedModifier {
  groupId: string;
  groupName: string;
  modifierId: string;
  modifierName: string;
  price: number;
  quantity: number; // 选择数量 (默认 1)
}

// ==================== Menu Types ====================

export interface MenuCategoryWithItems {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  items: MenuItemData[];
}

export interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  status: string;
  modifierGroups: ModifierGroup[] | null;
  tags: string[] | null;
  taxConfigId?: string | null;
}

// ==================== Cart Types ====================

export interface CartItem {
  id: string; // Unique cart item ID
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  specialInstructions?: string;
  totalPrice: number; // price * quantity + modifiers
  imageUrl?: string | null;
  taxConfigId?: string | null;
}

export interface Cart {
  tenantId: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

// ==================== Order Types ====================

export type OrderType = "pickup" | "delivery" | "dine_in";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export interface OrderItemData {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  specialInstructions?: string;
  totalPrice: number;
  taxConfigId?: string | null;
}

export interface CreateOrderInput {
  tenantId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: OrderType;
  items: OrderItemData[];
  notes?: string;
  deliveryAddress?: DeliveryAddress;
  scheduledAt?: Date;
}

export interface DeliveryAddress {
  street: string;
  apt?: string;
  city: string;
  state: string;
  zipCode: string;
  instructions?: string;
}

// ==================== Tip Configuration Types ====================

export type TipMode = "fixed" | "percentage";

export interface TipConfig {
  mode: TipMode;
  tiers: number[]; // 固定金额 [1, 2, 3] 或 百分比 [0.15, 0.18, 0.20]
  allowCustom: boolean;
}

export const DEFAULT_TIP_CONFIG: TipConfig = {
  mode: "percentage",
  tiers: [0.15, 0.18, 0.2],
  allowCustom: true,
};

// Note: BusinessHours and MerchantSettings are now defined in ./merchant.ts

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
