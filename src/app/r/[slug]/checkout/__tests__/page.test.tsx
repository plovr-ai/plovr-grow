import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CheckoutPage from "../page";
import { MerchantProvider } from "@/contexts";
import { useCartStore } from "@/stores";
import type { ReactNode } from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "test-restaurant" }),
}));

function createWrapper(currency: string, locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider config={{ currency, locale }}>
        {children}
      </MerchantProvider>
    );
  };
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    // Reset cart store before each test
    useCartStore.setState({ tenantId: null, items: [] });
  });

  describe("currency formatting", () => {
    it("should display prices in USD format", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Classic Cheese Pizza",
            price: 18.99,
            quantity: 2,
            selectedOptions: [],
            totalPrice: 37.98,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      // Item price per unit
      expect(screen.getByText("$18.99 each")).toBeInTheDocument();
      // Item total, subtotal, and total all show $37.98
      const priceElements = screen.getAllByText("$37.98");
      expect(priceElements.length).toBeGreaterThanOrEqual(1);
    });

    it("should display prices in EUR format with de-DE locale", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 100,
            quantity: 1,
            selectedOptions: [],
            totalPrice: 100,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("EUR", "de-DE"),
      });

      // German format with € symbol
      const priceElements = screen.getAllByText(/100,00.*€/);
      expect(priceElements.length).toBeGreaterThan(0);
    });

    it("should display prices in CNY format", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 50,
            quantity: 2,
            selectedOptions: [],
            totalPrice: 100,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("CNY", "zh-CN"),
      });

      expect(screen.getByText(/¥50\.00 each/)).toBeInTheDocument();
      // Item total, subtotal, and total all show ¥100.00
      const priceElements = screen.getAllByText("¥100.00");
      expect(priceElements.length).toBeGreaterThanOrEqual(1);
    });

    it("should display prices in GBP format", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 25,
            quantity: 1,
            selectedOptions: [],
            totalPrice: 25,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("GBP", "en-GB"),
      });

      expect(screen.getByText("£25.00 each")).toBeInTheDocument();
    });

    it("should display subtotal in correct currency", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Item 1",
            price: 10,
            quantity: 2,
            selectedOptions: [],
            totalPrice: 20,
            imageUrl: null,
          },
          {
            id: "2",
            menuItemId: "item-2",
            name: "Item 2",
            price: 15,
            quantity: 1,
            selectedOptions: [],
            totalPrice: 15,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      // Subtotal and total both show $35.00
      const priceElements = screen.getAllByText("$35.00");
      expect(priceElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("empty cart", () => {
    it("should display empty cart message", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
      expect(
        screen.getByText("Add some delicious items from our menu")
      ).toBeInTheDocument();
    });

    it("should display Browse Menu button", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Browse Menu")).toBeInTheDocument();
    });
  });

  describe("cart operations", () => {
    it("should display item count in header", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 10,
            quantity: 3,
            selectedOptions: [],
            totalPrice: 30,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Your Cart (3 items)")).toBeInTheDocument();
    });

    it("should display singular 'item' for quantity of 1", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 10,
            quantity: 1,
            selectedOptions: [],
            totalPrice: 10,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Your Cart (1 item)")).toBeInTheDocument();
    });

    it("should update quantity when + button is clicked", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 10,
            quantity: 1,
            selectedOptions: [],
            totalPrice: 10,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      // Find and click the + button
      const plusButtons = screen.getAllByRole("button");
      const plusButton = plusButtons.find((btn) =>
        btn.querySelector('path[d="M12 4v16m8-8H4"]')
      );

      if (plusButton) {
        fireEvent.click(plusButton);
      }

      // Check that quantity increased
      expect(useCartStore.getState().items[0].quantity).toBe(2);
    });

    it("should remove item when quantity becomes 0", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 10,
            quantity: 1,
            selectedOptions: [],
            totalPrice: 10,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      // Find and click the - button (which should be delete icon when quantity is 1)
      const minusButtons = screen.getAllByRole("button");
      const minusButton = minusButtons.find(
        (btn) =>
          btn.querySelector('path[d*="M19 7l-.867"]') || // delete icon path
          btn.querySelector('path[d="M20 12H4"]') // minus icon path
      );

      if (minusButton) {
        fireEvent.click(minusButton);
      }

      // Check that item was removed
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe("selected options display", () => {
    it("should display selected options", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Pizza",
            price: 18.99,
            quantity: 1,
            selectedOptions: [
              {
                optionId: "size",
                optionName: "Size",
                choiceId: "large",
                choiceName: "Large",
                price: 3,
              },
              {
                optionId: "topping",
                optionName: "Topping",
                choiceId: "cheese",
                choiceName: "Extra Cheese",
                price: 1.5,
              },
            ],
            totalPrice: 23.49,
            imageUrl: null,
          },
        ],
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Large, Extra Cheese")).toBeInTheDocument();
    });
  });
});
