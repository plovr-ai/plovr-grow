import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CateringLeadsClient } from "../CateringLeadsClient";
import type { CateringLeadWithMerchant } from "@/services/catering/catering.types";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe("CateringLeadsClient", () => {
  const mockMerchants = [
    { id: "merchant-1", name: "Downtown Location" },
    { id: "merchant-2", name: "Westside Location" },
  ];

  const mockLeads: CateringLeadWithMerchant[] = [
    {
      id: "lead-1",
      tenantId: "tenant-1",
      merchantId: "merchant-1",
      name: "John Doe",
      phone: "2125551234",
      email: "john@example.com",
      notes: "Birthday party for 20 people",
      status: "pending",
      createdAt: new Date("2024-01-15T10:30:00"),
      updatedAt: new Date("2024-01-15T10:30:00"),
      merchant: {
        id: "merchant-1",
        name: "Downtown Location",
        slug: "downtown",
        companyId: "company-1",
      },
    },
    {
      id: "lead-2",
      tenantId: "tenant-1",
      merchantId: "merchant-2",
      name: "Jane Smith",
      phone: "3105559876",
      email: "jane@example.com",
      notes: null,
      status: "contacted",
      createdAt: new Date("2024-01-20T14:15:00"),
      updatedAt: new Date("2024-01-20T14:15:00"),
      merchant: {
        id: "merchant-2",
        name: "Westside Location",
        slug: "westside",
        companyId: "company-1",
      },
    },
    {
      id: "lead-3",
      tenantId: "tenant-1",
      merchantId: "merchant-1",
      name: "Bob Wilson",
      phone: "4155554567",
      email: "bob@example.com",
      notes: "Corporate event",
      status: "completed",
      createdAt: new Date("2024-01-25T09:00:00"),
      updatedAt: new Date("2024-01-25T09:00:00"),
      merchant: {
        id: "merchant-1",
        name: "Downtown Location",
        slug: "downtown",
        companyId: "company-1",
      },
    },
  ];

  const defaultProps = {
    leads: mockLeads,
    totalPages: 3,
    currentPage: 1,
    total: 50,
    merchants: mockMerchants,
    initialFilters: {
      search: "",
      status: "all",
      merchantId: "all",
    },
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  });

  describe("Rendering", () => {
    it("should render the page title and total count", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      expect(screen.getByText("Catering Leads")).toBeInTheDocument();
      expect(
        screen.getByText(/View and manage catering inquiries/)
      ).toBeInTheDocument();
      expect(screen.getByText(/50 total/)).toBeInTheDocument();
    });

    it("should render search input", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      expect(
        screen.getByPlaceholderText("Search by name, phone, or email...")
      ).toBeInTheDocument();
    });

    it("should render location filter when multiple merchants", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const locationSelect = screen.getByDisplayValue("All Locations");
      expect(locationSelect).toBeInTheDocument();
    });

    it("should not render location filter when single merchant", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          merchants={[mockMerchants[0]]}
        />
      );

      expect(screen.queryByDisplayValue("All Locations")).not.toBeInTheDocument();
    });

    it("should render status filter", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const statusSelect = screen.getByDisplayValue("All Statuses");
      expect(statusSelect).toBeInTheDocument();
    });

    it("should render table headers", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Phone")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Notes")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Submitted")).toBeInTheDocument();
    });

    it("should render location column when multiple merchants", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      expect(screen.getByText("Location")).toBeInTheDocument();
    });

    it("should not render location column when single merchant", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          merchants={[mockMerchants[0]]}
        />
      );

      expect(screen.queryByText("Location")).not.toBeInTheDocument();
    });

    it("should render lead data in table rows", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      // First lead
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("(212) 555-1234")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("Birthday party for 20 people")).toBeInTheDocument();

      // Second lead (no notes)
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("(310) 555-9876")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();

      // Third lead
      expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      expect(screen.getByText("(415) 555-4567")).toBeInTheDocument();
    });

    it("should format phone numbers correctly", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      // All phone numbers should be formatted as (XXX) XXX-XXXX
      expect(screen.getByText("(212) 555-1234")).toBeInTheDocument();
      expect(screen.getByText("(310) 555-9876")).toBeInTheDocument();
      expect(screen.getByText("(415) 555-4567")).toBeInTheDocument();
    });

    it("should show dash for null notes", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const dashes = screen.getAllByText("-");
      expect(dashes.length).toBeGreaterThan(0);
    });

    it("should render status badges with correct styling", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      expect(screen.getByText("pending")).toBeInTheDocument();
      expect(screen.getByText("contacted")).toBeInTheDocument();
      expect(screen.getByText("completed")).toBeInTheDocument();
    });

    it("should format dates correctly", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      // Check that dates are formatted (month/day/year with time)
      expect(screen.getByText("Jan 15, 2024, 10:30 AM")).toBeInTheDocument();
      expect(screen.getByText("Jan 20, 2024, 02:15 PM")).toBeInTheDocument();
      expect(screen.getByText("Jan 25, 2024, 09:00 AM")).toBeInTheDocument();
    });

    it("should display merchant names when multiple locations", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      expect(screen.getAllByText("Downtown Location").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Westside Location").length).toBeGreaterThan(0);
    });
  });

  describe("Empty State", () => {
    it("should show empty message when no leads", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          leads={[]}
          total={0}
          totalPages={0}
        />
      );

      expect(screen.getByText("No catering leads found")).toBeInTheDocument();
    });

    it("should not render table when no leads", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          leads={[]}
          total={0}
          totalPages={0}
        />
      );

      expect(screen.queryByText("Name")).not.toBeInTheDocument();
      expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("should update search input value", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name, phone, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "john" } });

      expect(searchInput).toHaveValue("john");
    });

    it("should update URL with search param on form submit", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name, phone, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "john" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("search=john"));
    });

    it("should remove page param when searching", () => {
      mockSearchParams.set("page", "3");
      render(<CateringLeadsClient {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name, phone, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "test" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("page=")
      );
    });

    it("should clear search param when search is empty", () => {
      mockSearchParams.set("search", "test");
      render(
        <CateringLeadsClient
          {...defaultProps}
          initialFilters={{ ...defaultProps.initialFilters, search: "test" }}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        "Search by name, phone, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("search=")
      );
    });

    it("should show search value from initialFilters", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          initialFilters={{ ...defaultProps.initialFilters, search: "test query" }}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        "Search by name, phone, or email..."
      );
      expect(searchInput).toHaveValue("test query");
    });
  });

  describe("Status Filter", () => {
    it("should update URL with status param when status changes", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const statusSelect = screen.getByDisplayValue("All Statuses");
      fireEvent.change(statusSelect, { target: { value: "pending" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("status=pending"));
    });

    it("should remove status param when set to 'all'", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          initialFilters={{ ...defaultProps.initialFilters, status: "pending" }}
        />
      );

      const statusSelect = screen.getByDisplayValue("Pending");
      fireEvent.change(statusSelect, { target: { value: "all" } });

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("status=")
      );
    });

    it("should reset to page 1 when status changes", () => {
      mockSearchParams.set("page", "3");
      render(<CateringLeadsClient {...defaultProps} />);

      const statusSelect = screen.getByDisplayValue("All Statuses");
      fireEvent.change(statusSelect, { target: { value: "pending" } });

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("page=")
      );
    });

    it("should display selected status from initialFilters", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          initialFilters={{ ...defaultProps.initialFilters, status: "contacted" }}
        />
      );

      const statusSelect = screen.getByDisplayValue("Contacted") as HTMLSelectElement;
      expect(statusSelect.value).toBe("contacted");
    });

    it("should render all status options", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const statusSelect = screen.getByDisplayValue("All Statuses");
      const options = Array.from(statusSelect.querySelectorAll("option"));
      const optionValues = options.map((opt) => (opt as HTMLOptionElement).value);

      expect(optionValues).toContain("all");
      expect(optionValues).toContain("pending");
      expect(optionValues).toContain("contacted");
      expect(optionValues).toContain("completed");
      expect(optionValues).toContain("cancelled");
    });
  });

  describe("Location Filter", () => {
    it("should update URL with merchantId param when location changes", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const locationSelect = screen.getByDisplayValue("All Locations");
      fireEvent.change(locationSelect, { target: { value: "merchant-1" } });

      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("merchantId=merchant-1")
      );
    });

    it("should remove merchantId param when set to 'all'", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          initialFilters={{ ...defaultProps.initialFilters, merchantId: "merchant-1" }}
        />
      );

      const locationSelect = screen.getByDisplayValue("Downtown Location");
      fireEvent.change(locationSelect, { target: { value: "all" } });

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("merchantId=")
      );
    });

    it("should reset to page 1 when location changes", () => {
      mockSearchParams.set("page", "3");
      render(<CateringLeadsClient {...defaultProps} />);

      const locationSelect = screen.getByDisplayValue("All Locations");
      fireEvent.change(locationSelect, { target: { value: "merchant-1" } });

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("page=")
      );
    });

    it("should display selected merchant from initialFilters", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          initialFilters={{ ...defaultProps.initialFilters, merchantId: "merchant-2" }}
        />
      );

      const locationSelect = screen.getByDisplayValue("Westside Location") as HTMLSelectElement;
      expect(locationSelect.value).toBe("merchant-2");
    });

    it("should render all merchant options", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const locationSelect = screen.getByDisplayValue("All Locations");
      const options = Array.from(locationSelect.querySelectorAll("option"));
      const optionValues = options.map((opt) => (opt as HTMLOptionElement).value);

      expect(optionValues).toContain("all");
      expect(optionValues).toContain("merchant-1");
      expect(optionValues).toContain("merchant-2");
    });
  });

  describe("Pagination", () => {
    it("should render pagination when multiple pages", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
    });

    it("should disable previous button on first page", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const prevButton = screen.getByRole("button", { name: /Previous/i });
      expect(prevButton).toBeDisabled();
    });

    it("should disable next button on last page", () => {
      render(
        <CateringLeadsClient {...defaultProps} currentPage={3} />
      );

      const nextButton = screen.getByRole("button", { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it("should update URL with page param on next click", () => {
      render(<CateringLeadsClient {...defaultProps} />);

      const nextButton = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextButton);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });

    it("should update URL with page param on previous click", () => {
      render(
        <CateringLeadsClient {...defaultProps} currentPage={2} />
      );

      const prevButton = screen.getByRole("button", { name: /Previous/i });
      fireEvent.click(prevButton);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("page=1"));
    });

    it("should not render pagination when single page", () => {
      render(
        <CateringLeadsClient {...defaultProps} totalPages={1} />
      );

      expect(screen.queryByText("Page 1 of 1")).not.toBeInTheDocument();
    });

    it("should not render pagination when no pages", () => {
      render(
        <CateringLeadsClient
          {...defaultProps}
          leads={[]}
          totalPages={0}
          total={0}
        />
      );

      expect(screen.queryByRole("button", { name: /Previous/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Next/i })).not.toBeInTheDocument();
    });
  });

  describe("Combined Filters", () => {
    it("should preserve other filters when changing status", () => {
      mockSearchParams.set("search", "test");
      mockSearchParams.set("merchantId", "merchant-1");
      render(
        <CateringLeadsClient
          {...defaultProps}
          initialFilters={{
            search: "test",
            status: "all",
            merchantId: "merchant-1",
          }}
        />
      );

      const statusSelect = screen.getByDisplayValue("All Statuses");
      fireEvent.change(statusSelect, { target: { value: "pending" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("search=test"));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("merchantId=merchant-1"));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("status=pending"));
    });

    it("should preserve other filters when changing location", () => {
      mockSearchParams.set("search", "test");
      mockSearchParams.set("status", "pending");
      render(
        <CateringLeadsClient
          {...defaultProps}
          initialFilters={{
            search: "test",
            status: "pending",
            merchantId: "all",
          }}
        />
      );

      const locationSelect = screen.getByDisplayValue("All Locations");
      fireEvent.change(locationSelect, { target: { value: "merchant-2" } });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("search=test"));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("status=pending"));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("merchantId=merchant-2"));
    });
  });
});
