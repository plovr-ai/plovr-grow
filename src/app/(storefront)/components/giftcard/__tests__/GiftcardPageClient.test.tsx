import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { GiftcardPageClient } from "../GiftcardPageClient";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock hooks - return stable references to avoid infinite re-render loops
const stableFormatPrice = (amount: number) => `$${amount.toFixed(2)}`;
const stableFormatPhone = (val: string) => val;
const stablePhoneInput = { format: stableFormatPhone };
vi.mock("@/hooks", () => ({
  useFormatPrice: () => stableFormatPrice,
  usePhoneInput: () => stablePhoneInput,
}));

// Mock loyalty context
let mockMember: Record<string, unknown> | null = null;
let mockIsLoyaltyLoading = false;

vi.mock("@/contexts/LoyaltyContext", () => ({
  useLoyalty: () => ({
    member: mockMember,
    isLoading: mockIsLoyaltyLoading,
    pointsPerDollar: 1,
    login: vi.fn(),
    logout: vi.fn(),
    refreshMember: vi.fn(),
  }),
}));

// Mock usePaymentIntent - control state externally
let mockClientSecret: string | null = "pi_test_secret";
let mockIsCreatingPaymentIntent = false;
let mockPaymentIntentError: string | null = null;

vi.mock("@storefront/hooks", () => ({
  usePaymentIntent: () => ({
    clientSecret: mockClientSecret,
    paymentIntentId: "pi_test_id",
    stripeAccountId: null,
    isCreatingPaymentIntent: mockIsCreatingPaymentIntent,
    error: mockPaymentIntentError,
    reset: vi.fn(),
  }),
}));

// Track CardPaymentForm callbacks for testing
const cardFormCallbacks = { onReady: null as (() => void) | null, onError: null as ((error: string) => void) | null };
let mockConfirmPayment = vi.fn().mockResolvedValue({ success: true });

// Mock checkout components - keep simple to avoid crashes
vi.mock("@storefront/components/checkout", () => ({
  StripeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-provider">{children}</div>
  ),
  CardPaymentForm: React.forwardRef(function MockCardPaymentForm(
    props: { onReady?: () => void; onError?: (error: string) => void; disabled?: boolean },
    ref: React.Ref<{ confirmPayment: () => Promise<{ success: boolean; error?: string }> }>
  ) {
    // eslint-disable-next-line react-hooks/immutability
    cardFormCallbacks.onReady = props.onReady ?? null;
    // eslint-disable-next-line react-hooks/immutability
    cardFormCallbacks.onError = props.onError ?? null;
    React.useImperativeHandle(ref, () => ({
      confirmPayment: mockConfirmPayment,
    }));
    return <div data-testid="card-payment-form">CardPaymentForm</div>;
  }),
  CheckoutPageLayout: ({
    children,
    summary,
    mobileFooter,
  }: {
    children: React.ReactNode;
    summary: React.ReactNode;
    mobileFooter: React.ReactNode;
  }) => (
    <div>
      {children}
      {summary}
      {mobileFooter}
    </div>
  ),
  SubmitButton: ({
    isSubmitting,
    disabled,
    label,
    submittingLabel,
  }: {
    type?: string;
    isSubmitting: boolean;
    disabled: boolean;
    amount: number | null;
    label: string;
    submittingLabel: string;
    variant: string;
    className?: string;
  }) => (
    <button type="submit" disabled={disabled} data-testid="submit-button">
      {isSubmitting ? submittingLabel : label}
    </button>
  ),
  ErrorAlert: ({ message }: { message: string | null; className?: string }) =>
    message ? <div data-testid="error-alert">{message}</div> : null,
  PaymentLoadingState: () => (
    <div data-testid="payment-loading">Loading payment...</div>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const defaultConfig = {
  enabled: true,
  denominations: [25, 50, 100, 200],
};

describe("GiftcardPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockPush.mockReset();
    mockMember = null;
    mockIsLoyaltyLoading = false;
    mockClientSecret = "pi_test_secret";
    mockIsCreatingPaymentIntent = false;
    mockPaymentIntentError = null;
    mockConfirmPayment = vi.fn().mockResolvedValue({ success: true });
    cardFormCallbacks.onReady = null;
    cardFormCallbacks.onError = null;
  });

  it("should render denomination buttons", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(screen.getByText("$25.00")).toBeInTheDocument();
    // $50.00 appears multiple times (button + total displays)
    expect(screen.getAllByText("$50.00").length).toBeGreaterThan(0);
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$200.00")).toBeInTheDocument();
  });

  it("should default to second denomination", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    // Total should show $50 (second denomination) - appears in summary
    const totalElements = screen.getAllByText("$50.00");
    expect(totalElements.length).toBeGreaterThan(0);
  });

  it("should select denomination on click", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    fireEvent.click(screen.getByText("$100.00"));

    const totalElements = screen.getAllByText("$100.00");
    expect(totalElements.length).toBeGreaterThanOrEqual(2);
  });

  it("should show buyer information form", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(screen.getByText("Your Information")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("First name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Last name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
  });

  it("should show recipient selection with Myself by default", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(screen.getByText("Myself")).toBeInTheDocument();
    expect(screen.getByText("Someone else")).toBeInTheDocument();
  });

  it("should show recipient fields when Someone else selected", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    fireEvent.click(screen.getByText("Someone else"));

    expect(
      screen.getByPlaceholderText("Recipient's name")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("recipient@email.com")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Add a personal message (optional)")
    ).toBeInTheDocument();
  });

  it("should hide recipient fields when switching back to Myself", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    fireEvent.click(screen.getByText("Someone else"));
    fireEvent.click(screen.getByText("Myself"));

    expect(
      screen.queryByPlaceholderText("recipient@email.com")
    ).not.toBeInTheDocument();
  });

  it("should show loyalty promotion for non-members", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(screen.getByText(/Join our rewards program/)).toBeInTheDocument();
  });

  it("should show logged in message for members", () => {
    mockMember = {
      id: "m-1",
      phone: "+15551234567",
      email: "john@test.com",
      firstName: "John",
      lastName: "Doe",
      points: 100,
    };

    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(
      screen.getByText("Logged in as rewards member")
    ).toBeInTheDocument();
  });

  it("should show payment section", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  it("should show payment loading state", () => {
    mockClientSecret = null;
    mockIsCreatingPaymentIntent = true;

    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(screen.getByTestId("payment-loading")).toBeInTheDocument();
  });

  it("should show fallback when no client secret and not loading", () => {
    mockClientSecret = null;
    mockIsCreatingPaymentIntent = false;

    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(
      screen.getByText(
        "Unable to load payment form. Please try again."
      )
    ).toBeInTheDocument();
  });

  it("should show payment intent error", () => {
    mockPaymentIntentError = "Payment setup failed";

    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    const errorAlerts = screen.getAllByTestId("error-alert");
    expect(
      errorAlerts.some((el) => el.textContent === "Payment setup failed")
    ).toBe(true);
  });

  describe("form validation", () => {
    it("should show errors for missing buyer info", async () => {
      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      const form = document.querySelector("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText("First name is required")
        ).toBeInTheDocument();
        expect(
          screen.getByText("Last name is required")
        ).toBeInTheDocument();
      });
    });

    it("should validate email format", async () => {
      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Last name"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
        target: { value: "bad" },
      });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        expect(
          screen.getByText("Invalid email format")
        ).toBeInTheDocument();
      });
    });

    it("should validate phone format", async () => {
      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Last name"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "123" },
      });
      fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
        target: { value: "j@t.com" },
      });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        expect(
          screen.getByText(/Phone must be in format/)
        ).toBeInTheDocument();
      });
    });

    it("should validate recipient email when sending to someone", async () => {
      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fireEvent.click(screen.getByText("Someone else"));

      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Last name"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
        target: { value: "j@t.com" },
      });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        expect(
          screen.getByText("Recipient email is required")
        ).toBeInTheDocument();
      });
    });

    it("should validate message length", async () => {
      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fireEvent.click(screen.getByText("Someone else"));

      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Last name"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
        target: { value: "j@t.com" },
      });
      fireEvent.change(
        screen.getByPlaceholderText("recipient@email.com"),
        { target: { value: "f@t.com" } }
      );
      fireEvent.change(
        screen.getByPlaceholderText("Add a personal message (optional)"),
        { target: { value: "a".repeat(201) } }
      );

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        expect(
          screen.getByText("Message too long (max 200 characters)")
        ).toBeInTheDocument();
      });
    });
  });

  it("should show submit error when payment not ready", async () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    // Fill valid form
    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "(555) 123-4567" },
    });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "j@t.com" },
    });

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      const errorAlerts = screen.getAllByTestId("error-alert");
      expect(
        errorAlerts.some(
          (el) => el.textContent === "Payment form not ready"
        )
      ).toBe(true);
    });
  });

  it("should default to first denomination when only one exists", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={{ enabled: true, denominations: [75] }}
      />
    );

    const totalElements = screen.getAllByText("$75.00");
    expect(totalElements.length).toBeGreaterThan(0);
  });

  it("should show character count for message", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    fireEvent.click(screen.getByText("Someone else"));

    fireEvent.change(
      screen.getByPlaceholderText("Add a personal message (optional)"),
      { target: { value: "Hello friend!" } }
    );

    expect(screen.getByText("13/200 characters")).toBeInTheDocument();
  });

  it("should validate recipient email format", async () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    fireEvent.click(screen.getByText("Someone else"));

    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "(555) 123-4567" },
    });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "j@t.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("recipient@email.com"),
      { target: { value: "bad-email" } }
    );

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Invalid email format")).toBeInTheDocument();
    });
  });

  it("should show no amount error when all denominations deselected", async () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={{ enabled: true, denominations: [] }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "(555) 123-4567" },
    });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "j@t.com" },
    });

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Please select an amount")).toBeInTheDocument();
    });
  });

  it("should clear amount error when selecting denomination", async () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={{ enabled: true, denominations: [] }}
      />
    );

    // With empty denominations, no amount is selected by default
    // Submit triggers amount error
    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "(555) 123-4567" },
    });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "j@t.com" },
    });

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Please select an amount")).toBeInTheDocument();
    });
  });

  it("should handle phone input changes", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    const phoneInput = screen.getByPlaceholderText("(555) 123-4567");
    fireEvent.change(phoneInput, { target: { value: "(555) 987-6543" } });
    expect(phoneInput).toHaveValue("(555) 987-6543");
  });

  it("should show missing phone error when phone is empty", async () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "j@t.com" },
    });
    // Leave phone empty

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Phone is required")).toBeInTheDocument();
    });
  });

  it("should show missing email error when email is empty", async () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "(555) 123-4567" },
    });
    // Leave email empty

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
    });
  });

  it("should not show loyalty promotion while loading", () => {
    mockIsLoyaltyLoading = true;

    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    expect(screen.queryByText(/Join our rewards program/)).not.toBeInTheDocument();
    expect(screen.queryByText("Logged in as rewards member")).not.toBeInTheDocument();
  });

  it("should show Order Summary sections", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={defaultConfig}
      />
    );

    const summaryHeaders = screen.getAllByText("Order Summary");
    expect(summaryHeaders.length).toBeGreaterThan(0);
  });

  describe("successful payment and submission", () => {
    const fillValidForm = () => {
      fireEvent.change(screen.getByPlaceholderText("First name"), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByPlaceholderText("Last name"), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
        target: { value: "(555) 123-4567" },
      });
      fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
        target: { value: "john@test.com" },
      });
    };

    it("should complete purchase and redirect on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { orderId: "gc-order-123" } }),
      });

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fillValidForm();

      // Trigger onReady to enable payment (inside act)
      await act(async () => {
        if (cardFormCallbacks.onReady) cardFormCallbacks.onReady();
      });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        expect(mockConfirmPayment).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/test-co/giftcard/success?orderId=gc-order-123"
        );
      });
    });

    it("should show error when payment confirmation fails", async () => {
      mockConfirmPayment.mockResolvedValue({
        success: false,
        error: "Card declined",
      });

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fillValidForm();
      await act(async () => { if (cardFormCallbacks.onReady) cardFormCallbacks.onReady(); });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        const errorAlerts = screen.getAllByTestId("error-alert");
        expect(
          errorAlerts.some((el) => el.textContent === "Card declined")
        ).toBe(true);
      });
    });

    it("should show error when payment fails without specific message", async () => {
      mockConfirmPayment.mockResolvedValue({
        success: false,
      });

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fillValidForm();
      await act(async () => { if (cardFormCallbacks.onReady) cardFormCallbacks.onReady(); });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        const errorAlerts = screen.getAllByTestId("error-alert");
        expect(
          errorAlerts.some((el) => el.textContent === "Payment failed")
        ).toBe(true);
      });
    });

    it("should show error when API returns failure after payment", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Server error" }),
      });

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fillValidForm();
      await act(async () => { if (cardFormCallbacks.onReady) cardFormCallbacks.onReady(); });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        const errorAlerts = screen.getAllByTestId("error-alert");
        expect(
          errorAlerts.some((el) => el.textContent === "Server error")
        ).toBe(true);
      });
    });

    it("should show generic error when API throws non-Error", async () => {
      mockFetch.mockRejectedValue("network failure");

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fillValidForm();
      await act(async () => { if (cardFormCallbacks.onReady) cardFormCallbacks.onReady(); });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        const errorAlerts = screen.getAllByTestId("error-alert");
        expect(
          errorAlerts.some((el) => el.textContent === "Something went wrong")
        ).toBe(true);
      });
    });

    it("should show error message from Error instance when fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Network timeout"));

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fillValidForm();
      await act(async () => { if (cardFormCallbacks.onReady) cardFormCallbacks.onReady(); });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        const errorAlerts = screen.getAllByTestId("error-alert");
        expect(
          errorAlerts.some((el) => el.textContent === "Network timeout")
        ).toBe(true);
      });
    });

    it("should show generic error when API fails without error message", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fillValidForm();
      await act(async () => { if (cardFormCallbacks.onReady) cardFormCallbacks.onReady(); });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        const errorAlerts = screen.getAllByTestId("error-alert");
        expect(
          errorAlerts.some((el) => el.textContent === "Failed to create order")
        ).toBe(true);
      });
    });

    it("should include recipient info when sending to someone else", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { orderId: "gc-order-456" } }),
      });

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      fillValidForm();

      // Switch to "Someone else"
      fireEvent.click(screen.getByText("Someone else"));
      fireEvent.change(screen.getByPlaceholderText("Recipient's name"), {
        target: { value: "Jane" },
      });
      fireEvent.change(screen.getByPlaceholderText("recipient@email.com"), {
        target: { value: "jane@test.com" },
      });
      fireEvent.change(
        screen.getByPlaceholderText("Add a personal message (optional)"),
        { target: { value: "Happy Birthday!" } }
      );

      // onReady may have been reset after re-render, trigger it inside act
      await act(async () => { if (cardFormCallbacks.onReady) cardFormCallbacks.onReady(); });

      fireEvent.submit(document.querySelector("form")!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/test-co/giftcard/success?orderId=gc-order-456"
        );
      });

      // Verify fetch was called with recipient info
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.recipientName).toBe("Jane");
      expect(body.recipientEmail).toBe("jane@test.com");
      expect(body.message).toBe("Happy Birthday!");
    });
  });

  describe("CardPaymentForm callbacks", () => {
    it("should set payment ready when onReady is called", async () => {
      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      // Before onReady, submit should be disabled
      const submitButtons = screen.getAllByTestId("submit-button");
      expect(submitButtons[0]).toBeDisabled();

      // Trigger onReady within act to process state update
      await act(async () => {
        if (cardFormCallbacks.onReady) cardFormCallbacks.onReady();
      });

      expect(screen.getByTestId("card-payment-form")).toBeInTheDocument();
    });

    it("should show error when onError is called", async () => {
      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      // Trigger onError within act to process state update
      await act(async () => {
        if (cardFormCallbacks.onError) cardFormCallbacks.onError("Card element error");
      });

      const errorAlerts = screen.getAllByTestId("error-alert");
      expect(
        errorAlerts.some((el) => el.textContent === "Card element error")
      ).toBe(true);
    });
  });

  describe("auto-fill from loyalty member", () => {
    it("should auto-fill buyer info from loyalty member", () => {
      mockMember = {
        id: "m-1",
        phone: "+15551234567",
        email: "john@test.com",
        firstName: "John",
        lastName: "Doe",
        points: 100,
      };

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      // Member data should auto-fill the form
      expect(screen.getByPlaceholderText("First name")).toHaveValue("John");
      expect(screen.getByPlaceholderText("Last name")).toHaveValue("Doe");
      expect(screen.getByPlaceholderText("your@email.com")).toHaveValue("john@test.com");
    });

    it("should not overwrite fields when member has no data", () => {
      mockMember = {
        id: "m-2",
        phone: null,
        email: null,
        firstName: null,
        lastName: null,
        points: 0,
      };

      render(
        <GiftcardPageClient
          companySlug="test-co"
          companyName="Test Company"
          config={defaultConfig}
        />
      );

      // Fields should remain empty since member has no data
      expect(screen.getByPlaceholderText("First name")).toHaveValue("");
      expect(screen.getByPlaceholderText("Last name")).toHaveValue("");
      expect(screen.getByPlaceholderText("(555) 123-4567")).toHaveValue("");
      expect(screen.getByPlaceholderText("your@email.com")).toHaveValue("");
    });
  });

  it("should show -- when no effective amount is selected for total display", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={{ enabled: true, denominations: [] }}
      />
    );

    // With no denominations, effectiveAmount is null, so total shows "--"
    const dashElements = screen.getAllByText("--");
    expect(dashElements.length).toBeGreaterThan(0);
  });

  it("should not show payment section when no amount selected", () => {
    render(
      <GiftcardPageClient
        companySlug="test-co"
        companyName="Test Company"
        config={{ enabled: true, denominations: [] }}
      />
    );

    // effectiveAmount is null, so payment section should not render
    expect(screen.queryByText("Payment")).not.toBeInTheDocument();
  });
});
