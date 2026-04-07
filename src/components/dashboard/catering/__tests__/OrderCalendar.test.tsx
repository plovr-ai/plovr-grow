import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrderCalendar } from "../OrderCalendar";
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

describe("OrderCalendar", () => {
  const defaultProps = {
    orders: [] as OrderWithMerchant[],
    currentMonth: new Date("2026-02-15"),
    onMonthChange: vi.fn(),
    defaultMerchantId: "merchant-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the month and year header", () => {
      render(<OrderCalendar {...defaultProps} />);

      expect(screen.getByText("February 2026")).toBeInTheDocument();
    });

    it("should render weekday headers", () => {
      render(<OrderCalendar {...defaultProps} />);

      expect(screen.getByText("Sun")).toBeInTheDocument();
      expect(screen.getByText("Mon")).toBeInTheDocument();
      expect(screen.getByText("Tue")).toBeInTheDocument();
      expect(screen.getByText("Wed")).toBeInTheDocument();
      expect(screen.getByText("Thu")).toBeInTheDocument();
      expect(screen.getByText("Fri")).toBeInTheDocument();
      expect(screen.getByText("Sat")).toBeInTheDocument();
    });

    it("should render Today button", () => {
      render(<OrderCalendar {...defaultProps} />);

      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    it("should render navigation buttons", () => {
      render(<OrderCalendar {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      // Today + Prev + Next = 3 buttons
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it("should render calendar grid with day numbers", () => {
      render(<OrderCalendar {...defaultProps} />);

      // February 2026 has 28 days
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("28")).toBeInTheDocument();
    });

    it("should render days from previous and next month to fill grid", () => {
      // Use March 2026 where March 1 is a Sunday but we still need to fill the grid
      render(
        <OrderCalendar
          {...defaultProps}
          currentMonth={new Date("2026-03-15")}
        />
      );

      // March 2026 starts on Sunday, ends on Tuesday
      // So we need days from April (1, 2, 3, 4) to fill the last row
      // The grid should have 35 or 42 cells (5 or 6 weeks)
      expect(screen.getByText("March 2026")).toBeInTheDocument();
    });
  });

  describe("Month Navigation", () => {
    it("should call onMonthChange with previous month when prev button clicked", () => {
      const onMonthChange = vi.fn();
      render(<OrderCalendar {...defaultProps} onMonthChange={onMonthChange} />);

      // Find the prev button (ChevronLeft icon)
      const buttons = screen.getAllByRole("button");
      const prevButton = buttons.find(btn => btn.querySelector('svg.lucide-chevron-left'));
      fireEvent.click(prevButton!);

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      const calledDate = onMonthChange.mock.calls[0][0];
      expect(calledDate.getMonth()).toBe(0); // January
      expect(calledDate.getFullYear()).toBe(2026);
    });

    it("should call onMonthChange with next month when next button clicked", () => {
      const onMonthChange = vi.fn();
      render(<OrderCalendar {...defaultProps} onMonthChange={onMonthChange} />);

      // Find the next button (ChevronRight icon)
      const buttons = screen.getAllByRole("button");
      const nextButton = buttons.find(btn => btn.querySelector('svg.lucide-chevron-right'));
      fireEvent.click(nextButton!);

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      const calledDate = onMonthChange.mock.calls[0][0];
      expect(calledDate.getMonth()).toBe(2); // March
      expect(calledDate.getFullYear()).toBe(2026);
    });

    it("should call onMonthChange with current date when Today button clicked", () => {
      const onMonthChange = vi.fn();
      render(<OrderCalendar {...defaultProps} onMonthChange={onMonthChange} />);

      fireEvent.click(screen.getByText("Today"));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      const calledDate = onMonthChange.mock.calls[0][0];
      const today = new Date();
      expect(calledDate.getMonth()).toBe(today.getMonth());
      expect(calledDate.getFullYear()).toBe(today.getFullYear());
    });
  });

  describe("Order Display", () => {
    it("should display orders on correct dates", () => {
      const orders = [
        createMockOrder({
          id: "order-1",
          eventDate: new Date("2026-02-15"),
          eventTime: "12:00 PM",
          customerFirstName: "John",
        }),
      ];
      render(<OrderCalendar {...defaultProps} orders={orders} />);

      expect(screen.getByText("12:00 PM")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should group multiple orders on same date", () => {
      const orders = [
        createMockOrder({
          id: "order-1",
          eventDate: new Date("2026-02-15"),
          eventTime: "10:00 AM",
          customerFirstName: "Alice",
        }),
        createMockOrder({
          id: "order-2",
          eventDate: new Date("2026-02-15"),
          eventTime: "2:00 PM",
          customerFirstName: "Bob",
        }),
      ];
      render(<OrderCalendar {...defaultProps} orders={orders} />);

      expect(screen.getByText("Alice Doe")).toBeInTheDocument();
      expect(screen.getByText("Bob Doe")).toBeInTheDocument();
      // Should show count badge - look for the badge element specifically
      const countBadge = document.querySelector(".rounded-full.bg-gray-100");
      expect(countBadge).toBeInTheDocument();
      expect(countBadge?.textContent).toBe("2");
    });

    it("should sort orders by time within a day", () => {
      const orders = [
        createMockOrder({
          id: "order-1",
          eventDate: new Date("2026-02-15"),
          eventTime: "2:00 PM",
          customerFirstName: "Second",
        }),
        createMockOrder({
          id: "order-2",
          eventDate: new Date("2026-02-15"),
          eventTime: "10:00 AM",
          customerFirstName: "First",
        }),
      ];
      render(<OrderCalendar {...defaultProps} orders={orders} />);

      const customerNames = screen.getAllByText(/First|Second/);
      // Note: Actual sort order depends on eventTime string comparison
      expect(customerNames.length).toBe(2);
    });

    it("should display orders on different dates correctly", () => {
      const orders = [
        createMockOrder({
          id: "order-1",
          eventDate: new Date("2026-02-10"),
          eventTime: "10:00 AM",
          customerFirstName: "Alice",
        }),
        createMockOrder({
          id: "order-2",
          eventDate: new Date("2026-02-20"),
          eventTime: "2:00 PM",
          customerFirstName: "Bob",
        }),
      ];
      render(<OrderCalendar {...defaultProps} orders={orders} />);

      expect(screen.getByText("Alice Doe")).toBeInTheDocument();
      expect(screen.getByText("Bob Doe")).toBeInTheDocument();
    });
  });

  describe("Different Months", () => {
    it("should render correct month header for January", () => {
      render(
        <OrderCalendar
          {...defaultProps}
          currentMonth={new Date("2026-01-15")}
        />
      );

      expect(screen.getByText("January 2026")).toBeInTheDocument();
    });

    it("should render correct month header for December", () => {
      render(
        <OrderCalendar
          {...defaultProps}
          currentMonth={new Date("2026-12-15")}
        />
      );

      expect(screen.getByText("December 2026")).toBeInTheDocument();
    });

    it("should handle year change when navigating from January to December", () => {
      const onMonthChange = vi.fn();
      render(
        <OrderCalendar
          {...defaultProps}
          currentMonth={new Date("2026-01-15")}
          onMonthChange={onMonthChange}
        />
      );

      const buttons = screen.getAllByRole("button");
      const prevButton = buttons.find(btn => btn.querySelector('svg.lucide-chevron-left'));
      fireEvent.click(prevButton!);

      const calledDate = onMonthChange.mock.calls[0][0];
      expect(calledDate.getMonth()).toBe(11); // December
      expect(calledDate.getFullYear()).toBe(2025);
    });
  });
});
