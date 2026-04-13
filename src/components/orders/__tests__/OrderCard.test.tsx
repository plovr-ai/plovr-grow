import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderCard } from "../OrderCard";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock dependencies
vi.mock("@/lib/utils", () => ({
  formatPrice: (amount: number) => `$${amount.toFixed(2)}`,
  cn: (...args: string[]) => args.join(" "),
}));

vi.mock("@/lib/datetime", () => ({
  formatDate: () => "Apr 10, 2026",
  formatTime: () => "3:30 PM",
  getTimezoneAbbr: () => "EST",
}));

vi.mock("@/lib/names", () => ({
  formatCustomerName: (first: string, last: string) => `${first} ${last}`,
}));

const baseOrder = {
  id: "order-1",
  tenantId: "tenant-1",
  merchantId: "merchant-1",
  orderNumber: "001",
  status: "completed",
  fulfillmentStatus: "fulfilled",
  customerFirstName: "John",
  customerLastName: "Doe",
  customerPhone: "555-1234",
  customerEmail: "john@test.com",
  orderMode: "pickup",
  salesChannel: "online_order",
  paymentType: "online",
  items: null,
  orderItems: [
    { name: "Burger", quantity: 2 },
    { name: "Fries", quantity: 1 },
  ],
  subtotal: 20,
  taxAmount: 1.5,
  tipAmount: 3,
  deliveryFee: 0,
  feesAmount: 0,
  feesBreakdown: null,
  discount: 0,
  giftCardPayment: 0,
  balanceDue: 24.5,
  totalAmount: 24.5,
  notes: null,
  loyaltyMemberId: null,
  cancelReason: null,
  paymentFailedAt: null,
  cancelledAt: null,
  paidAt: null,
  deleted: false,
  deliveryAddress: null,
  scheduledAt: null,
  createdAt: new Date("2026-04-10T20:30:00Z"),
  updatedAt: new Date("2026-04-10T20:30:00Z"),
  merchant: {
    id: "merchant-1",
    name: "Test Merchant",
    slug: "test-merchant",
    timezone: "America/New_York",
  },
};

describe("OrderCard", () => {
  it("should render order details", () => {
    render(<OrderCard order={baseOrder} />);

    expect(screen.getByText("#001")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("555-1234")).toBeInTheDocument();
    expect(screen.getByText("$24.50")).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("should use default timezone when merchant is null", () => {
    const orderNoMerchant = { ...baseOrder, merchant: null };
    render(<OrderCard order={orderNoMerchant} />);

    expect(screen.getByText("#001")).toBeInTheDocument();
  });

  it("should fallback to salesChannel string when not in labels map", () => {
    const orderCustomChannel = {
      ...baseOrder,
      salesChannel: "custom_channel",
    };
    render(<OrderCard order={orderCustomChannel} />);

    expect(screen.getByText("custom_channel")).toBeInTheDocument();
  });

  it("should show singular 'item' when count is 1", () => {
    const orderSingleItem = {
      ...baseOrder,
      orderItems: [{ name: "Burger", quantity: 1 }],
    };
    render(<OrderCard order={orderSingleItem} />);

    expect(screen.getByText("1 item")).toBeInTheDocument();
  });
});
