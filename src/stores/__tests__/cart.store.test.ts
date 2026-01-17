import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "../cart.store";

describe("cart.store", () => {
  beforeEach(() => {
    // Reset the store before each test
    useCartStore.setState({ tenantId: null, items: [] });
  });

  describe("setTenantId", () => {
    it("should set tenant id", () => {
      useCartStore.getState().setTenantId("tenant-1");
      expect(useCartStore.getState().tenantId).toBe("tenant-1");
    });

    it("should clear cart when switching to a different tenant", () => {
      const store = useCartStore.getState();
      store.setTenantId("tenant-1");
      store.addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [],
      });

      expect(useCartStore.getState().items.length).toBe(1);

      // Switch to different tenant
      useCartStore.getState().setTenantId("tenant-2");
      expect(useCartStore.getState().tenantId).toBe("tenant-2");
      expect(useCartStore.getState().items.length).toBe(0);
    });

    it("should keep cart when setting same tenant", () => {
      const store = useCartStore.getState();
      store.setTenantId("tenant-1");
      store.addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [],
      });

      // Set same tenant again
      useCartStore.getState().setTenantId("tenant-1");
      expect(useCartStore.getState().items.length).toBe(1);
    });
  });

  describe("addItem", () => {
    it("should add a new item to cart", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Classic Cheese Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [],
      });

      const items = useCartStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0].menuItemId).toBe("item-1");
      expect(items[0].name).toBe("Classic Cheese Pizza");
      expect(items[0].price).toBe(18.99);
      expect(items[0].quantity).toBe(1);
    });

    it("should calculate totalPrice correctly for item without options", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [],
      });

      const item = useCartStore.getState().items[0];
      expect(item.totalPrice).toBe(37.98); // 18.99 * 2
    });

    it("should calculate totalPrice correctly for item with options", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [
          {
            groupId: "opt-1",
            groupName: "Size",
            modifierId: "choice-1",
            modifierName: "Large",
            price: 3.0,
            quantity: 1,
          },
          {
            groupId: "opt-2",
            groupName: "Topping",
            modifierId: "choice-2",
            modifierName: "Extra Cheese",
            price: 1.5,
            quantity: 1,
          },
        ],
      });

      const item = useCartStore.getState().items[0];
      // (18.99 + 3.0 * 1 + 1.5 * 1) * 2 = 23.49 * 2 = 46.98
      expect(item.totalPrice).toBe(46.98);
    });

    it("should calculate totalPrice correctly for modifier with quantity > 1", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [
          {
            groupId: "toppings",
            groupName: "Extra Toppings",
            modifierId: "topping-cheese",
            modifierName: "Extra Cheese",
            price: 1.5,
            quantity: 2, // Double cheese
          },
          {
            groupId: "toppings",
            groupName: "Extra Toppings",
            modifierId: "topping-pepperoni",
            modifierName: "Pepperoni",
            price: 2.0,
            quantity: 3, // Triple pepperoni
          },
        ],
      });

      const item = useCartStore.getState().items[0];
      // 18.99 + (1.5 * 2) + (2.0 * 3) = 18.99 + 3.0 + 6.0 = 27.99
      expect(item.totalPrice).toBe(27.99);
    });

    it("should calculate totalPrice correctly for mixed modifier quantities", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2, // 2 pizzas
        selectedModifiers: [
          {
            groupId: "size",
            groupName: "Size",
            modifierId: "size-l",
            modifierName: "Large",
            price: 4.0,
            quantity: 1,
          },
          {
            groupId: "toppings",
            groupName: "Extra Toppings",
            modifierId: "topping-cheese",
            modifierName: "Extra Cheese",
            price: 1.5,
            quantity: 2, // Double cheese
          },
        ],
      });

      const item = useCartStore.getState().items[0];
      // (18.99 + 4.0 * 1 + 1.5 * 2) * 2 = (18.99 + 4.0 + 3.0) * 2 = 25.99 * 2 = 51.98
      expect(item.totalPrice).toBe(51.98);
    });

    it("should use default quantity of 1 when not provided", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
      });

      const item = useCartStore.getState().items[0];
      expect(item.quantity).toBe(1);
      expect(item.totalPrice).toBe(18.99);
    });

    it("should increment quantity for same item with same options", () => {
      const addItem = useCartStore.getState().addItem;

      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [],
      });

      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [],
      });

      const items = useCartStore.getState().items;
      expect(items.length).toBe(1);
      expect(items[0].quantity).toBe(3);
      expect(items[0].totalPrice).toBe(56.97); // 18.99 * 3
    });

    it("should add separate items for same menu item with different options", () => {
      const addItem = useCartStore.getState().addItem;

      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [],
      });

      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [
          {
            groupId: "opt-1",
            groupName: "Size",
            modifierId: "choice-1",
            modifierName: "Large",
            price: 3.0,
            quantity: 1,
          },
        ],
      });

      const items = useCartStore.getState().items;
      expect(items.length).toBe(2);
    });
  });

  describe("removeItem", () => {
    it("should remove item from cart", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [],
      });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().removeItem(itemId);

      expect(useCartStore.getState().items.length).toBe(0);
    });
  });

  describe("updateQuantity", () => {
    it("should update item quantity", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [],
      });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().updateQuantity(itemId, 5);

      const item = useCartStore.getState().items[0];
      expect(item.quantity).toBe(5);
      expect(item.totalPrice).toBe(94.95); // 18.99 * 5
    });

    it("should update totalPrice with options when quantity changes", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [
          {
            groupId: "opt-1",
            groupName: "Size",
            modifierId: "choice-1",
            modifierName: "Large",
            price: 3.0,
            quantity: 1,
          },
        ],
      });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().updateQuantity(itemId, 3);

      const item = useCartStore.getState().items[0];
      expect(item.quantity).toBe(3);
      // (18.99 + 3.0 * 1) * 3 = 21.99 * 3 = 65.97
      expect(item.totalPrice).toBe(65.97);
    });

    it("should update totalPrice correctly with modifier quantity when item quantity changes", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [
          {
            groupId: "toppings",
            groupName: "Extra Toppings",
            modifierId: "topping-cheese",
            modifierName: "Extra Cheese",
            price: 1.5,
            quantity: 2, // Double cheese
          },
        ],
      });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().updateQuantity(itemId, 3);

      const item = useCartStore.getState().items[0];
      expect(item.quantity).toBe(3);
      // (18.99 + 1.5 * 2) * 3 = 21.99 * 3 = 65.97
      expect(item.totalPrice).toBe(65.97);
    });

    it("should remove item when quantity is set to 0", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [],
      });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().updateQuantity(itemId, 0);

      expect(useCartStore.getState().items.length).toBe(0);
    });

    it("should remove item when quantity is negative", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [],
      });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().updateQuantity(itemId, -1);

      expect(useCartStore.getState().items.length).toBe(0);
    });
  });

  describe("clearCart", () => {
    it("should clear all items from cart", () => {
      const addItem = useCartStore.getState().addItem;
      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedModifiers: [],
      });
      addItem({
        menuItemId: "item-2",
        name: "Pasta",
        price: 15.99,
        quantity: 2,
        selectedModifiers: [],
      });

      expect(useCartStore.getState().items.length).toBe(2);

      useCartStore.getState().clearCart();
      expect(useCartStore.getState().items.length).toBe(0);
    });
  });

  describe("getItemCount", () => {
    it("should return total item count", () => {
      const addItem = useCartStore.getState().addItem;
      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [],
      });
      addItem({
        menuItemId: "item-2",
        name: "Pasta",
        price: 15.99,
        quantity: 3,
        selectedModifiers: [],
      });

      expect(useCartStore.getState().getItemCount()).toBe(5);
    });

    it("should return 0 for empty cart", () => {
      expect(useCartStore.getState().getItemCount()).toBe(0);
    });
  });

  describe("getSubtotal", () => {
    it("should calculate subtotal correctly", () => {
      const addItem = useCartStore.getState().addItem;
      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [],
      });
      addItem({
        menuItemId: "item-2",
        name: "Pasta",
        price: 15.99,
        quantity: 1,
        selectedModifiers: [],
      });

      // 18.99 * 2 + 15.99 * 1 = 37.98 + 15.99 = 53.97
      expect(useCartStore.getState().getSubtotal()).toBe(53.97);
    });

    it("should include option prices in subtotal", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [
          {
            groupId: "opt-1",
            groupName: "Size",
            modifierId: "choice-1",
            modifierName: "Large",
            price: 3.0,
            quantity: 1,
          },
        ],
      });

      // (18.99 + 3.0 * 1) * 2 = 43.98
      expect(useCartStore.getState().getSubtotal()).toBe(43.98);
    });

    it("should include modifier quantity in subtotal calculation", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [
          {
            groupId: "toppings",
            groupName: "Extra Toppings",
            modifierId: "topping-cheese",
            modifierName: "Extra Cheese",
            price: 1.5,
            quantity: 3, // Triple cheese
          },
        ],
      });

      // (18.99 + 1.5 * 3) * 2 = (18.99 + 4.5) * 2 = 23.49 * 2 = 46.98
      expect(useCartStore.getState().getSubtotal()).toBe(46.98);
    });

    it("should return 0 for empty cart", () => {
      expect(useCartStore.getState().getSubtotal()).toBe(0);
    });
  });
});
