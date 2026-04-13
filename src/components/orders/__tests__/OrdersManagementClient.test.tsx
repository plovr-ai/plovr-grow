import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrdersManagementClient, type SerializedOrder } from "../OrdersManagementClient";

// Mock Next.js navigation hooks
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe("OrdersManagementClient", () => {
  const mockMerchants = [
    { id: "merchant1", name: "Downtown Location" },
    { id: "merchant2", name: "Westside Location" },
  ];

  const mockOrders: SerializedOrder[] = [
    {
      id: "order1",
      tenantId: "tenant1",
      merchantId: "merchant1",
      loyaltyMemberId: null,
      orderNumber: "ORD-001",
      customerFirstName: "John",
      customerLastName: "Doe",
      customerPhone: "+1234567890",
      customerEmail: "john@example.com",
      orderMode: "pickup",
      salesChannel: "online_order",
      paymentType: "online",
      status: "created",
      fulfillmentStatus: "pending",
      items: [{ name: "Test Item", quantity: 1 }],
      subtotal: 10.0,
      taxAmount: 0.88,
      tipAmount: 0.0,
      deliveryFee: 0.0,
      feesAmount: 0.0,
      feesBreakdown: null,
      discount: 0.0,
      giftCardPayment: 0.0,
      balanceDue: 10.88,
      totalAmount: 10.88,
      notes: null,
      deliveryAddress: null,
      scheduledAt: null,
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      cancelledAt: null,
      cancelReason: null,
      paymentFailedAt: null,
      deleted: false,
      merchant: {
        id: "merchant1",
        name: "Downtown Location",
        slug: "downtown",
        timezone: "America/New_York",
      },
    },
  ];

  const defaultProps = {
    merchants: mockMerchants,
    initialOrders: mockOrders,
    totalPages: 1,
    currentPage: 1,
    initialFilters: {
      merchantId: "all",
      status: "all",
      orderMode: "all",
      salesChannel: "all",
      dateFrom: "",
      dateTo: "",
    },
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  });

  describe("URL Parameter Mapping", () => {
    it("should map orderMode to 'mode' URL parameter", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const orderModeSelect = screen.getByLabelText("Order Type");
      fireEvent.change(orderModeSelect, { target: { value: "pickup" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("mode=pickup"));
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining("orderMode="));
    });

    it("should map status to 'status' URL parameter", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const statusSelect = screen.getByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "created" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("status=created"));
    });

    it("should map merchantId to 'merchantId' URL parameter", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const locationSelect = screen.getByLabelText("Location");
      fireEvent.change(locationSelect, { target: { value: "merchant1" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("merchantId=merchant1"));
    });

    it("should map dateFrom to 'dateFrom' URL parameter", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const dateFromInput = screen.getByLabelText("From Date");
      fireEvent.change(dateFromInput, { target: { value: "2024-01-01" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateFrom=2024-01-01"));
    });

    it("should map dateTo to 'dateTo' URL parameter", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const dateToInput = screen.getByLabelText("To Date");
      fireEvent.change(dateToInput, { target: { value: "2024-01-31" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateTo=2024-01-31"));
    });
  });

  describe("Filter State Management", () => {
    it("should remove URL parameter when filter is set to 'all'", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const statusSelect = screen.getByLabelText("Status");

      // Set to created
      fireEvent.change(statusSelect, { target: { value: "created" } });
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("status=created"));

      mockPush.mockClear();

      // Set back to all
      fireEvent.change(statusSelect, { target: { value: "all" } });
      const lastCall = mockPush.mock.calls[0][0];
      expect(lastCall).not.toContain("status=");
    });

    it("should reset to page 1 when filters change", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const statusSelect = screen.getByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "created" } });

      const lastCall = mockPush.mock.calls[0][0];
      expect(lastCall).not.toContain("page=");
    });
  });

  describe("Initial Filter State", () => {
    it("should display selected orderType from initialFilters", () => {
      const props = {
        ...defaultProps,
        initialFilters: {
          ...defaultProps.initialFilters,
          orderMode: "delivery",
        },
      };

      render(<OrdersManagementClient {...props} />);

      const orderTypeSelect = screen.getByLabelText("Order Type") as HTMLSelectElement;
      expect(orderTypeSelect.value).toBe("delivery");
    });

    it("should display selected status from initialFilters", () => {
      const props = {
        ...defaultProps,
        initialFilters: {
          ...defaultProps.initialFilters,
          status: "completed",
        },
      };

      render(<OrdersManagementClient {...props} />);

      const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
      expect(statusSelect.value).toBe("completed");
    });

    it("should display selected merchantId from initialFilters", () => {
      const props = {
        ...defaultProps,
        initialFilters: {
          ...defaultProps.initialFilters,
          merchantId: "merchant1",
        },
      };

      render(<OrdersManagementClient {...props} />);

      const locationSelect = screen.getByLabelText("Location") as HTMLSelectElement;
      expect(locationSelect.value).toBe("merchant1");
    });

    it("should display date range from initialFilters", () => {
      const props = {
        ...defaultProps,
        initialFilters: {
          ...defaultProps.initialFilters,
          dateFrom: "2024-01-01",
          dateTo: "2024-01-31",
        },
      };

      render(<OrdersManagementClient {...props} />);

      const dateFromInput = screen.getByLabelText("From Date") as HTMLInputElement;
      const dateToInput = screen.getByLabelText("To Date") as HTMLInputElement;

      expect(dateFromInput.value).toBe("2024-01-01");
      expect(dateToInput.value).toBe("2024-01-31");
    });
  });

  describe("Pagination", () => {
    it("should update page URL parameter when pagination changes", () => {
      const props = {
        ...defaultProps,
        totalPages: 5,
        currentPage: 1,
      };

      render(<OrdersManagementClient {...props} />);

      const nextButton = screen.getByText("Next");
      fireEvent.click(nextButton);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });

    it("should preserve existing filters when changing page", () => {
      mockSearchParams.set("status", "created");
      mockSearchParams.set("mode", "delivery");

      const props = {
        ...defaultProps,
        totalPages: 5,
        currentPage: 1,
      };

      render(<OrdersManagementClient {...props} />);

      const nextButton = screen.getByText("Next");
      fireEvent.click(nextButton);

      const lastCall = mockPush.mock.calls[0][0];
      expect(lastCall).toContain("status=created");
      expect(lastCall).toContain("mode=delivery");
      expect(lastCall).toContain("page=2");
    });
  });

  describe("Empty State", () => {
    it("should display 'No orders found' when there are no orders", () => {
      const props = {
        ...defaultProps,
        initialOrders: [],
      };

      render(<OrdersManagementClient {...props} />);

      expect(screen.getByText("No orders found")).toBeInTheDocument();
    });
  });

  describe("Location Filter Visibility", () => {
    it("should show location filter even with only one merchant", () => {
      const props = {
        ...defaultProps,
        merchants: [{ id: "merchant1", name: "Only Location" }],
      };

      render(<OrdersManagementClient {...props} />);

      expect(screen.getByLabelText("Location")).toBeInTheDocument();
    });

    it("should show location filter when there are multiple merchants", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      expect(screen.getByLabelText("Location")).toBeInTheDocument();
    });
  });

  describe("Multiple Filter Combinations", () => {
    it("should handle multiple filters being set simultaneously", () => {
      // Set initial URL parameters
      mockSearchParams.set("status", "created");

      render(<OrdersManagementClient {...defaultProps} />);

      const orderTypeSelect = screen.getByLabelText("Order Type");

      fireEvent.change(orderTypeSelect, { target: { value: "delivery" } });

      const lastCall = mockPush.mock.calls[0][0];
      // Should preserve existing status filter
      expect(lastCall).toContain("status=created");
      // Should add new mode filter
      expect(lastCall).toContain("mode=delivery");
    });
  });

  describe("SerializedOrder Type", () => {
    it("should have all Decimal fields as number type", () => {
      const order: SerializedOrder = mockOrders[0];

      // All Decimal fields should be serialized as numbers
      expect(typeof order.subtotal).toBe("number");
      expect(typeof order.taxAmount).toBe("number");
      expect(typeof order.tipAmount).toBe("number");
      expect(typeof order.deliveryFee).toBe("number");
      expect(typeof order.discount).toBe("number");
      expect(typeof order.giftCardPayment).toBe("number");
      expect(typeof order.balanceDue).toBe("number");
      expect(typeof order.totalAmount).toBe("number");
    });

    it("should correctly handle orders with gift card payments", () => {
      const orderWithGiftCard: SerializedOrder = {
        ...mockOrders[0],
        giftCardPayment: 5.0,
        balanceDue: 5.88,
        totalAmount: 10.88,
      };

      expect(orderWithGiftCard.giftCardPayment).toBe(5.0);
      expect(orderWithGiftCard.balanceDue).toBe(5.88);
      expect(orderWithGiftCard.giftCardPayment + orderWithGiftCard.balanceDue).toBeCloseTo(10.88);
    });
  });

  describe("Date Filter Interactions", () => {
    it("should call showPicker when clicking on From Date input", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const dateFromInput = screen.getByLabelText("From Date") as HTMLInputElement;
      const showPickerMock = vi.fn();
      dateFromInput.showPicker = showPickerMock;

      fireEvent.click(dateFromInput);

      expect(showPickerMock).toHaveBeenCalled();
    });

    it("should call showPicker when clicking on To Date input", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const dateToInput = screen.getByLabelText("To Date") as HTMLInputElement;
      const showPickerMock = vi.fn();
      dateToInput.showPicker = showPickerMock;

      fireEvent.click(dateToInput);

      expect(showPickerMock).toHaveBeenCalled();
    });

    it("should have cursor-pointer class on date inputs", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const dateFromInput = screen.getByLabelText("From Date");
      const dateToInput = screen.getByLabelText("To Date");

      expect(dateFromInput).toHaveClass("cursor-pointer");
      expect(dateToInput).toHaveClass("cursor-pointer");
    });
  });
});
