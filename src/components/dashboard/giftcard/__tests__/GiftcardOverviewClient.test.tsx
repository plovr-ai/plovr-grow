import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { GiftcardOverviewClient } from "../GiftcardOverviewClient";
import type { GiftCardStats, GiftCardWithOrder } from "@/services/giftcard";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Helper wrapper with DashboardContext (needed for useDashboardFormatPrice)
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider
      value={{
        tenantId: "tenant-1",
        companyId: "company-1",
        company: {
          id: "company-1",
          name: "Test Company",
          slug: "test-company",
          logoUrl: null,
        },
        merchants: [
          {
            id: "merchant-1",
            name: "Test Store",
            slug: "test-store",
            address: "123 Test St",
            city: "Test City",
            status: "active",
          },
        ],
        currency: "USD",
        locale: "en-US",
        subscription: null,
      }}
    >
      {children}
    </DashboardProvider>
  );
}

describe("GiftcardOverviewClient", () => {
  const mockStats: GiftCardStats = {
    totalCards: 25,
    totalValueSold: 2500,
    totalRedeemed: 750,
    activeBalance: 1750,
  };

  const mockGiftCards: GiftCardWithOrder[] = [
    {
      id: "gc-1",
      cardNumber: "1234-5678-9012-3456",
      initialAmount: 100,
      currentBalance: 75,
      createdAt: new Date("2024-01-15"),
      purchaseOrder: {
        id: "order-1",
        orderNumber: "ORD-001",
        customerFirstName: "John",
        customerLastName: "Doe",
        customerEmail: "john@example.com",
      },
    },
    {
      id: "gc-2",
      cardNumber: "2345-6789-0123-4567",
      initialAmount: 50,
      currentBalance: 0,
      createdAt: new Date("2024-01-10"),
      purchaseOrder: {
        id: "order-2",
        orderNumber: "ORD-002",
        customerFirstName: "Jane",
        customerLastName: "Smith",
        customerEmail: null,
      },
    },
    {
      id: "gc-3",
      cardNumber: "3456-7890-1234-5678",
      initialAmount: 200,
      currentBalance: 200,
      createdAt: new Date("2024-01-05"),
      purchaseOrder: {
        id: "order-3",
        orderNumber: "ORD-003",
        customerFirstName: "Bob",
        customerLastName: "Wilson",
        customerEmail: "bob@example.com",
      },
    },
  ];

  const defaultProps = {
    stats: mockStats,
    giftCards: mockGiftCards,
    totalPages: 3,
    currentPage: 1,
    total: 50,
    initialFilters: {
      search: "",
      dateFrom: "",
      dateTo: "",
    },
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  });

  describe("Header", () => {
    it("should render the page title and total count", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Gift Cards")).toBeInTheDocument();
      expect(
        screen.getByText(/Manage and track your gift card program/)
      ).toBeInTheDocument();
      expect(screen.getByText(/50 total/)).toBeInTheDocument();
    });
  });

  describe("Stats Cards", () => {
    it("should render all four stats cards", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Total Gift Cards")).toBeInTheDocument();
      expect(screen.getByText("Total Value Sold")).toBeInTheDocument();
      expect(screen.getByText("Total Redeemed")).toBeInTheDocument();
      expect(screen.getByText("Active Balance")).toBeInTheDocument();
    });

    it("should display correct stats values", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      // Total cards
      expect(screen.getByText("25")).toBeInTheDocument();

      // Currency values
      expect(screen.getByText("$2,500.00")).toBeInTheDocument();
      expect(screen.getByText("$750.00")).toBeInTheDocument();
      expect(screen.getByText("$1,750.00")).toBeInTheDocument();
    });
  });

  describe("Search", () => {
    it("should render search input", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      expect(
        screen.getByPlaceholderText("Search by card number, name, or email...")
      ).toBeInTheDocument();
    });

    it("should update search input value", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      const searchInput = screen.getByPlaceholderText(
        "Search by card number, name, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "1234-5678" } });

      expect(searchInput).toHaveValue("1234-5678");
    });

    it("should update URL with search param on form submit", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      const searchInput = screen.getByPlaceholderText(
        "Search by card number, name, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "john" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("search=john"));
    });

    it("should remove page param when searching", () => {
      mockSearchParams.set("page", "3");
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      const searchInput = screen.getByPlaceholderText(
        "Search by card number, name, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "test" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("page=")
      );
    });
  });

  describe("Table", () => {
    it("should render table headers", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Card Number")).toBeInTheDocument();
      expect(screen.getByText("Customer")).toBeInTheDocument();
      expect(screen.getByText("Initial Amount")).toBeInTheDocument();
      expect(screen.getByText("Balance")).toBeInTheDocument();
      expect(screen.getByText("Created")).toBeInTheDocument();
    });

    it("should render gift card data in table rows", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      // First gift card
      expect(screen.getByText("1234-5678-9012-3456")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("$100.00")).toBeInTheDocument();
      expect(screen.getByText("$75.00")).toBeInTheDocument();

      // Second gift card
      expect(screen.getByText("2345-6789-0123-4567")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("$50.00")).toBeInTheDocument();
      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });

    it("should format dates correctly", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
      expect(screen.getByText("Jan 10, 2024")).toBeInTheDocument();
      expect(screen.getByText("Jan 5, 2024")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should show empty message when no gift cards", () => {
      render(
        <GiftcardOverviewClient
          {...defaultProps}
          giftCards={[]}
          total={0}
          totalPages={0}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("No gift cards found")).toBeInTheDocument();
    });

    it("should still show stats cards when no gift cards", () => {
      render(
        <GiftcardOverviewClient
          {...defaultProps}
          giftCards={[]}
          total={0}
          totalPages={0}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Total Gift Cards")).toBeInTheDocument();
      expect(screen.getByText("Total Value Sold")).toBeInTheDocument();
    });
  });

  describe("Pagination", () => {
    it("should render pagination when multiple pages", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
    });

    it("should disable previous button on first page", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      const prevButton = screen.getByRole("button", { name: /Previous/i });
      expect(prevButton).toBeDisabled();
    });

    it("should disable next button on last page", () => {
      render(
        <GiftcardOverviewClient {...defaultProps} currentPage={3} />,
        { wrapper: Wrapper }
      );

      const nextButton = screen.getByRole("button", { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it("should update URL with page param on next click", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      const nextButton = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextButton);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });

    it("should update URL with page param on previous click", () => {
      render(
        <GiftcardOverviewClient {...defaultProps} currentPage={2} />,
        { wrapper: Wrapper }
      );

      const prevButton = screen.getByRole("button", { name: /Previous/i });
      fireEvent.click(prevButton);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("page=1"));
    });
  });

  describe("Initial Filters", () => {
    it("should show search value from initialFilters", () => {
      render(
        <GiftcardOverviewClient
          {...defaultProps}
          initialFilters={{ search: "test query", dateFrom: "", dateTo: "" }}
        />,
        { wrapper: Wrapper }
      );

      const searchInput = screen.getByPlaceholderText(
        "Search by card number, name, or email..."
      );
      expect(searchInput).toHaveValue("test query");
    });
  });

  describe("Currency Formatting", () => {
    it("should format prices with USD currency", () => {
      render(<GiftcardOverviewClient {...defaultProps} />, { wrapper: Wrapper });

      // Stats values
      expect(screen.getByText("$2,500.00")).toBeInTheDocument();
      expect(screen.getByText("$750.00")).toBeInTheDocument();
      expect(screen.getByText("$1,750.00")).toBeInTheDocument();

      // Table values
      expect(screen.getByText("$100.00")).toBeInTheDocument();
      expect(screen.getByText("$75.00")).toBeInTheDocument();
    });
  });

  describe("Different Stats Values", () => {
    it("should handle zero stats values", () => {
      const zeroStats: GiftCardStats = {
        totalCards: 0,
        totalValueSold: 0,
        totalRedeemed: 0,
        activeBalance: 0,
      };

      render(
        <GiftcardOverviewClient
          {...defaultProps}
          stats={zeroStats}
          giftCards={[]}
          total={0}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getAllByText("$0.00").length).toBe(3);
    });

    it("should handle large stats values", () => {
      const largeStats: GiftCardStats = {
        totalCards: 10000,
        totalValueSold: 1000000,
        totalRedeemed: 500000,
        activeBalance: 500000,
      };

      render(
        <GiftcardOverviewClient {...defaultProps} stats={largeStats} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("10000")).toBeInTheDocument();
      expect(screen.getByText("$1,000,000.00")).toBeInTheDocument();
    });
  });
});
