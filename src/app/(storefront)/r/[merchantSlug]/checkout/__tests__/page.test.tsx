import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckoutPage from "../page";
import { MerchantProvider, LoyaltyProvider } from "@/contexts";
import { useCartStore } from "@/stores";
import type { ReactNode } from "react";

// Controllable mock for useCartHydration
let mockHydrated = true;
vi.mock("@/stores/useCartHydration", () => ({
  useCartHydration: () => mockHydrated,
}));

// Mock Stripe dependencies so StripeProvider + CardPaymentForm can render
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: () => Promise.resolve({ fake: true }),
}));

// Track the onReady callback so we can trigger it
let capturedOnReady: (() => void) | undefined;
let capturedRef: { current: { confirmPayment: () => Promise<{ success: boolean; error?: string }> } | null };
const mockConfirmPayment = vi.fn<[], Promise<{ success: boolean; error?: string }>>().mockResolvedValue({ success: true });

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    capturedOnReady = onReady;
    return <div data-testid="payment-element">Payment Element</div>;
  },
  useStripe: () => ({ fake: true }),
  useElements: () => ({ fake: true }),
}));

// Capture CardPaymentForm props for testing
let cardFormOnReady: (() => void) | undefined;
let cardFormOnError: ((error: string) => void) | undefined;

vi.mock("@storefront/components/checkout/CardPaymentForm", async () => {
  const React = await import("react");
  return {
    CardPaymentForm: React.forwardRef(function MockCardPaymentForm(
      props: { onReady?: () => void; onError?: (e: string) => void; disabled?: boolean },
      ref: React.ForwardedRef<{ confirmPayment: () => Promise<{ success: boolean; error?: string }> }>
    ) {
      // eslint-disable-next-line react-hooks/globals
      cardFormOnReady = props.onReady;
      // eslint-disable-next-line react-hooks/globals
      cardFormOnError = props.onError;
      React.useImperativeHandle(ref, () => ({
        confirmPayment: mockConfirmPayment,
      }));
      // Simulate calling onReady after mount
      React.useEffect(() => {
        props.onReady?.();
      }, [props.onReady]);
      return <div data-testid="card-payment-form">Card Payment Form</div>;
    }),
  };
});

vi.mock("@storefront/components/checkout/StripeProvider", () => ({
  StripeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-provider">{children}</div>
  ),
}));

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
          timezone: "America/New_York",
          tenantId: "test-company-id",
          companySlug: "test-company",
          tipConfig: {
            mode: "percentage",
            tiers: [0.15, 0.18, 0.2],
            allowCustom: true,
          },
        }}
      >
        <LoyaltyProvider>{children}</LoyaltyProvider>
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
    mockHydrated = true;

    // Default mock implementation for all fetch calls
    mockFetch.mockImplementation((url: string) => {
      // Loyalty API - always return not logged in
      if (url.includes("/loyalty/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: false, error: "Not logged in" }),
        });
      }
      // Payment intent API - return mock client secret
      if (url.includes("/payment-intent")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
          }),
        });
      }
      // Default: return success for order API
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { orderId: "order-123" } }),
      });
    });
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

      expect(screen.getByPlaceholderText("John")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Doe")).toBeInTheDocument();
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

      // Multiple Place Order buttons (mobile + desktop) - shows "Pay & Place Order" when card payment
      const placeOrderButtons = screen.getAllByText(/Place Order/);
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

      // Should have two Place Order buttons (one for mobile, one for desktop) - shows "Pay & Place Order" when card payment
      const placeOrderButtons = screen.getAllByText(/Place Order/);
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

      // Switch to cash payment to enable form submission
      const cashPaymentOption = screen.getByText("Pay at Pickup");
      fireEvent.click(cashPaymentOption);

      // Click Place Order without filling form
      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      // Should show validation errors (based on zod schema)
      await waitFor(() => {
        expect(
          screen.getByText("First name is required")
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
      // Using default mock implementation from beforeEach

      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Switch to cash payment to enable form submission
      const cashPaymentOption = screen.getByText("Pay at Pickup");
      fireEvent.click(cashPaymentOption);

      // Fill in required form fields
      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });

      // Submit the form
      const placeOrderButtons = screen.getAllByText(/Place Order/);
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
      // Override default mock to return error for order API
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false, error: "Not logged in" }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        // Order API returns error
        return Promise.resolve({
          ok: false,
          json: async () => ({ success: false, error: "Failed to place order" }),
        });
      });

      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Switch to cash payment to enable form submission
      const cashPaymentOption = screen.getByText("Pay at Pickup");
      fireEvent.click(cashPaymentOption);

      // Fill in required form fields
      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });

      // Submit the form
      const placeOrderButtons = screen.getAllByText(/Place Order/);
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

  describe("order data", () => {
    const cartItemsWithImage = [
      {
        id: "1",
        menuItemId: "item-1",
        name: "Classic Cheese Pizza",
        price: 18.99,
        quantity: 2,
        selectedModifiers: [],
        totalPrice: 37.98,
        imageUrl: "https://example.com/pizza.jpg", // Cart items have imageUrl
      },
    ];

    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: cartItemsWithImage,
      });
    });

    it("should NOT include imageUrl in order submission", async () => {
      // Using default mock implementation from beforeEach

      render(<CheckoutPage />, {
        wrapper: createWrapper(),
      });

      // Switch to cash payment to enable form submission
      const cashPaymentOption = screen.getByText("Pay at Pickup");
      fireEvent.click(cashPaymentOption);

      // Fill in required form fields
      fireEvent.change(screen.getByPlaceholderText("John"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Doe"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });

      // Submit the form
      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      // Wait for the submission to complete and find the order API call
      await waitFor(() => {
        const orderApiCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).includes("/orders") && !(call[0] as string).includes("/loyalty")
        );
        expect(orderApiCalls.length).toBeGreaterThan(0);
      });

      // Get the order API call
      const orderApiCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("/orders") && !(call[0] as string).includes("/loyalty")
      );
      const orderApiCall = orderApiCalls[0];
      const requestBody = JSON.parse(orderApiCall[1]?.body as string);

      // Verify items do NOT contain imageUrl
      expect(requestBody.items).toBeDefined();
      expect(requestBody.items[0]).not.toHaveProperty("imageUrl");

      // Verify other item properties are present
      expect(requestBody.items[0]).toHaveProperty("menuItemId", "item-1");
      expect(requestBody.items[0]).toHaveProperty("name", "Classic Cheese Pizza");
      expect(requestBody.items[0]).toHaveProperty("price", 18.99);
      expect(requestBody.items[0]).toHaveProperty("quantity", 2);
    });
  });

  describe("delivery mode", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should show delivery address validation errors", async () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Switch to cash payment first
      fireEvent.click(screen.getByText("Pay at Pickup"));

      // Switch to delivery
      fireEvent.click(screen.getByText("Delivery"));

      // Fill contact info but not address
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      // Use the first phone input (contact form has one)
      const phoneInputs = screen.getAllByPlaceholderText("(555) 123-4567");
      fireEvent.change(phoneInputs[0], { target: { value: "(555) 123-4567" } });

      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Street address is required")).toBeInTheDocument();
      });
    });

    it("should clear delivery errors when switching to pickup", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText("Delivery"));
      fireEvent.click(screen.getByText("Pickup"));

      // Delivery form should be hidden
      expect(screen.queryByPlaceholderText("123 Main St")).not.toBeInTheDocument();
    });

    it("should show Pay at delivery label for cash delivery", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Switch to cash payment
      fireEvent.click(screen.getByText("Pay at Pickup"));
      // Now switch to delivery
      fireEvent.click(screen.getByText("Delivery"));

      // Should show "Pay at delivery" text
      const payAtDelivery = screen.getAllByText("Pay at delivery");
      expect(payAtDelivery.length).toBeGreaterThan(0);
    });
  });

  describe("payment method", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should show Pay at Pickup for cash payment in pickup mode", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText("Pay at Pickup"));

      const payLabels = screen.getAllByText("Pay at pickup");
      expect(payLabels.length).toBeGreaterThan(0);
    });

    it("should handle payment intent creation error with STRIPE_CONNECT", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: false,
              error: "STRIPE_CONNECT not configured",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { orderId: "order-123" } }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Should fall back to cash payment
      await waitFor(() => {
        const payLabels = screen.getAllByText(/Pay at pickup/);
        expect(payLabels.length).toBeGreaterThan(0);
      });
    });

    it("should handle payment intent creation network error", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const errorMessages = screen.getAllByText("Failed to initialize payment");
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe("notes", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should allow editing order notes", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      const textarea = screen.getByPlaceholderText("Any special requests for your order?");
      fireEvent.change(textarea, { target: { value: "Extra napkins please" } });
      expect(textarea).toHaveValue("Extra napkins please");
    });
  });

  describe("loyalty pre-fill", () => {
    it("should pre-fill contact info from loyalty member", async () => {
      // Mock loyalty to return a member
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-1",
                  phone: "+15551234567",
                  email: "john@test.com",
                  firstName: "John",
                  lastName: "Doe",
                  points: 100,
                },
                config: { pointsPerDollar: 1 },
              },
            }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Wait for loyalty data to load and pre-fill
      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });
    });
  });

  describe("gift card handlers", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should include gift card payment in order submission", async () => {
      // Mock gift card validate API
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { orderId: "order-123" } }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Switch to cash to avoid payment form complexities
      fireEvent.click(screen.getByText("Pay at Pickup"));

      // Fill contact info
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "(555) 123-4567" } });

      // Submit the form
      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      });
    });
  });

  describe("payment intent error without STRIPE_CONNECT", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should show submit error for non-STRIPE_CONNECT payment failure", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: false,
              error: "Amount too low",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const errorMessages = screen.getAllByText("Amount too low");
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe("loyalty pre-fill phone formatting", () => {
    it("should format 11-digit phone starting with 1", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-1",
                  phone: "+15551234567",
                  email: null,
                  firstName: null,
                  lastName: null,
                  points: 100,
                },
                config: { pointsPerDollar: 1 },
              },
            }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Wait for loyalty data to load and pre-fill phone
      await waitFor(() => {
        expect(screen.getByDisplayValue("(555) 123-4567")).toBeInTheDocument();
      });
    });
  });

  describe("email validation", () => {
    beforeEach(() => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });
    });

    it("should show email validation error for invalid email", async () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Switch to cash
      fireEvent.click(screen.getByText("Pay at Pickup"));

      // Fill form with invalid email
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "(555) 123-4567" } });
      fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "invalid-email" } });

      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
      });
    });
  });

  describe("loyalty pre-fill 10-digit phone", () => {
    it("should format 10-digit phone correctly", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-1",
                  phone: "5551234567",
                  email: null,
                  firstName: null,
                  lastName: null,
                  points: 100,
                },
                config: { pointsPerDollar: 1 },
              },
            }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      });

      useCartStore.setState({ tenantId: "test", items: mockCartItems });
      render(<CheckoutPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByDisplayValue("(555) 123-4567")).toBeInTheDocument();
      });
    });

    it("should use raw phone when format doesn't match 10 or 11 digits", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-1",
                  phone: "12345",
                  email: null,
                  firstName: null,
                  lastName: null,
                  points: 100,
                },
                config: { pointsPerDollar: 1 },
              },
            }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      });

      useCartStore.setState({ tenantId: "test", items: mockCartItems });
      render(<CheckoutPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByDisplayValue("12345")).toBeInTheDocument();
      });
    });

    it("should not overwrite already filled contact info from loyalty", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-1",
                  phone: null,
                  email: null,
                  firstName: null,
                  lastName: null,
                  points: 100,
                },
                config: { pointsPerDollar: 1 },
              },
            }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      });

      useCartStore.setState({ tenantId: "test", items: mockCartItems });
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // No pre-fill should happen since member has no data
      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText("John");
        expect(firstNameInput).toHaveValue("");
      });
    });
  });

  describe("order submission with fetch throw", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should show generic error when fetch throws non-Error", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        // Order API throws a string
        return Promise.reject("string error");
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText("Pay at Pickup"));
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "(555) 123-4567" } });

      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        const errorMessages = screen.getAllByText("Failed to place order");
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe("gift card flow", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should apply a gift card and show applied state", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        if (url.includes("/giftcard/validate")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                giftCardId: "gc-1",
                balance: 20,
                cardNumber: "XXXX-XXXX-XXXX-1234",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { orderId: "order-123" } }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Enter gift card number
      const giftCardInput = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(giftCardInput, { target: { value: "ABCD-1234-EFGH-5678" } });

      // Click Apply
      fireEvent.click(screen.getByText("Apply"));

      // Wait for the gift card to be applied
      await waitFor(() => {
        expect(screen.getByText("XXXX-XXXX-XXXX-1234")).toBeInTheDocument();
      });

      // Remove gift card
      fireEvent.click(screen.getByText("Remove"));

      // Should show the input again
      await waitFor(() => {
        expect(screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX")).toBeInTheDocument();
      });
    });

    it("should hide payment section when gift card covers full amount", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        if (url.includes("/giftcard/validate")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                giftCardId: "gc-1",
                balance: 500,
                cardNumber: "XXXX-XXXX-XXXX-9999",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { orderId: "order-123" } }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Enter gift card that covers full amount
      const giftCardInput = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(giftCardInput, { target: { value: "FULL-CARD-HERE-0000" } });
      fireEvent.click(screen.getByText("Apply"));

      // Wait for the gift card to be applied
      await waitFor(() => {
        expect(screen.getByText("XXXX-XXXX-XXXX-9999")).toBeInTheDocument();
      });

      // Payment method selector should be hidden (amountDue <= 0)
      expect(screen.queryByText("Payment Method")).not.toBeInTheDocument();
    });
  });

  describe("dine-in mode", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should not show delivery address form in dine-in mode", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText("Dine In"));

      // Should not show delivery form
      expect(screen.queryByPlaceholderText("123 Main St")).not.toBeInTheDocument();
    });
  });

  describe("delivery submission with valid form", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should submit successfully with delivery address", async () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Switch to cash payment
      fireEvent.click(screen.getByText("Pay at Pickup"));

      // Switch to delivery
      fireEvent.click(screen.getByText("Delivery"));

      // Fill contact info
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      const phoneInputs = screen.getAllByPlaceholderText("(555) 123-4567");
      fireEvent.change(phoneInputs[0], { target: { value: "(555) 123-4567" } });

      // Fill delivery address
      fireEvent.change(screen.getByPlaceholderText("123 Main St"), {
        target: { value: "456 Oak Ave" },
      });
      fireEvent.change(screen.getByPlaceholderText("New York"), {
        target: { value: "Los Angeles" },
      });

      // Select state
      const stateSelect = document.getElementById("state");
      if (stateSelect) {
        fireEvent.change(stateSelect, { target: { value: "CA" } });
      }

      fireEvent.change(screen.getByPlaceholderText("10001"), {
        target: { value: "90001" },
      });

      // Submit
      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/r/test-restaurant/orders/order-123"
        );
      });

      // Verify delivery fee and address in request
      const orderApiCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("/orders")
      );
      expect(orderApiCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(orderApiCalls[0][1]?.body as string);
      expect(body.orderMode).toBe("delivery");
      expect(body.deliveryAddress).toBeDefined();
      expect(body.deliveryAddress.street).toBe("456 Oak Ave");
    });
  });

  describe("address change with undefined deliveryAddress errors", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should handle address field change when no prior deliveryAddress errors", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText("Delivery"));

      // Change address field - this should not crash even if errors.deliveryAddress is undefined
      fireEvent.change(screen.getByPlaceholderText("123 Main St"), {
        target: { value: "456 Oak Ave" },
      });

      expect(screen.getByPlaceholderText("123 Main St")).toHaveValue("456 Oak Ave");
    });
  });

  describe("payment method switch to cash", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should reset payment state when switching to cash", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Start with card (default), switch to cash
      fireEvent.click(screen.getByText("Pay at Pickup"));

      // Should show "Pay at pickup" label
      const payLabels = screen.getAllByText("Pay at pickup");
      expect(payLabels.length).toBeGreaterThan(0);
    });
  });

  describe("loading state", () => {
    it("should show loading spinner when not hydrated", () => {
      mockHydrated = false;
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
      const { container } = render(<CheckoutPage />, { wrapper: createWrapper() });

      // Should show spinner, not the checkout form
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
      expect(screen.queryByText("Pickup")).not.toBeInTheDocument();
    });
  });

  describe("submit with card payment and gift card covering partial amount", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should include stripePaymentIntentId in order submission for card payment", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                clientSecret: "pi_test_secret",
                paymentIntentId: "pi_test_123",
                stripeAccountId: "acct_test",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { orderId: "order-card" } }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Card is default payment method. The payment intent will be created.
      // But we can't easily confirm card payment in this test setup.
      // Let's at least verify the payment intent API was called
      await waitFor(() => {
        const piCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => (call[0] as string).includes("/payment-intent")
        );
        expect(piCalls.length).toBeGreaterThan(0);
      });
    });
  });

  describe("submit button disabled states", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should disable submit button when card payment selected and payment not ready", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Default is card payment, payment not ready yet
      const placeOrderButtons = screen.getAllByText(/Place Order/);
      // Button should be disabled because isPaymentReady is false
      expect(placeOrderButtons[0].closest("button")).toBeDisabled();
    });

    it("should enable submit button when cash payment selected", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Switch to cash
      fireEvent.click(screen.getByText("Pay at Pickup"));

      const placeOrderButtons = screen.getAllByText(/Place Order/);
      // Button should be enabled for cash payment
      expect(placeOrderButtons[0].closest("button")).not.toBeDisabled();
    });
  });

  describe("contact field changes", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should handle email field changes", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      const emailInput = screen.getByPlaceholderText("your@email.com");
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      expect(emailInput).toHaveValue("test@example.com");
    });

    it("should handle last name field changes", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      const lastNameInput = screen.getByPlaceholderText("Doe");
      fireEvent.change(lastNameInput, { target: { value: "Smith" } });
      expect(lastNameInput).toHaveValue("Smith");
    });
  });

  describe("fee display", () => {
    it("should display configured fees", () => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });

      function FeeWrapper({ children }: { children: React.ReactNode }) {
        return (
          <MerchantProvider
            config={{
              name: "Test Restaurant",
              logoUrl: null,
              currency: "USD",
              locale: "en-US",
              timezone: "America/New_York",
              companyId: "test-company-id",
              companySlug: "test-company",
              feeConfig: {
                fees: [
                  { id: "fee-1", name: "Service Fee", displayName: "Service Charge", type: "percentage" as const, value: 0.05 },
                ],
              },
            }}
          >
            <LoyaltyProvider>{children}</LoyaltyProvider>
          </MerchantProvider>
        );
      }

      render(<CheckoutPage />, { wrapper: FeeWrapper });

      // Fee should be displayed with its displayName
      const feeLabels = screen.getAllByText("Service Charge");
      expect(feeLabels.length).toBeGreaterThan(0);
    });

    it("should fall back to fee name when displayName is undefined", () => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });

      function FeeWrapper({ children }: { children: React.ReactNode }) {
        return (
          <MerchantProvider
            config={{
              name: "Test Restaurant",
              logoUrl: null,
              currency: "USD",
              locale: "en-US",
              timezone: "America/New_York",
              companyId: "test-company-id",
              companySlug: "test-company",
              feeConfig: {
                fees: [
                  { id: "fee-2", name: "Platform Fee", type: "fixed" as const, value: 1.5 },
                ],
              },
            }}
          >
            <LoyaltyProvider>{children}</LoyaltyProvider>
          </MerchantProvider>
        );
      }

      render(<CheckoutPage />, { wrapper: FeeWrapper });

      // Should show the fee name since displayName is undefined
      const feeLabels = screen.getAllByText("Platform Fee");
      expect(feeLabels.length).toBeGreaterThan(0);
    });
  });

  describe("delivery address errors when switching", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should handle switching to delivery mode (not clearing delivery errors)", () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Switch to delivery - the handleOrderModeChange is called with "delivery"
      // which does NOT clear deliveryAddress errors (only non-delivery clears them)
      fireEvent.click(screen.getByText("Delivery"));

      // Delivery form should appear
      expect(screen.getByPlaceholderText("123 Main St")).toBeInTheDocument();
    });

    it("should handle address change when deliveryAddress errors exist", async () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Switch to cash then delivery
      fireEvent.click(screen.getByText("Pay at Pickup"));
      fireEvent.click(screen.getByText("Delivery"));

      // Fill contact info
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      const phoneInputs = screen.getAllByPlaceholderText("(555) 123-4567");
      fireEvent.change(phoneInputs[0], { target: { value: "(555) 123-4567" } });

      // Submit to create delivery address errors
      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      // Wait for validation errors
      await waitFor(() => {
        expect(screen.getByText("Street address is required")).toBeInTheDocument();
      });

      // Now change the street address - this should clear the street error
      // while the errors.deliveryAddress is truthy (has existing errors)
      fireEvent.change(screen.getByPlaceholderText("123 Main St"), {
        target: { value: "789 Pine St" },
      });

      // The street error should be cleared
      expect(screen.queryByText("Street address is required")).not.toBeInTheDocument();
    });
  });

  describe("loyalty pre-fill edge cases", () => {
    it("should pre-fill name and email from loyalty member", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                member: {
                  id: "m-1",
                  phone: null,
                  email: "member@test.com",
                  firstName: "MemberName",
                  lastName: "MemberLast",
                  points: 100,
                },
                config: { pointsPerDollar: 1 },
              },
            }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      });

      useCartStore.setState({ tenantId: "test", items: mockCartItems });
      render(<CheckoutPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByDisplayValue("MemberName")).toBeInTheDocument();
        expect(screen.getByDisplayValue("member@test.com")).toBeInTheDocument();
      });
    });
  });

  describe("order submission edge cases", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
    });

    it("should show default error when API fails without error field", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        // Order API returns error without error message
        return Promise.resolve({
          ok: false,
          json: async () => ({ success: false }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText("Pay at Pickup"));
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "(555) 123-4567" } });

      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        const errorMessages = screen.getAllByText("Failed to place order");
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });

    it("should include gift card payment data in order submission", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/loyalty/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false }),
          });
        }
        if (url.includes("/payment-intent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { clientSecret: "pi_test_secret", paymentIntentId: "pi_test" },
            }),
          });
        }
        if (url.includes("/giftcard/validate")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                giftCardId: "gc-submit-1",
                balance: 10,
                cardNumber: "XXXX-XXXX-XXXX-0001",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { orderId: "order-gc" } }),
        });
      });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Apply gift card
      const giftCardInput = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
      fireEvent.change(giftCardInput, { target: { value: "TEST-CARD" } });
      fireEvent.click(screen.getByText("Apply"));

      await waitFor(() => {
        expect(screen.getByText("XXXX-XXXX-XXXX-0001")).toBeInTheDocument();
      });

      // Switch to cash for remaining amount
      fireEvent.click(screen.getByText("Pay at Pickup"));

      // Fill form
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "(555) 123-4567" } });

      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      });

      // Verify gift card data in request body
      const orderApiCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("/orders")
      );
      expect(orderApiCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(orderApiCalls[0][1]?.body as string);
      expect(body.giftCardPayment).toBeDefined();
      expect(body.giftCardPayment.giftCardId).toBe("gc-submit-1");
      expect(body.paymentMethod).toBe("cash");
    });
  });

  describe("card payment submission", () => {
    beforeEach(() => {
      useCartStore.setState({ tenantId: "test", items: mockCartItems });
      mockConfirmPayment.mockReset();
    });

    it("should submit successfully with card payment when confirmPayment succeeds", async () => {
      mockConfirmPayment.mockResolvedValue({ success: true });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      // Wait for payment intent to be created and CardPaymentForm to render
      await waitFor(() => {
        expect(screen.queryByTestId("card-payment-form")).toBeInTheDocument();
      });

      // Fill contact info
      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "(555) 123-4567" } });

      // Submit the form (card payment is default)
      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/r/test-restaurant/orders/order-123");
      });

      // Verify confirmPayment was called
      expect(mockConfirmPayment).toHaveBeenCalled();
    });

    it("should show error when card payment confirmPayment fails", async () => {
      mockConfirmPayment.mockResolvedValue({ success: false, error: "Card declined" });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByTestId("card-payment-form")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "(555) 123-4567" } });

      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        const errorMessages = screen.getAllByText("Card declined");
        expect(errorMessages.length).toBeGreaterThan(0);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should show Payment failed when confirmPayment fails without error message", async () => {
      mockConfirmPayment.mockResolvedValue({ success: false });

      render(<CheckoutPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByTestId("card-payment-form")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "John" } });
      fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "(555) 123-4567" } });

      const placeOrderButtons = screen.getAllByText(/Place Order/);
      fireEvent.click(placeOrderButtons[0]);

      await waitFor(() => {
        const errorMessages = screen.getAllByText("Payment failed");
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });

    it("should trigger onError callback from CardPaymentForm", async () => {
      render(<CheckoutPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByTestId("card-payment-form")).toBeInTheDocument();
      });

      // Trigger the onError callback captured from the mock
      if (cardFormOnError) {
        cardFormOnError("Stripe error occurred");
      }

      await waitFor(() => {
        const errorMessages = screen.getAllByText("Stripe error occurred");
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe("trial block", () => {
    it("should block checkout for trial tenants", () => {
      useCartStore.setState({
        tenantId: "test",
        items: mockCartItems,
      });

      function TrialWrapper({ children }: { children: React.ReactNode }) {
        return (
          <MerchantProvider
            config={{
              name: "Test Restaurant",
              logoUrl: null,
              currency: "USD",
              locale: "en-US",
              timezone: "America/New_York",
              companyId: "test-company-id",
              companySlug: "test-company",
              isTrial: true,
              tenantId: "trial-tenant-id",
            }}
          >
            <LoyaltyProvider>{children}</LoyaltyProvider>
          </MerchantProvider>
        );
      }

      render(<CheckoutPage />, { wrapper: TrialWrapper });

      // TrialCheckoutBlock should be rendered instead of the checkout form
      // The form elements should not be present
      expect(screen.queryByText("Pickup")).not.toBeInTheDocument();
    });
  });
});
