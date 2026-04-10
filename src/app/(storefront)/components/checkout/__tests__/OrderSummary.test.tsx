import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderSummary } from "../OrderSummary";
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

const mockItems = [
  {
    id: "1",
    menuItemId: "item-1",
    name: "Pizza",
    price: 18.99,
    quantity: 2,
    selectedModifiers: [
      { groupId: "g1", groupName: "Size", modifierId: "m1", modifierName: "Large", price: 3, quantity: 1 },
    ],
    totalPrice: 43.98,
    imageUrl: null,
  },
  {
    id: "2",
    menuItemId: "item-2",
    name: "Pasta",
    price: 15.99,
    quantity: 1,
    selectedModifiers: [],
    totalPrice: 15.99,
    specialInstructions: "Extra sauce",
    imageUrl: null,
  },
];

describe("OrderSummary", () => {
  it("should display item count", () => {
    render(<OrderSummary items={mockItems} merchantSlug="test" />, { wrapper: Wrapper });
    expect(screen.getByText(/Your Order \(3 items\)/)).toBeInTheDocument();
  });

  it("should display singular item when count is 1", () => {
    render(<OrderSummary items={[mockItems[1]]} merchantSlug="test" />, { wrapper: Wrapper });
    expect(screen.getByText(/Your Order \(1 item\)/)).toBeInTheDocument();
  });

  it("should display item names and prices", () => {
    render(<OrderSummary items={mockItems} merchantSlug="test" />, { wrapper: Wrapper });
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
  });

  it("should display modifier names", () => {
    render(<OrderSummary items={mockItems} merchantSlug="test" />, { wrapper: Wrapper });
    expect(screen.getByText("Large")).toBeInTheDocument();
  });

  it("should display special instructions", () => {
    render(<OrderSummary items={mockItems} merchantSlug="test" />, { wrapper: Wrapper });
    expect(screen.getByText("Extra sauce")).toBeInTheDocument();
  });

  it("should render Edit Cart link with merchantSlug", () => {
    render(<OrderSummary items={mockItems} merchantSlug="test-rest" />, { wrapper: Wrapper });
    const editLink = screen.getByText("Edit Cart");
    expect(editLink).toHaveAttribute("href", "/r/test-rest/cart");
  });

  it("should support deprecated tenantSlug", () => {
    render(<OrderSummary items={mockItems} tenantSlug="legacy" />, { wrapper: Wrapper });
    const editLink = screen.getByText("Edit Cart");
    expect(editLink).toHaveAttribute("href", "/r/legacy/cart");
  });

  it("should use empty slug when neither merchantSlug nor tenantSlug provided", () => {
    render(<OrderSummary items={mockItems} />, { wrapper: Wrapper });
    const editLink = screen.getByText("Edit Cart");
    expect(editLink).toHaveAttribute("href", "/r//cart");
  });
});
