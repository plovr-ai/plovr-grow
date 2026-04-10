import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StripeProvider } from "../StripeProvider";
import { loadStripe } from "@stripe/stripe-js";

// Mock @stripe/stripe-js
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn().mockReturnValue(Promise.resolve({})),
}));

// Mock @stripe/react-stripe-js
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
}));

describe("StripeProvider", () => {
  const originalEnv = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    }
  });

  it("should render children inside Stripe Elements when key is configured", () => {
    render(
      <StripeProvider clientSecret="pi_test_secret">
        <div data-testid="child">Payment Form</div>
      </StripeProvider>
    );

    expect(screen.getByTestId("stripe-elements")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("should pass stripeAccountId when provided", () => {
    render(
      <StripeProvider clientSecret="pi_test_secret" stripeAccountId="acct_test123">
        <div data-testid="child">Payment Form</div>
      </StripeProvider>
    );

    expect(vi.mocked(loadStripe)).toHaveBeenCalledWith("pk_test_123", { stripeAccount: "acct_test123" });
  });

  it("should show warning when Stripe key is not configured", () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    render(
      <StripeProvider clientSecret="pi_test_secret">
        <div>Payment Form</div>
      </StripeProvider>
    );

    expect(screen.getByText("Payment Not Available")).toBeInTheDocument();
    expect(screen.getByText(/Online payment is not configured/)).toBeInTheDocument();
  });
});
