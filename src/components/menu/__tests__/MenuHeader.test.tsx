import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MenuHeader } from "../MenuHeader";
import { MerchantProvider } from "@/contexts";
import { useCartStore } from "@/stores";
import type { ReactNode } from "react";

function createWrapper(currency: string, locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider config={{ currency, locale }}>
        {children}
      </MerchantProvider>
    );
  };
}

describe("MenuHeader", () => {
  beforeEach(() => {
    // Reset cart store before each test
    useCartStore.setState({ tenantId: null, items: [] });
  });

  describe("currency formatting", () => {
    it("should display price in USD format", () => {
      // Add item to cart
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 18.99,
            quantity: 2,
            selectedOptions: [],
            totalPrice: 37.98,
          },
        ],
      });

      render(
        <MenuHeader
          merchantName="Test Restaurant"
          merchantLogo={null}
          tenantSlug="test"
        />,
        { wrapper: createWrapper("USD", "en-US") }
      );

      // Should display USD formatted price
      expect(screen.getByText("$37.98")).toBeInTheDocument();
    });

    it("should display price in EUR format with de-DE locale", () => {
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
          },
        ],
      });

      render(
        <MenuHeader
          merchantName="Test Restaurant"
          merchantLogo={null}
          tenantSlug="test"
        />,
        { wrapper: createWrapper("EUR", "de-DE") }
      );

      // Should display EUR formatted price (German format)
      const priceElement = screen.getByText(/100,00/);
      expect(priceElement).toBeInTheDocument();
      expect(priceElement.textContent).toContain("€");
    });

    it("should display price in CNY format", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 50,
            quantity: 1,
            selectedOptions: [],
            totalPrice: 50,
          },
        ],
      });

      render(
        <MenuHeader
          merchantName="Test Restaurant"
          merchantLogo={null}
          tenantSlug="test"
        />,
        { wrapper: createWrapper("CNY", "zh-CN") }
      );

      // Should display CNY formatted price
      const priceElement = screen.getByText(/¥50\.00/);
      expect(priceElement).toBeInTheDocument();
    });

    it("should display price in GBP format", () => {
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
          },
        ],
      });

      render(
        <MenuHeader
          merchantName="Test Restaurant"
          merchantLogo={null}
          tenantSlug="test"
        />,
        { wrapper: createWrapper("GBP", "en-GB") }
      );

      // Should display GBP formatted price
      expect(screen.getByText("£25.00")).toBeInTheDocument();
    });
  });

  describe("cart button visibility", () => {
    it("should not show cart button when cart is empty", () => {
      render(
        <MenuHeader
          merchantName="Test Restaurant"
          merchantLogo={null}
          tenantSlug="test"
        />,
        { wrapper: createWrapper("USD", "en-US") }
      );

      expect(screen.queryByText("View Cart")).not.toBeInTheDocument();
    });

    it("should show cart button with item count when cart has items", () => {
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
          },
        ],
      });

      render(
        <MenuHeader
          merchantName="Test Restaurant"
          merchantLogo={null}
          tenantSlug="test"
        />,
        { wrapper: createWrapper("USD", "en-US") }
      );

      expect(screen.getByText("View Cart")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });
});
