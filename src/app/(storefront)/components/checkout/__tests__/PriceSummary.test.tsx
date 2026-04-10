import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceSummary } from "../PriceSummary";
import { MerchantProvider } from "@/contexts";
import type { ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MerchantProvider
      config={{
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companySlug: "test",
      }}
    >
      {children}
    </MerchantProvider>
  );
}

describe("PriceSummary", () => {
  const defaultProps = {
    subtotal: 50,
    taxAmount: 4.13,
    deliveryFee: 0,
    tipAmount: 0,
    totalAmount: 54.13,
  };

  it("should display subtotal, tax, and total", () => {
    render(<PriceSummary {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("should show delivery fee when > 0", () => {
    render(<PriceSummary {...defaultProps} deliveryFee={3.99} />, { wrapper: Wrapper });
    expect(screen.getByText("Delivery Fee")).toBeInTheDocument();
  });

  it("should hide delivery fee when 0", () => {
    render(<PriceSummary {...defaultProps} deliveryFee={0} />, { wrapper: Wrapper });
    expect(screen.queryByText("Delivery Fee")).not.toBeInTheDocument();
  });

  it("should show tip when > 0", () => {
    render(<PriceSummary {...defaultProps} tipAmount={5} />, { wrapper: Wrapper });
    expect(screen.getByText("Tip")).toBeInTheDocument();
  });

  it("should hide tip when 0", () => {
    render(<PriceSummary {...defaultProps} tipAmount={0} />, { wrapper: Wrapper });
    expect(screen.queryByText("Tip")).not.toBeInTheDocument();
  });

  it("should show gift card payment section when giftCardPayment > 0", () => {
    render(
      <PriceSummary {...defaultProps} giftCardPayment={20} orderMode="pickup" />,
      { wrapper: Wrapper }
    );
    expect(screen.getByText("Gift Card")).toBeInTheDocument();
    expect(screen.getByText("Due at Pickup")).toBeInTheDocument();
  });

  it("should show Due at Delivery for delivery orders with gift card", () => {
    render(
      <PriceSummary {...defaultProps} giftCardPayment={20} orderMode="delivery" />,
      { wrapper: Wrapper }
    );
    expect(screen.getByText("Due at Delivery")).toBeInTheDocument();
  });

  it("should not show gift card section when giftCardPayment is 0", () => {
    render(<PriceSummary {...defaultProps} giftCardPayment={0} />, { wrapper: Wrapper });
    expect(screen.queryByText("Gift Card")).not.toBeInTheDocument();
  });

  it("should display fees when provided", () => {
    const fees = [
      { id: "f1", displayName: "Service Fee", amount: 2.5 },
    ];
    render(<PriceSummary {...defaultProps} fees={fees} />, { wrapper: Wrapper });
    expect(screen.getByText("Service Fee")).toBeInTheDocument();
  });
});
