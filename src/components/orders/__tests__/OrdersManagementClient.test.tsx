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
      orderNumber: "ORD-001",
      customerName: "John Doe",
      customerPhone: "+1234567890",
      customerEmail: "john@example.com",
      orderType: "pickup",
      status: "pending",
      items: [{ name: "Test Item", quantity: 1 }],
      subtotal: 10.0,
      taxAmount: 0.88,
      tipAmount: 0.0,
      deliveryFee: 0.0,
      discount: 0.0,
      totalAmount: 10.88,
      notes: null,
      deliveryAddress: null,
      scheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      confirmedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
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
      orderType: "all",
      dateFrom: "",
      dateTo: "",
    },
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  });

  describe("URL Parameter Mapping", () => {
    it("should map orderType to 'type' URL parameter", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const orderTypeSelect = screen.getByLabelText("Order Type");
      fireEvent.change(orderTypeSelect, { target: { value: "pickup" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("type=pickup"));
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining("orderType="));
    });

    it("should map status to 'status' URL parameter", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const statusSelect = screen.getByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "pending" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("status=pending"));
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

      // Set to pending
      fireEvent.change(statusSelect, { target: { value: "pending" } });
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("status=pending"));

      mockPush.mockClear();

      // Set back to all
      fireEvent.change(statusSelect, { target: { value: "all" } });
      const lastCall = mockPush.mock.calls[0][0];
      expect(lastCall).not.toContain("status=");
    });

    it("should reset to page 1 when filters change", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const statusSelect = screen.getByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "pending" } });

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
          orderType: "delivery",
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
      mockSearchParams.set("status", "pending");
      mockSearchParams.set("type", "delivery");

      const props = {
        ...defaultProps,
        totalPages: 5,
        currentPage: 1,
      };

      render(<OrdersManagementClient {...props} />);

      const nextButton = screen.getByText("Next");
      fireEvent.click(nextButton);

      const lastCall = mockPush.mock.calls[0][0];
      expect(lastCall).toContain("status=pending");
      expect(lastCall).toContain("type=delivery");
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
    it("should hide location filter when there is only one merchant", () => {
      const props = {
        ...defaultProps,
        merchants: [{ id: "merchant1", name: "Only Location" }],
      };

      render(<OrdersManagementClient {...props} />);

      expect(screen.queryByLabelText("Location")).not.toBeInTheDocument();
    });

    it("should show location filter when there are multiple merchants", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      expect(screen.getByLabelText("Location")).toBeInTheDocument();
    });
  });

  describe("Multiple Filter Combinations", () => {
    it("should handle multiple filters being set simultaneously", () => {
      // Set initial URL parameters
      mockSearchParams.set("status", "pending");

      render(<OrdersManagementClient {...defaultProps} />);

      const orderTypeSelect = screen.getByLabelText("Order Type");

      fireEvent.change(orderTypeSelect, { target: { value: "delivery" } });

      const lastCall = mockPush.mock.calls[0][0];
      // Should preserve existing status filter
      expect(lastCall).toContain("status=pending");
      // Should add new type filter
      expect(lastCall).toContain("type=delivery");
    });
  });

  describe("Date Filter Interactions", () => {
    it("should call showPicker when clicking on From Date input", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const dateFromInput = screen.getByLabelText("From Date");
      const showPickerMock = vi.fn();
      dateFromInput.showPicker = showPickerMock;

      fireEvent.click(dateFromInput);

      expect(showPickerMock).toHaveBeenCalled();
    });

    it("should call showPicker when clicking on To Date input", () => {
      render(<OrdersManagementClient {...defaultProps} />);

      const dateToInput = screen.getByLabelText("To Date");
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
