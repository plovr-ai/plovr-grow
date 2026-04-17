import type { OrderMode, DeliveryAddress, SalesChannel } from "@/types";

// --- Cart Status ---

export type CartStatus = "active" | "submitted" | "cancelled";

// --- Input Types ---

export interface CreateCartInput {
  salesChannel: SalesChannel;
  notes?: string;
}

export interface AddCartItemInput {
  menuItemId: string;
  quantity: number;
  selectedModifiers?: AddCartItemModifierInput[];
  specialInstructions?: string;
}

export interface AddCartItemModifierInput {
  modifierGroupId?: string;
  modifierOptionId: string;
  groupName?: string;
  name?: string;
  price?: number;
  quantity?: number;
}

export interface UpdateCartItemInput {
  quantity?: number;
  selectedModifiers?: AddCartItemModifierInput[];
  specialInstructions?: string;
}

export interface CheckoutInput {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail?: string;
  orderMode: OrderMode;
  deliveryAddress?: DeliveryAddress;
  tipAmount?: number;
  notes?: string;
}

// --- Output Types ---

export interface CartItemModifierData {
  id: string;
  modifierGroupId: string;
  modifierOptionId: string;
  groupName: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItemData {
  id: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  specialInstructions: string | null;
  imageUrl: string | null;
  sortOrder: number;
  modifiers: CartItemModifierData[];
}

export interface CartSummary {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface CartWithItems {
  id: string;
  tenantId: string;
  merchantId: string;
  status: CartStatus;
  salesChannel: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: CartItemData[];
  summary: CartSummary;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  alreadyExists: boolean;
}
