import type { ItemTaxInfo as _ItemTaxInfo, TaxBreakdownItem as _TaxBreakdownItem } from "@/services/menu/tax-config.types";

// Re-export tax types for convenience
export type { _ItemTaxInfo as ItemTaxInfo, _TaxBreakdownItem as TaxBreakdownItem };

// Local alias for use in this file
type ItemTaxInfo = _ItemTaxInfo;

// Re-export tenant and merchant types
export * from "./tenant";
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
  taxes?: ItemTaxInfo[];
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
  taxes?: ItemTaxInfo[];
}

export interface Cart {
  tenantId: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

// ==================== Order Types ====================

export type OrderMode = "pickup" | "delivery" | "dine_in";

// Payment status (user behavior)
export type OrderStatus =
  | "created"        // Order created but not paid
  | "partial_paid"   // Partially paid
  | "completed"      // Fully paid
  | "payment_failed" // Payment attempt failed (distinct from order cancel — retry is possible)
  | "canceled";      // Order cancelled

// Fulfillment status (merchant behavior)
export type FulfillmentStatus =
  | "pending"       // Waiting for fulfillment to start
  | "confirmed"     // Merchant accepted the order
  | "preparing"     // Kitchen is preparing
  | "ready"         // Ready for pickup/delivery
  | "fulfilled"     // Order fulfilled
  | "canceled";     // Fulfillment canceled

export type SalesChannel = "online_order" | "catering" | "giftcard";

export type PaymentType = "online" | "in_store";

export interface OrderItemData {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  specialInstructions?: string;
  totalPrice: number;
  taxConfigId?: string;  // Tax config ID for tax calculation
  taxes?: ItemTaxInfo[];
  imageUrl?: string | null;  // Item image URL for display
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

// ==================== Fee Configuration Types ====================

export type FeeType = "fixed" | "percentage";

export interface Fee {
  id: string;
  name: string;
  displayName?: string;
  type: FeeType;
  value: number; // fixed: 金额, percentage: 小数 (0.05 = 5%)
}

export interface FeeConfig {
  fees: Fee[];
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  fees: [],
};

// Note: BusinessHours and MerchantSettings are now defined in ./merchant.ts

