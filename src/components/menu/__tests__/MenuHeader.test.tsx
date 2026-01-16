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
    it("should hide cart button with CSS when cart is empty", () => {
      render(
        <MenuHeader
          merchantName="Test Restaurant"
          merchantLogo={null}
          tenantSlug="test"
        />,
        { wrapper: createWrapper("USD", "en-US") }
      );

      // Cart button is rendered but hidden via opacity
      const viewCartButton = screen.getByText("View Cart");
      expect(viewCartButton).toBeInTheDocument();

      // Parent container should have opacity-0 class
      const cartContainer = viewCartButton.closest(".fixed");
      expect(cartContainer).toHaveClass("opacity-0");
      expect(cartContainer).toHaveClass("pointer-events-none");
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

      const viewCartButton = screen.getByText("View Cart");
      expect(viewCartButton).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();

      // Parent container should have opacity-100 class
      const cartContainer = viewCartButton.closest(".fixed");
      expect(cartContainer).toHaveClass("opacity-100");
      expect(cartContainer).not.toHaveClass("pointer-events-none");
    });
  });

  describe("fly-to-cart animation target", () => {
    it("should always render cart-icon-target element for animation", () => {
      render(
        <MenuHeader
          merchantName="Test Restaurant"
          merchantLogo={null}
          tenantSlug="test"
        />,
        { wrapper: createWrapper("USD", "en-US") }
      );

      // cart-icon-target should always be present for fly-to-cart animation
      const cartIconTarget = document.getElementById("cart-icon-target");
      expect(cartIconTarget).toBeInTheDocument();
    });

    it("should render cart-icon-target on the cart count badge", () => {
      useCartStore.setState({
        tenantId: "test",
        items: [
          {
            id: "1",
            menuItemId: "item-1",
            name: "Test Item",
            price: 10,
            quantity: 5,
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
        { wrapper: createWrapper("USD", "en-US") }
      );

      const cartIconTarget = document.getElementById("cart-icon-target");
      expect(cartIconTarget).toBeInTheDocument();
      // The target should contain the item count
      expect(cartIconTarget).toHaveTextContent("5");
    });
  });
});
