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
    claimForCheckout: vi.fn(),
    rollbackCheckoutClaim: vi.fn(),
    attachOrderId: vi.fn(),
  },
}));

vi.mock("@/repositories/menu.repository", () => ({
  menuRepository: {
    getItemsByIdsByCompany: vi.fn(),
    getModifierOptionsByIds: vi.fn().mockResolvedValue([]),
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

vi.mock("@/repositories/order.repository", () => ({
  orderRepository: {
    getByIdWithMerchant: vi.fn(),
  },
}));

// Import mocked modules after vi.mock
import { cartRepository } from "@/repositories/cart.repository";
import { menuRepository } from "@/repositories/menu.repository";
import { taxConfigRepository } from "@/repositories/tax-config.repository";
import { orderService } from "@/services/order";
import { orderRepository } from "@/repositories/order.repository";

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

    it("returns summary with subtotal, taxAmount, totalAmount", async () => {
      const item = makeCartItem({ unitPrice: 10, quantity: 2, totalPrice: 20 });
      const cartWithItems = makeCartWithItems({ cartItems: [item] });
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        cartWithItems as never
      );

      // No taxes configured — summary should reflect subtotal only
      const result = await cartService.getCart("tenant-1", "cart-1");

      expect(result.summary).toBeDefined();
      expect(result.summary.subtotal).toBe(20);
      expect(result.summary.taxAmount).toBe(0);
      expect(result.summary.totalAmount).toBe(20);
    });

    it("returns summary with tax when tax configs exist", async () => {
      const item = makeCartItem({
        menuItemId: "item-taxed",
        unitPrice: 10,
        quantity: 1,
        totalPrice: 10,
      });
      const cartWithItems = makeCartWithItems({ cartItems: [item] });
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        cartWithItems as never
      );

      // Setup tax mocks
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-taxed", ["tax-1"]]])
      );
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        {
          id: "tax-1",
          name: "Sales Tax",
          roundingMethod: "round_half_up",
          inclusionType: "additive",
        } as never,
      ]);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map([["tax-1", 0.1]]) // 10% tax
      );

      const result = await cartService.getCart("tenant-1", "cart-1");

      expect(result.summary.subtotal).toBe(10);
      expect(result.summary.taxAmount).toBe(1); // 10% of $10
      expect(result.summary.totalAmount).toBe(11); // $10 + $1
    });

    it("returns zero summary for empty cart", async () => {
      const cartWithItems = makeCartWithItems({ cartItems: [] });
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        cartWithItems as never
      );

      const result = await cartService.getCart("tenant-1", "cart-1");

      expect(result.summary).toEqual({
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0,
      });
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
      vi.mocked(menuRepository.getModifierOptionsByIds).mockResolvedValue([
        {
          id: "option-1",
          groupId: "group-1",
          name: "Large",
          price: 1.5,
          group: { id: "group-1", name: "Size" },
        } as never,
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

    it("resolves modifier name/groupName/price from DB, ignoring client-sent values", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([
        { id: "menu-item-1", name: "Burger", price: 10.0, imageUrl: null } as never,
      ]);
      vi.mocked(menuRepository.getModifierOptionsByIds).mockResolvedValue([
        {
          id: "option-1",
          groupId: "group-1",
          name: "Medium",
          price: 2.0,
          group: { id: "group-1", name: "Doneness" },
        } as never,
      ]);
      vi.mocked(cartRepository.getNextSortOrder).mockResolvedValue(0);
      vi.mocked(cartRepository.addItem).mockResolvedValue(makeCartItem() as never);
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ cartItems: [makeCartItem()] }) as never
      );

      // Client sends only modifierOptionId (no name/groupName/price)
      await cartService.addItem("tenant-1", "cart-1", {
        menuItemId: "menu-item-1",
        quantity: 1,
        selectedModifiers: [{ modifierOptionId: "option-1" }],
      });

      // Server fills from DB: (10 + 2.0) * 1 = 12
      expect(cartRepository.addItem).toHaveBeenCalledWith(
        "cart-1",
        expect.objectContaining({
          totalPrice: 12,
          modifiers: [
            expect.objectContaining({
              modifierGroupId: "group-1",
              modifierOptionId: "option-1",
              groupName: "Doneness",
              name: "Medium",
              price: 2.0,
              quantity: 1,
            }),
          ],
        })
      );
    });

    it("throws CART_MODIFIER_OPTION_NOT_FOUND when modifier option does not exist", async () => {
      vi.mocked(cartRepository.findById).mockResolvedValue(makeCart() as never);
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([
        { id: "menu-item-1", name: "Burger", price: 10.0, imageUrl: null } as never,
      ]);
      vi.mocked(menuRepository.getModifierOptionsByIds).mockResolvedValue([]);

      await expect(
        cartService.addItem("tenant-1", "cart-1", {
          menuItemId: "menu-item-1",
          quantity: 1,
          selectedModifiers: [{ modifierOptionId: "missing" }],
        })
      ).rejects.toMatchObject({ code: "CART_MODIFIER_OPTION_NOT_FOUND" });
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
      vi.mocked(menuRepository.getModifierOptionsByIds).mockResolvedValue([
        {
          id: "option-1",
          groupId: "group-1",
          name: "Large",
          price: 1.5,
          group: { id: "group-1", name: "Size" },
        } as never,
      ]);
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

    it("returns existing order with alreadyExists=true when cart is already submitted with orderId", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({
          status: "submitted",
          orderId: "order-existing",
          cartItems: [makeCartItem()],
        }) as never
      );
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        id: "order-existing",
        orderNumber: "ORD-999",
      } as never);

      const result = await cartService.checkout("tenant-1", "cart-1", checkoutInput);

      expect(result).toEqual({
        orderId: "order-existing",
        orderNumber: "ORD-999",
        alreadyExists: true,
      });
      expect(orderService.createMerchantOrderAtomic).not.toHaveBeenCalled();
    });

    it("ignores second-call body differences and returns original order", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({
          status: "submitted",
          orderId: "order-existing",
          cartItems: [makeCartItem()],
        }) as never
      );
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        id: "order-existing",
        orderNumber: "ORD-999",
      } as never);

      const differentInput = {
        customerFirstName: "Bob",
        customerLastName: "DifferentLast",
        customerPhone: "555-9999",
        orderMode: "delivery" as const,
        deliveryAddress: {
          street: "1 Elsewhere",
          city: "Elsewhere",
          state: "CA",
          zipCode: "99999",
        },
      };

      const result = await cartService.checkout("tenant-1", "cart-1", differentInput);

      expect(result.orderId).toBe("order-existing");
      expect(result.alreadyExists).toBe(true);
      expect(orderService.createMerchantOrderAtomic).not.toHaveBeenCalled();
    });

    it("throws ORDER_NOT_FOUND when submitted cart references missing order", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({
          status: "submitted",
          orderId: "order-gone",
          cartItems: [makeCartItem()],
        }) as never
      );
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue(null);

      await expect(
        cartService.checkout("tenant-1", "cart-1", checkoutInput)
      ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
      expect(orderService.createMerchantOrderAtomic).not.toHaveBeenCalled();
    });

    it("converts cart items to OrderItemData and calls createMerchantOrderAtomic", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeActiveCartWithItems() as never
      );
      vi.mocked(cartRepository.claimForCheckout).mockResolvedValue({ count: 1 } as never);
      vi.mocked(cartRepository.attachOrderId).mockResolvedValue({ count: 1 } as never);
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
      expect(result).toEqual({
        orderId: "order-1",
        orderNumber: "ORD-001",
        alreadyExists: false,
      });
    });

    it("marks cart as submitted after successful order creation", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeActiveCartWithItems() as never
      );
      vi.mocked(cartRepository.claimForCheckout).mockResolvedValue({ count: 1 } as never);
      vi.mocked(cartRepository.attachOrderId).mockResolvedValue({ count: 1 } as never);
      vi.mocked(orderService.createMerchantOrderAtomic).mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
      } as never);

      await cartService.checkout("tenant-1", "cart-1", checkoutInput);

      expect(cartRepository.claimForCheckout).toHaveBeenCalledWith("tenant-1", "cart-1");
      expect(cartRepository.attachOrderId).toHaveBeenCalledWith(
        "tenant-1",
        "cart-1",
        "order-1"
      );
    });

    it("rolls back cart to active when order creation fails", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ status: "active", cartItems: [makeCartItem()] }) as never
      );
      vi.mocked(cartRepository.claimForCheckout).mockResolvedValue({ count: 1 } as never);
      vi.mocked(orderService.createMerchantOrderAtomic).mockRejectedValue(
        new Error("menu item gone")
      );
      vi.mocked(cartRepository.rollbackCheckoutClaim).mockResolvedValue({ count: 1 } as never);

      await expect(
        cartService.checkout("tenant-1", "cart-1", checkoutInput)
      ).rejects.toThrow("menu item gone");

      expect(cartRepository.rollbackCheckoutClaim).toHaveBeenCalledWith("tenant-1", "cart-1");
      expect(cartRepository.attachOrderId).not.toHaveBeenCalled();
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

    it("throws CART_NOT_ACTIVE when cart is cancelled", async () => {
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(
        makeCartWithItems({ status: "cancelled", cartItems: [makeCartItem()] }) as never
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

    it("waits and returns peer's order when CAS loses the race (peer succeeded)", async () => {
      vi.useFakeTimers();

      // First getCart call: cart is active
      // Subsequent findById calls (inside waitAndRetry poll): cart is submitted + orderId
      const activeCart = makeCartWithItems({ status: "active", cartItems: [makeCartItem()] });
      const submittedCart = makeCart({
        status: "submitted",
        orderId: "order-peer",
      });
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(activeCart as never);
      vi.mocked(cartRepository.findById).mockResolvedValue(submittedCart as never);
      vi.mocked(cartRepository.claimForCheckout).mockResolvedValue({ count: 0 } as never);
      vi.mocked(orderRepository.getByIdWithMerchant).mockResolvedValue({
        id: "order-peer",
        orderNumber: "ORD-PEER",
      } as never);

      const promise = cartService.checkout("tenant-1", "cart-1", checkoutInput);
      await vi.advanceTimersByTimeAsync(100); // one poll tick
      const result = await promise;

      expect(result).toEqual({
        orderId: "order-peer",
        orderNumber: "ORD-PEER",
        alreadyExists: true,
      });
      expect(orderService.createMerchantOrderAtomic).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("re-enters checkout when peer rolls back during wait", async () => {
      vi.useFakeTimers();

      const activeCart = makeCartWithItems({ status: "active", cartItems: [makeCartItem()] });
      const activeRow = makeCart({ status: "active", orderId: null });
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(activeCart as never);
      vi.mocked(cartRepository.findById).mockResolvedValue(activeRow as never);
      // First claim: lose. Second claim (after re-enter): win.
      vi.mocked(cartRepository.claimForCheckout)
        .mockResolvedValueOnce({ count: 0 } as never)
        .mockResolvedValueOnce({ count: 1 } as never);
      vi.mocked(cartRepository.attachOrderId).mockResolvedValue({ count: 1 } as never);
      vi.mocked(orderService.createMerchantOrderAtomic).mockResolvedValue({
        id: "order-new",
        orderNumber: "ORD-NEW",
      } as never);

      const promise = cartService.checkout("tenant-1", "cart-1", checkoutInput);
      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result).toEqual({
        orderId: "order-new",
        orderNumber: "ORD-NEW",
        alreadyExists: false,
      });
      expect(cartRepository.claimForCheckout).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("throws CART_CHECKOUT_IN_PROGRESS when wait times out (stuck submitted+null)", async () => {
      vi.useFakeTimers();

      const stuckCartWithItems = makeCartWithItems({
        status: "submitted",
        orderId: null,
        cartItems: [makeCartItem()],
      });
      const stuckRow = makeCart({ status: "submitted", orderId: null });
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(stuckCartWithItems as never);
      vi.mocked(cartRepository.findById).mockResolvedValue(stuckRow as never);

      const promise = cartService.checkout("tenant-1", "cart-1", checkoutInput);
      // Attach rejection handler early so unhandled-rejection warnings don't fire
      const assertion = expect(promise).rejects.toMatchObject({
        code: "CART_CHECKOUT_IN_PROGRESS",
      });
      await vi.advanceTimersByTimeAsync(600); // 5 × 100ms + slack
      await assertion;

      expect(orderService.createMerchantOrderAtomic).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("throws CART_CHECKOUT_IN_PROGRESS when peer rolls back repeatedly (recursion depth cap)", async () => {
      vi.useFakeTimers();

      const activeCart = makeCartWithItems({ status: "active", cartItems: [makeCartItem()] });
      const activeRow = makeCart({ status: "active", orderId: null });
      vi.mocked(cartRepository.findByIdWithItems).mockResolvedValue(activeCart as never);
      vi.mocked(cartRepository.findById).mockResolvedValue(activeRow as never);
      // Always lose the CAS
      vi.mocked(cartRepository.claimForCheckout).mockResolvedValue({ count: 0 } as never);

      const promise = cartService.checkout("tenant-1", "cart-1", checkoutInput);
      const assertion = expect(promise).rejects.toMatchObject({
        code: "CART_CHECKOUT_IN_PROGRESS",
      });
      await vi.advanceTimersByTimeAsync(2000); // ample time for retries to give up
      await assertion;

      vi.useRealTimers();
    });
  });
});
