import { describe, it, expect, vi, beforeEach } from "vitest";
import { CartService } from "../cart.service";

// Mock dependencies at top level
vi.mock("@/lib/db", () => ({ default: {} }));

vi.mock("@/repositories/cart.repository", () => ({
  cartRepository: {
    create: vi.fn(),
    findByIdWithItems: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
    addItem: vi.fn(),
    findItemById: vi.fn(),
    updateItem: vi.fn(),
    replaceItemModifiers: vi.fn(),
    softDeleteItem: vi.fn(),
    getNextSortOrder: vi.fn(),
  },
}));

vi.mock("@/repositories/menu.repository", () => ({
  menuRepository: {
    getItemsByIdsByCompany: vi.fn(),
  },
}));

vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getMenuItemsTaxConfigIds: vi.fn().mockResolvedValue(new Map()),
    getTaxConfigsByIds: vi.fn().mockResolvedValue([]),
    getMerchantTaxRateMap: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock("@/services/order", () => ({
  orderService: {
    createMerchantOrderAtomic: vi.fn(),
  },
}));

// Import mocked modules after vi.mock
import { cartRepository } from "@/repositories/cart.repository";
import { menuRepository } from "@/repositories/menu.repository";
import { orderService } from "@/services/order";

// Helper factories
function makeCart(overrides: Record<string, unknown> = {}) {
  return {
    id: "cart-1",
    tenantId: "tenant-1",
    merchantId: "merchant-1",
    status: "active",
    salesChannel: "phone_order",
    notes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    deleted: false,
    ...overrides,
  };
}

function makeCartWithItems(overrides: Record<string, unknown> = {}) {
  return {
    ...makeCart(),
    cartItems: [],
    ...overrides,
  };
}

function makeCartItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    menuItemId: "menu-item-1",
    name: "Burger",
    unitPrice: 12.99,
    quantity: 2,
    totalPrice: 25.98,
    specialInstructions: null,
    imageUrl: null,
    sortOrder: 0,
    modifiers: [],
    ...overrides,
  };
}

function makeModifier(overrides: Record<string, unknown> = {}) {
  return {
    id: "mod-1",
    modifierGroupId: "group-1",
    modifierOptionId: "option-1",
    groupName: "Size",
    name: "Large",
    price: 1.5,
    quantity: 1,
    ...overrides,
  };
}

describe("CartService", () => {
  let cartService: CartService;

  beforeEach(() => {
    vi.clearAllMocks();
    cartService = new CartService();
  });

  // ------------------------------------------------------------------ //
  // createCart
  // ------------------------------------------------------------------ //
  describe("createCart()", () => {
    it("creates a cart with salesChannel and notes", async () => {
      const createdCart = makeCart({ notes: "no onions" });
      vi.mocked(cartRepository.create).mockResolvedValue(createdCart as never);

      const result = await cartService.createCart("tenant-1", "merchant-1", {
        salesChannel: "phone_order",
        notes: "no onions",
      });

      expect(cartRepository.create).toHaveBeenCalledWith("tenant-1", "merchant-1", {
        salesChannel: "phone_order",
        notes: "no onions",
      });
      expect(result).toEqual(createdCart);
    });

    it("creates a cart without notes", async () => {
      const createdCart = makeCart();
      vi.mocked(cartRepository.create).mockResolvedValue(createdCart as never);

      await cartService.createCart("tenant-1", "merchant-1", {
        salesChannel: "phone_order",
      });

      expect(cartRepository.create).toHaveBeenCalledWith("tenant-1", "merchant-1", {
        salesChannel: "phone_order",
        notes: undefined,
      });
    });
  });

  // ------------------------------------------------------------------ //
  // getCart
  // ------------------------------------------------------------------ //
  describe("getCart()", () => {
    it("returns a CartWithItems with mapped items and modifiers", async () => {
      const modifier = makeModifier();
      const item = makeCartItem({ modifiers: [modifier] });
      const cartWithItems = makeCartWithItems({ cartItems: [item] });
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        cartWithItems as never
      );

      const result = await cartService.getCart("tenant-1", "cart-1");

      expect(result.id).toBe("cart-1");
      expect(result.items).toHaveLength(1);
      expect(result.items[0].unitPrice).toBe(12.99);
      expect(result.items[0].totalPrice).toBe(25.98);
      expect(result.items[0].modifiers).toHaveLength(1);
      expect(result.items[0].modifiers[0].price).toBe(1.5);
    });

    it("throws CART_NOT_FOUND when cart does not exist", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(null);

      await expect(cartService.getCart("tenant-1", "missing-cart")).rejects.toMatchObject({
        code: "CART_NOT_FOUND",
      });
    });
  });

  // ------------------------------------------------------------------ //
  // cancelCart
  // ------------------------------------------------------------------ //
  describe("cancelCart()", () => {
    it("cancels an active cart", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(cartRepository.updateStatus).mockResolvedValue({} as never);

      await cartService.cancelCart("tenant-1", "cart-1");

      expect(cartRepository.updateStatus).toHaveBeenCalledWith(
        "tenant-1",
        "cart-1",
        "cancelled"
      );
    });

    it("throws CART_NOT_ACTIVE for a submitted cart", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(
        makeCart({ status: "submitted" }) as never
      );

      await expect(cartService.cancelCart("tenant-1", "cart-1")).rejects.toMatchObject({
        code: "CART_NOT_ACTIVE",
      });
      expect(cartRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("throws CART_NOT_FOUND when cart does not exist", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(null);

      await expect(cartService.cancelCart("tenant-1", "missing")).rejects.toMatchObject({
        code: "CART_NOT_FOUND",
      });
    });
  });

  // ------------------------------------------------------------------ //
  // addItem
  // ------------------------------------------------------------------ //
  describe("addItem()", () => {
    const addInput = {
      menuItemId: "menu-item-1",
      quantity: 2,
    };

    it("adds an item using DB price, not input price", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([
        { id: "menu-item-1", name: "Burger", price: 12.99, imageUrl: null } as never,
      ]);
      vi.mocked(cartRepository.getNextSortOrder).mockResolvedValue(0);
      vi.mocked(cartRepository.addItem).mockResolvedValue(makeCartItem() as never);
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ cartItems: [makeCartItem()] }) as never
      );

      const result = await cartService.addItem("tenant-1", "cart-1", addInput);

      expect(cartRepository.addItem).toHaveBeenCalledWith(
        "cart-1",
        expect.objectContaining({
          menuItemId: "menu-item-1",
          name: "Burger",
          unitPrice: 12.99,
          quantity: 2,
          totalPrice: 25.98,
          sortOrder: 0,
          modifiers: [],
        })
      );
      expect(result.items[0].unitPrice).toBe(12.99);
    });

    it("calculates totalPrice including modifier prices", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([
        { id: "menu-item-1", name: "Burger", price: 10.0, imageUrl: null } as never,
      ]);
      vi.mocked(cartRepository.getNextSortOrder).mockResolvedValue(1);
      vi.mocked(cartRepository.addItem).mockResolvedValue(
        makeCartItem({ unitPrice: 10, totalPrice: 23, quantity: 2 }) as never
      );
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ cartItems: [makeCartItem({ unitPrice: 10, totalPrice: 23, quantity: 2 })] }) as never
      );

      await cartService.addItem("tenant-1", "cart-1", {
        ...addInput,
        selectedModifiers: [
          {
            modifierGroupId: "group-1",
            modifierOptionId: "option-1",
            groupName: "Size",
            name: "Large",
            price: 1.5,
            quantity: 1,
          },
        ],
      });

      // totalPrice = (10 + 1.5*1) * 2 = 23
      expect(cartRepository.addItem).toHaveBeenCalledWith(
        "cart-1",
        expect.objectContaining({ totalPrice: 23 })
      );
    });

    it("throws CART_MENU_ITEM_NOT_FOUND when menu item does not exist", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([]);

      await expect(
        cartService.addItem("tenant-1", "cart-1", addInput)
      ).rejects.toMatchObject({ code: "CART_MENU_ITEM_NOT_FOUND" });
    });

    it("throws CART_NOT_ACTIVE when cart is cancelled", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(
        makeCart({ status: "cancelled" }) as never
      );

      await expect(
        cartService.addItem("tenant-1", "cart-1", addInput)
      ).rejects.toMatchObject({ code: "CART_NOT_ACTIVE" });
    });

    it("throws CART_NOT_FOUND when cart does not exist", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(null);

      await expect(
        cartService.addItem("tenant-1", "missing", addInput)
      ).rejects.toMatchObject({ code: "CART_NOT_FOUND" });
    });
  });

  // ------------------------------------------------------------------ //
  // updateItem
  // ------------------------------------------------------------------ //
  describe("updateItem()", () => {
    it("updates quantity and recalculates totalPrice", async () => {
      const existingItem = makeCartItem({ quantity: 1, unitPrice: 10.0, modifiers: [] });
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(cartRepository.findItemById).mockResolvedValue(existingItem as never);
      vi.mocked(cartRepository.updateItem).mockResolvedValue(
        makeCartItem({ quantity: 3, totalPrice: 30 }) as never
      );
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ cartItems: [makeCartItem({ quantity: 3, totalPrice: 30 })] }) as never
      );

      const result = await cartService.updateItem("tenant-1", "cart-1", "item-1", {
        quantity: 3,
      });

      expect(cartRepository.updateItem).toHaveBeenCalledWith(
        "item-1",
        expect.objectContaining({ quantity: 3, totalPrice: 30 })
      );
      expect(result.items[0].quantity).toBe(3);
      expect(result.items[0].totalPrice).toBe(30);
    });

    it("replaces modifiers when selectedModifiers is provided", async () => {
      const existingItem = makeCartItem({ unitPrice: 10.0, modifiers: [] });
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(cartRepository.findItemById).mockResolvedValue(existingItem as never);
      vi.mocked(cartRepository.replaceItemModifiers).mockResolvedValue(undefined);
      vi.mocked(cartRepository.updateItem).mockResolvedValue(
        makeCartItem({ totalPrice: 23 }) as never
      );
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ cartItems: [makeCartItem({ totalPrice: 23 })] }) as never
      );

      await cartService.updateItem("tenant-1", "cart-1", "item-1", {
        quantity: 2,
        selectedModifiers: [
          {
            modifierGroupId: "group-1",
            modifierOptionId: "option-1",
            groupName: "Size",
            name: "Large",
            price: 1.5,
            quantity: 1,
          },
        ],
      });

      expect(cartRepository.replaceItemModifiers).toHaveBeenCalledWith(
        "item-1",
        expect.arrayContaining([expect.objectContaining({ name: "Large" })])
      );
      // totalPrice = (10 + 1.5) * 2 = 23
      expect(cartRepository.updateItem).toHaveBeenCalledWith(
        "item-1",
        expect.objectContaining({ totalPrice: 23 })
      );
    });

    it("throws CART_ITEM_NOT_FOUND when item does not exist", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(cartRepository.findItemById).mockResolvedValue(null);

      await expect(
        cartService.updateItem("tenant-1", "cart-1", "missing-item", { quantity: 2 })
      ).rejects.toMatchObject({ code: "CART_ITEM_NOT_FOUND" });
    });

    it("throws CART_NOT_ACTIVE when cart is submitted", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(
        makeCart({ status: "submitted" }) as never
      );

      await expect(
        cartService.updateItem("tenant-1", "cart-1", "item-1", { quantity: 2 })
      ).rejects.toMatchObject({ code: "CART_NOT_ACTIVE" });
    });

    it("throws CART_NOT_FOUND when cart does not exist", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(null);

      await expect(
        cartService.updateItem("tenant-1", "missing", "item-1", { quantity: 2 })
      ).rejects.toMatchObject({ code: "CART_NOT_FOUND" });
    });
  });

  // ------------------------------------------------------------------ //
  // removeItem
  // ------------------------------------------------------------------ //
  describe("removeItem()", () => {
    it("soft-deletes an item from an active cart and returns updated cart", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(cartRepository.findItemById).mockResolvedValue(makeCartItem() as never);
      vi.mocked(cartRepository.softDeleteItem).mockResolvedValue(undefined);
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ cartItems: [] }) as never
      );

      const result = await cartService.removeItem("tenant-1", "cart-1", "item-1");

      expect(cartRepository.softDeleteItem).toHaveBeenCalledWith("item-1");
      expect(result.items).toHaveLength(0);
    });

    it("throws CART_ITEM_NOT_FOUND when item does not exist", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(cartRepository.findItemById).mockResolvedValue(null);

      await expect(
        cartService.removeItem("tenant-1", "cart-1", "missing-item")
      ).rejects.toMatchObject({ code: "CART_ITEM_NOT_FOUND" });
      expect(cartRepository.softDeleteItem).not.toHaveBeenCalled();
    });

    it("throws CART_NOT_ACTIVE when cart is cancelled", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(
        makeCart({ status: "cancelled" }) as never
      );

      await expect(
        cartService.removeItem("tenant-1", "cart-1", "item-1")
      ).rejects.toMatchObject({ code: "CART_NOT_ACTIVE" });
    });

    it("throws CART_NOT_FOUND when cart does not exist", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(null);

      await expect(
        cartService.removeItem("tenant-1", "missing", "item-1")
      ).rejects.toMatchObject({ code: "CART_NOT_FOUND" });
    });
  });

  // ------------------------------------------------------------------ //
  // checkout
  // ------------------------------------------------------------------ //
  describe("checkout()", () => {
    const checkoutInput = {
      customerFirstName: "John",
      customerLastName: "Doe",
      customerPhone: "555-1234",
      orderMode: "pickup" as const,
    };

    function makeActiveCartWithItems() {
      const modifier = makeModifier();
      const item = makeCartItem({ modifiers: [modifier] });
      return makeCartWithItems({ cartItems: [item] });
    }

    it("converts cart items to OrderItemData and calls createMerchantOrderAtomic", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeActiveCartWithItems() as never
      );
      vi.mocked(orderService.createMerchantOrderAtomic).mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
      } as never);
      vi.mocked(cartRepository.updateStatus).mockResolvedValue({} as never);

      const result = await cartService.checkout("tenant-1", "cart-1", checkoutInput);

      expect(orderService.createMerchantOrderAtomic).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({
          merchantId: "merchant-1",
          customerFirstName: "John",
          customerLastName: "Doe",
          salesChannel: "phone_order",
          paymentType: "in_store",
          items: expect.arrayContaining([
            expect.objectContaining({
              menuItemId: "menu-item-1",
              name: "Burger",
              price: 12.99,
              quantity: 2,
              selectedModifiers: expect.arrayContaining([
                expect.objectContaining({
                  groupId: "group-1",
                  modifierId: "option-1",
                  modifierName: "Large",
                  price: 1.5,
                }),
              ]),
            }),
          ]),
        })
      );
      expect(result).toEqual({ orderId: "order-1", orderNumber: "ORD-001" });
    });

    it("marks cart as submitted after successful order creation", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeActiveCartWithItems() as never
      );
      vi.mocked(orderService.createMerchantOrderAtomic).mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
      } as never);
      vi.mocked(cartRepository.updateStatus).mockResolvedValue({} as never);

      await cartService.checkout("tenant-1", "cart-1", checkoutInput);

      expect(cartRepository.updateStatus).toHaveBeenCalledWith(
        "tenant-1",
        "cart-1",
        "submitted"
      );
    });

    it("throws CART_EMPTY when cart has no items", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ cartItems: [] }) as never
      );

      await expect(
        cartService.checkout("tenant-1", "cart-1", checkoutInput)
      ).rejects.toMatchObject({ code: "CART_EMPTY" });
      expect(orderService.createMerchantOrderAtomic).not.toHaveBeenCalled();
    });

    it("throws CART_NOT_ACTIVE when cart is submitted", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeActiveCartWithItems() as never
        // Override status inside the mock cart
      );
      // Override the getCart result to return a submitted cart
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ status: "submitted", cartItems: [makeCartItem()] }) as never
      );

      await expect(
        cartService.checkout("tenant-1", "cart-1", checkoutInput)
      ).rejects.toMatchObject({ code: "CART_NOT_ACTIVE" });
      expect(orderService.createMerchantOrderAtomic).not.toHaveBeenCalled();
    });

    it("throws CART_NOT_FOUND when cart does not exist", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(null);

      await expect(
        cartService.checkout("tenant-1", "missing", checkoutInput)
      ).rejects.toMatchObject({ code: "CART_NOT_FOUND" });
    });
  });
});
