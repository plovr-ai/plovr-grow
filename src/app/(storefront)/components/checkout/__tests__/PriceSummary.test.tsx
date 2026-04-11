import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceSummary } from "../PriceSummary";
import { MerchantProvider } from "@/contexts";
import type { ReactNode } from "react";

// Mock next-intl: resolve keys against the storefront en.json message map
const priceSummaryMessages: Record<string, string> = {
  taxIncluded: "Tax (included)",
};
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    if (namespace === "priceSummary") return priceSummaryMessages[key] ?? key;
    return key;
  },
}));

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

  it("renders inclusive tax as '(included)' line and excludes from total", () => {
    // subtotal 100, inclusive 10, additive 0, total 100 (VAT item — tax inside price)
    render(
      <PriceSummary
        subtotal={100}
        taxAmount={10}
        taxAmountAdditive={0}
        taxAmountInclusive={10}
        deliveryFee={0}
        tipAmount={0}
        totalAmount={100}
      />,
      { wrapper: Wrapper }
    );
    // Inclusive row should appear
    expect(screen.getByText("Tax (included)")).toBeInTheDocument();
    // The normal "Tax" label should NOT appear (no additive tax)
    expect(screen.queryByText("Tax")).not.toBeInTheDocument();
    // Total row should show $100.00 (tax already inside price)
    const totalRow = screen.getByText("Total").closest("div");
    expect(totalRow).toHaveTextContent("$100.00");
  });

  it("renders additive tax as normal line added to total", () => {
    // subtotal 100, additive 7, inclusive 0, total 107
    render(
      <PriceSummary
        subtotal={100}
        taxAmount={7}
        taxAmountAdditive={7}
        taxAmountInclusive={0}
        deliveryFee={0}
        tipAmount={0}
        totalAmount={107}
      />,
      { wrapper: Wrapper }
    );
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.queryByText("Tax (included)")).not.toBeInTheDocument();
    expect(screen.getByText("$107.00")).toBeInTheDocument();
  });

  it("renders both additive and inclusive tax lines when both present", () => {
    // subtotal 210, additive 7, inclusive 10, total 217
    render(
      <PriceSummary
        subtotal={210}
        taxAmount={17}
        taxAmountAdditive={7}
        taxAmountInclusive={10}
        deliveryFee={0}
        tipAmount={0}
        totalAmount={217}
      />,
      { wrapper: Wrapper }
    );
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getByText("Tax (included)")).toBeInTheDocument();
    expect(screen.getByText("$217.00")).toBeInTheDocument();
  });
});
