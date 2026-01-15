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
        selectedOptions: [],
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
        selectedOptions: [],
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
        selectedOptions: [],
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
        selectedOptions: [],
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
        selectedOptions: [
          {
            optionId: "opt-1",
            optionName: "Size",
            choiceId: "choice-1",
            choiceName: "Large",
            price: 3.0,
          },
          {
            optionId: "opt-2",
            optionName: "Topping",
            choiceId: "choice-2",
            choiceName: "Extra Cheese",
            price: 1.5,
          },
        ],
      });

      const item = useCartStore.getState().items[0];
      // (18.99 + 3.0 + 1.5) * 2 = 23.49 * 2 = 46.98
      expect(item.totalPrice).toBe(46.98);
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
        selectedOptions: [],
      });

      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedOptions: [],
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
        selectedOptions: [],
      });

      addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 1,
        selectedOptions: [
          {
            optionId: "opt-1",
            optionName: "Size",
            choiceId: "choice-1",
            choiceName: "Large",
            price: 3.0,
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
        selectedOptions: [],
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
        selectedOptions: [],
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
        selectedOptions: [
          {
            optionId: "opt-1",
            optionName: "Size",
            choiceId: "choice-1",
            choiceName: "Large",
            price: 3.0,
          },
        ],
      });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().updateQuantity(itemId, 3);

      const item = useCartStore.getState().items[0];
      expect(item.quantity).toBe(3);
      // (18.99 + 3.0) * 3 = 21.99 * 3 = 65.97
      expect(item.totalPrice).toBe(65.97);
    });

    it("should remove item when quantity is set to 0", () => {
      useCartStore.getState().addItem({
        menuItemId: "item-1",
        name: "Pizza",
        price: 18.99,
        quantity: 2,
        selectedOptions: [],
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
        selectedOptions: [],
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
        selectedOptions: [],
      });
      addItem({
        menuItemId: "item-2",
        name: "Pasta",
        price: 15.99,
        quantity: 2,
        selectedOptions: [],
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
        selectedOptions: [],
      });
      addItem({
        menuItemId: "item-2",
        name: "Pasta",
        price: 15.99,
        quantity: 3,
        selectedOptions: [],
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
        selectedOptions: [],
      });
      addItem({
        menuItemId: "item-2",
        name: "Pasta",
        price: 15.99,
        quantity: 1,
        selectedOptions: [],
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
        selectedOptions: [
          {
            optionId: "opt-1",
            optionName: "Size",
            choiceId: "choice-1",
            choiceName: "Large",
            price: 3.0,
          },
        ],
      });

      // (18.99 + 3.0) * 2 = 43.98
      expect(useCartStore.getState().getSubtotal()).toBe(43.98);
    });

    it("should return 0 for empty cart", () => {
      expect(useCartStore.getState().getSubtotal()).toBe(0);
    });
  });
});
