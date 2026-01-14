import type { Prisma } from "@prisma/client";

// ==================== Menu Types ====================

export interface MenuItemOption {
  id: string;
  name: string;
  type: "single" | "multiple"; // single choice or multiple choices
  required: boolean;
  choices: MenuItemChoice[];
}

export interface MenuItemChoice {
  id: string;
  name: string;
  price: number; // Additional price for this choice
}

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
  options: MenuItemOption[] | null;
  tags: string[] | null;
}

// ==================== Cart Types ====================

export interface CartItem {
  id: string; // Unique cart item ID
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  specialInstructions?: string;
  totalPrice: number; // price * quantity + options
}

export interface SelectedOption {
  optionId: string;
  optionName: string;
  choiceId: string;
  choiceName: string;
  price: number;
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
  selectedOptions: SelectedOption[];
  specialInstructions?: string;
  totalPrice: number;
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

// ==================== Merchant Types ====================

export interface BusinessHours {
  [key: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}

export interface MerchantSettings {
  acceptsPickup: boolean;
  acceptsDelivery: boolean;
  deliveryRadius?: number;
  minimumOrderAmount?: number;
  estimatedPrepTime?: number; // minutes
}

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
