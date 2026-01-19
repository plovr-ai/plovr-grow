import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckoutPage from "../page";
import { MerchantProvider } from "@/contexts";
import { useCartStore } from "@/stores";
import type { ReactNode } from "react";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ merchantSlug: "test-restaurant" }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper(currency = "USD", locale = "en-US") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider
        config={{
          name: "Test Restaurant",
          logoUrl: null,
          currency,
          locale,
          fees: [],
          tipConfig: {
            mode: "percentage",
            tiers: [0.15, 0.18, 0.2],
            allowCustom: true,
          },
        }}
      >
        {children}
      </MerchantProvider>
    );
  };
}

const mockCartItems = [
  {
    id: "1",
    menuItemId: "item-1",
    name: "Classic Cheese Pizza",
    price: 18.99,
    quantity: 2,
    selectedModifiers: [],
    totalPrice: 37.98,
    imageUrl: null,
  },
];

describe("CheckoutPage", () => {
  beforeEach(() => {
    // Reset cart store before each test
    useCartStore.setState({ tenantId: null, items: [] });
    mockFetch.mockReset();
    mockPush.mockReset();
  });

  describe("empty cart", () => {
    it("should display empty cart message when cart is empty", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
      expect(
        screen.getByText("Add some items before checking out")
      ).toBeInTheDocument();
    });

    it("should display Browse Menu button when cart is empty", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Browse Menu")).toBeInTheDocument();
    });
  });

  describe("checkout form", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should display order type selector", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Pickup")).toBeInTheDocument();
      expect(screen.getByText("Delivery")).toBeInTheDocument();
      expect(screen.getByText("Dine In")).toBeInTheDocument();
    });

    it("should display contact info form", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByPlaceholderText("Your full name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    });

    it("should display tip selector", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("None")).toBeInTheDocument();
      expect(screen.getByText(/15%/)).toBeInTheDocument();
    });

    it("should display order notes textarea", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByPlaceholderText("Any special requests for your order?")
      ).toBeInTheDocument();
    });

    it("should show delivery address form when delivery is selected", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Click on Delivery
      fireEvent.click(screen.getByText("Delivery"));

      // Delivery address form should appear
      expect(screen.getByPlaceholderText("123 Main St")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("New York")).toBeInTheDocument();
    });
  });

  describe("price summary", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should display subtotal", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Multiple Subtotal labels (mobile + desktop)
      const subtotalLabels = screen.getAllByText("Subtotal");
      expect(subtotalLabels.length).toBeGreaterThan(0);
    });

    it("should display total amount", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Multiple Total labels (mobile + desktop)
      const totalLabels = screen.getAllByText("Total");
      expect(totalLabels.length).toBeGreaterThan(0);
    });

    it("should display Place Order button", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Multiple Place Order buttons (mobile + desktop)
      const placeOrderButtons = screen.getAllByText("Place Order");
      expect(placeOrderButtons.length).toBeGreaterThan(0);
    });
  });

  describe("responsive layout", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should have responsive grid layout classes", () => {
      const { container } = render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Check that the main content has responsive grid classes
      const gridContainer = container.querySelector(
        ".lg\\:grid.lg\\:grid-cols-3"
      );
      expect(gridContainer).toBeInTheDocument();

      // Check that left column has col-span-2 class
      const leftColumn = container.querySelector(".lg\\:col-span-2");
      expect(leftColumn).toBeInTheDocument();
    });

    it("should have desktop sidebar with lg:block class", () => {
      const { container } = render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Check for desktop sidebar (hidden on mobile, visible on lg+)
      const desktopSidebar = container.querySelector(".hidden.lg\\:block");
      expect(desktopSidebar).toBeInTheDocument();

      // Check for sticky positioning
      const stickySidebar = container.querySelector(".sticky.top-24");
      expect(stickySidebar).toBeInTheDocument();
    });

    it("should have mobile fixed footer with lg:hidden class", () => {
      const { container } = render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Check for mobile footer (visible on mobile, hidden on lg+)
      const mobileFooter = container.querySelector(
        ".lg\\:hidden.fixed.bottom-0"
      );
      expect(mobileFooter).toBeInTheDocument();
    });

    it("should have Order Summary in desktop sidebar", () => {
      const { container } = render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Desktop sidebar contains OrderSummary component
      const desktopSidebar = container.querySelector(".hidden.lg\\:block");
      expect(desktopSidebar).toBeInTheDocument();

      // Check for "Your Order" text which is in OrderSummary (multiple matches due to mobile + desktop)
      const yourOrderElements = screen.getAllByText(/Your Order/);
      expect(yourOrderElements.length).toBeGreaterThan(0);
    });

    it("should have Place Order button in both mobile and desktop views", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Should have two Place Order buttons (one for mobile, one for desktop)
      const placeOrderButtons = screen.getAllByText("Place Order");
      expect(placeOrderButtons).toHaveLength(2);
    });

    it("should have PriceSummary in both mobile and desktop views", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Should have Subtotal in both views
      const subtotalLabels = screen.getAllByText("Subtotal");
      expect(subtotalLabels).toHaveLength(2);

      // Should have Total in both views
      const totalLabels = screen.getAllByText("Total");
      expect(totalLabels).toHaveLength(2);
    });

  });

  describe("form validation", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should show validation errors when submitting empty form", async () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Click Place Order without filling form
      const placeOrderButtons = screen.getAllByText("Place Order");
      fireEvent.click(placeOrderButtons[0]);

      // Should show validation errors (based on zod schema)
      await waitFor(() => {
        expect(
          screen.getByText("Name must be at least 2 characters")
        ).toBeInTheDocument();
      });
    });
  });

  describe("order submission", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should not show empty cart page after successful order", async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { orderId: "order-123" },
        }),
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Fill in required form fields
      fireEvent.change(screen.getByPlaceholderText("Your full name"), {
        target: { value: "John Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });

      // Submit the form
      const placeOrderButtons = screen.getAllByText("Place Order");
      fireEvent.click(placeOrderButtons[0]);

      // Wait for the submission to complete
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/r/test-restaurant/orders/order-123"
        );
      });

      // Should NOT show empty cart message after successful order
      expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument();
    });

    it("should show error message when order fails", async () => {
      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "Failed to place order",
        }),
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Fill in required form fields
      fireEvent.change(screen.getByPlaceholderText("Your full name"), {
        target: { value: "John Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });

      // Submit the form
      const placeOrderButtons = screen.getAllByText("Place Order");
      fireEvent.click(placeOrderButtons[0]);

      // Wait for error message to appear (mobile + desktop)
      await waitFor(() => {
        const errorMessages = screen.getAllByText("Failed to place order");
        expect(errorMessages.length).toBeGreaterThan(0);
      });

      // Should NOT redirect
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("currency formatting", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should display prices in USD format", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      // Check for USD formatted prices
      const priceElements = screen.getAllByText(/\$37\.98/);
      expect(priceElements.length).toBeGreaterThan(0);
    });

    it("should display prices in EUR format", () => {
      render(<CheckoutPage />, {
        wrapper: createWrapper("EUR", "de-DE"),
      });

      // Check for EUR formatted prices (German format)
      const priceElements = screen.getAllByText(/37,98.*€/);
      expect(priceElements.length).toBeGreaterThan(0);
    });
  });
});
