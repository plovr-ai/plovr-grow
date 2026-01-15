"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, SelectedOption } from "@/types";

interface AddToCartInput {
  menuItemId: string;
  name: string;
  price: number;
  quantity?: number;
  selectedOptions?: SelectedOption[];
  specialInstructions?: string;
}

interface CartState {
  tenantId: string | null;
  items: CartItem[];
}

interface CartActions {
  setTenantId: (tenantId: string) => void;
  addItem: (input: AddToCartInput) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
}

type CartStore = CartState & CartActions;

function generateCartItemId(): string {
  return `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function calculateItemTotalPrice(
  price: number,
  quantity: number,
  selectedOptions: SelectedOption[]
): number {
  const optionsTotal = selectedOptions.reduce((sum, opt) => sum + opt.price, 0);
  return (price + optionsTotal) * quantity;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      tenantId: null,
      items: [],

      setTenantId: (tenantId: string) => {
        const currentTenantId = get().tenantId;
        if (currentTenantId && currentTenantId !== tenantId) {
          // Clear cart when switching to a different restaurant
          set({ tenantId, items: [] });
        } else {
          set({ tenantId });
        }
      },

      addItem: (input: AddToCartInput) => {
        const {
          menuItemId,
          name,
          price,
          quantity = 1,
          selectedOptions = [],
          specialInstructions,
        } = input;

        set((state) => {
          // Check if the same item with same options already exists
          const existingItemIndex = state.items.findIndex(
            (item) =>
              item.menuItemId === menuItemId &&
              JSON.stringify(item.selectedOptions) ===
                JSON.stringify(selectedOptions)
          );

          if (existingItemIndex !== -1) {
            // Update quantity of existing item
            const updatedItems = [...state.items];
            const existingItem = updatedItems[existingItemIndex];
            const newQuantity = existingItem.quantity + quantity;
            updatedItems[existingItemIndex] = {
              ...existingItem,
              quantity: newQuantity,
              totalPrice: calculateItemTotalPrice(
                existingItem.price,
                newQuantity,
                existingItem.selectedOptions
              ),
            };
            return { items: updatedItems };
          }

          // Add new item
          const newItem: CartItem = {
            id: generateCartItemId(),
            menuItemId,
            name,
            price,
            quantity,
            selectedOptions,
            specialInstructions,
            totalPrice: calculateItemTotalPrice(price, quantity, selectedOptions),
          };

          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (cartItemId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== cartItemId),
        }));
      },

      updateQuantity: (cartItemId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.id === cartItemId
              ? {
                  ...item,
                  quantity,
                  totalPrice: calculateItemTotalPrice(
                    item.price,
                    quantity,
                    item.selectedOptions
                  ),
                }
              : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.totalPrice, 0);
      },
    }),
    {
      name: "cart-storage",
    }
  )
);
