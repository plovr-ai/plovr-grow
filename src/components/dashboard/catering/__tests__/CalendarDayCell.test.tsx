import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarDayCell } from "../CalendarDayCell";
import type { CateringOrderData, CateringOrderInvoice } from "@/services/catering/catering-order.types";

type OrderWithMerchant = CateringOrderData & {
  merchant: { id: string; name: string; slug: string };
  invoice: CateringOrderInvoice | null;
};

const createMockOrder = (overrides: Partial<OrderWithMerchant> = {}): OrderWithMerchant => ({
  id: "order-1",
  tenantId: "tenant-1",
  merchantId: "merchant-1",
  leadId: null,
  orderNumber: "CAT-001",
  customerFirstName: "John",
  customerLastName: "Doe",
  customerPhone: "2125551234",
  customerEmail: "john@example.com",
  eventDate: new Date("2026-02-15"),
  eventTime: "12:00 PM",
  guestCount: 50,
  eventType: "Wedding",
  eventAddress: "123 Main St",
  specialRequests: null,
  items: [],
  subtotal: 500,
  taxAmount: 50,
  serviceCharge: 0,
  totalAmount: 550,
  status: "paid",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sentAt: null,
  paidAt: null,
  merchant: {
    id: "merchant-1",
    name: "Downtown Location",
    slug: "downtown",
  },
  invoice: null,
  ...overrides,
});

describe("CalendarDayCell", () => {
  const defaultProps = {
    date: new Date("2026-02-15"),
    orders: [] as OrderWithMerchant[],
    isCurrentMonth: true,
    isToday: false,
    defaultMerchantId: "merchant-1",
  };

  describe("Rendering", () => {
    it("should render the day number", () => {
      render(<CalendarDayCell {...defaultProps} />);

      expect(screen.getByText("15")).toBeInTheDocument();
    });

    it("should highlight today with blue background", () => {
      render(<CalendarDayCell {...defaultProps} isToday={true} />);

      const dayNumber = screen.getByText("15");
      expect(dayNumber).toHaveClass("bg-blue-600", "text-white");
    });

    it("should show muted text for non-current month days", () => {
      render(<CalendarDayCell {...defaultProps} isCurrentMonth={false} />);

      const dayNumber = screen.getByText("15");
      expect(dayNumber).toHaveClass("text-gray-400");
    });

    it("should show gray background for non-current month days", () => {
      render(<CalendarDayCell {...defaultProps} isCurrentMonth={false} />);

      const cell = screen.getByText("15").closest("div")?.parentElement;
      expect(cell).toHaveClass("bg-gray-50");
    });
  });

  describe("With Orders", () => {
    it("should render order time and customer name", () => {
      const orders = [createMockOrder()];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      expect(screen.getByText("12:00 PM")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should render order count badge when multiple orders", () => {
      const orders = [
        createMockOrder({ id: "order-1", eventTime: "10:00 AM" }),
        createMockOrder({ id: "order-2", eventTime: "2:00 PM", customerFirstName: "Jane" }),
      ];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("should not render count badge for single order", () => {
      const orders = [createMockOrder()];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("should render maximum 3 orders and show +N more", () => {
      const orders = [
        createMockOrder({ id: "order-1", eventTime: "9:00 AM", customerFirstName: "Alice" }),
        createMockOrder({ id: "order-2", eventTime: "11:00 AM", customerFirstName: "Bob" }),
        createMockOrder({ id: "order-3", eventTime: "1:00 PM", customerFirstName: "Charlie" }),
        createMockOrder({ id: "order-4", eventTime: "3:00 PM", customerFirstName: "Diana" }),
        createMockOrder({ id: "order-5", eventTime: "5:00 PM", customerFirstName: "Eve" }),
      ];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      expect(screen.getByText("Alice Doe")).toBeInTheDocument();
      expect(screen.getByText("Bob Doe")).toBeInTheDocument();
      expect(screen.getByText("Charlie Doe")).toBeInTheDocument();
      expect(screen.queryByText("Diana Doe")).not.toBeInTheDocument();
      expect(screen.getByText("+2 more")).toBeInTheDocument();
    });

    it("should link to order detail page", () => {
      const orders = [createMockOrder({ id: "order-123" })];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/dashboard/catering/orders/order-123");
    });

    it("should show status dot with correct color for paid status", () => {
      const orders = [createMockOrder({ status: "paid" })];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      const statusDot = document.querySelector(".bg-green-500");
      expect(statusDot).toBeInTheDocument();
    });

    it("should show status dot with correct color for draft status", () => {
      const orders = [createMockOrder({ status: "draft" })];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      const statusDot = document.querySelector(".bg-gray-400");
      expect(statusDot).toBeInTheDocument();
    });

    it("should show status dot with correct color for sent status", () => {
      const orders = [createMockOrder({ status: "sent" })];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      const statusDot = document.querySelector(".bg-blue-500");
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should show plus icon for empty current month day", () => {
      render(<CalendarDayCell {...defaultProps} orders={[]} />);

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link.querySelector("svg")).toBeInTheDocument();
    });

    it("should link to new order page with correct date", () => {
      render(<CalendarDayCell {...defaultProps} orders={[]} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        "/dashboard/catering/orders/new?merchantId=merchant-1&eventDate=2026-02-15"
      );
    });

    it("should not show plus icon for non-current month empty day", () => {
      render(<CalendarDayCell {...defaultProps} orders={[]} isCurrentMonth={false} />);

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("should not show plus icon when there are orders", () => {
      const orders = [createMockOrder()];
      render(<CalendarDayCell {...defaultProps} orders={orders} />);

      // Should have link to order, not to new order page
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", "/dashboard/catering/orders/order-1");
    });
  });
});
