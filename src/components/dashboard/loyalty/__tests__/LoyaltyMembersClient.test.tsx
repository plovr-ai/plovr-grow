import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { LoyaltyMembersClient } from "../LoyaltyMembersClient";
import type { LoyaltyMemberData } from "@/services/loyalty/loyalty.types";

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
        tenant: {
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
        onboarding: { status: "not_started" as const, data: null },
      }}
    >
      {children}
    </DashboardProvider>
  );
}

describe("LoyaltyMembersClient", () => {
  const mockMembers: LoyaltyMemberData[] = [
    {
      id: "member-1",
      tenantId: "tenant-1",
      phone: "2125551234",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      points: 150,
      totalOrders: 5,
      totalSpent: 234.5,
      lastOrderAt: new Date("2024-01-15"),
      enrolledAt: new Date("2024-01-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "member-2",
      tenantId: "tenant-1",
      phone: "3105559876",
      email: null,
      firstName: null,
      lastName: null,
      points: 320,
      totalOrders: 12,
      totalSpent: 567.8,
      lastOrderAt: new Date("2024-01-20"),
      enrolledAt: new Date("2023-12-15"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "member-3",
      tenantId: "tenant-1",
      phone: "4155554567",
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Wilson",
      points: 0,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: null,
      enrolledAt: new Date("2024-01-10"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const defaultProps = {
    members: mockMembers,
    totalPages: 3,
    currentPage: 1,
    total: 50,
    initialFilters: {
      search: "",
    },
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  });

  describe("Rendering", () => {
    it("should render the page title and total count", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Loyalty Members")).toBeInTheDocument();
      expect(
        screen.getByText(/View and manage your loyalty program members/)
      ).toBeInTheDocument();
      expect(screen.getByText(/50 total/)).toBeInTheDocument();
    });

    it("should render search input", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      expect(
        screen.getByPlaceholderText("Search by phone, name, or email...")
      ).toBeInTheDocument();
    });

    it("should render table headers", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Phone")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Points")).toBeInTheDocument();
      expect(screen.getByText("Orders")).toBeInTheDocument();
      expect(screen.getByText("Total Spent")).toBeInTheDocument();
      expect(screen.getByText("Enrolled")).toBeInTheDocument();
    });

    it("should render member data in table rows", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      // First member - phone formatted as (XXX) XXX-XXXX
      expect(screen.getByText("(212) 555-1234")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("$234.50")).toBeInTheDocument();

      // Second member (no name) - phone formatted
      expect(screen.getByText("(310) 555-9876")).toBeInTheDocument();
      expect(screen.getByText("320")).toBeInTheDocument();
    });

    it("should format phone numbers correctly", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      // All phone numbers should be formatted as (XXX) XXX-XXXX
      expect(screen.getByText("(212) 555-1234")).toBeInTheDocument();
      expect(screen.getByText("(310) 555-9876")).toBeInTheDocument();
      expect(screen.getByText("(415) 555-4567")).toBeInTheDocument();
    });

    it("should show dash for null name", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      const dashes = screen.getAllByText("-");
      expect(dashes.length).toBeGreaterThan(0);
    });

    it("should show last name only when firstName is null", () => {
      const membersWithLastNameOnly: LoyaltyMemberData[] = [
        {
          id: "member-ln",
          tenantId: "tenant-1",          phone: "5555555555",
          email: null,
          firstName: null,
          lastName: "Smith",
          points: 50,
          totalOrders: 1,
          totalSpent: 10,
          lastOrderAt: null,
          enrolledAt: new Date("2024-01-01"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      render(
        <LoyaltyMembersClient
          {...defaultProps}
          members={membersWithLastNameOnly}
        />,
        { wrapper: Wrapper }
      );

      // lastName-only member should be formatted
      expect(screen.getByText("Smith")).toBeInTheDocument();
    });

    it("should render enrolled dates correctly", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      // Check that dates are formatted
      expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
      expect(screen.getByText("Dec 15, 2023")).toBeInTheDocument();
      expect(screen.getByText("Jan 10, 2024")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should show empty message when no members", () => {
      render(
        <LoyaltyMembersClient
          {...defaultProps}
          members={[]}
          total={0}
          totalPages={0}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("No members found")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("should update search input value", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      const searchInput = screen.getByPlaceholderText(
        "Search by phone, name, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "john" } });

      expect(searchInput).toHaveValue("john");
    });

    it("should update URL with search param on form submit", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      const searchInput = screen.getByPlaceholderText(
        "Search by phone, name, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "john" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("search=john"));
    });

    it("should remove page param when searching", () => {
      mockSearchParams.set("page", "3");
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      const searchInput = screen.getByPlaceholderText(
        "Search by phone, name, or email..."
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
        <LoyaltyMembersClient
          {...defaultProps}
          initialFilters={{ search: "test" }}
        />,
        { wrapper: Wrapper }
      );

      const searchInput = screen.getByPlaceholderText(
        "Search by phone, name, or email..."
      );
      fireEvent.change(searchInput, { target: { value: "" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("search=")
      );
    });
  });

  describe("Pagination", () => {
    it("should render pagination when multiple pages", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
    });

    it("should disable previous button on first page", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      const prevButton = screen.getByRole("button", { name: /Previous/i });
      expect(prevButton).toBeDisabled();
    });

    it("should disable next button on last page", () => {
      render(
        <LoyaltyMembersClient {...defaultProps} currentPage={3} />,
        { wrapper: Wrapper }
      );

      const nextButton = screen.getByRole("button", { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it("should update URL with page param on next click", () => {
      render(<LoyaltyMembersClient {...defaultProps} />, { wrapper: Wrapper });

      const nextButton = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextButton);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });

    it("should update URL with page param on previous click", () => {
      render(
        <LoyaltyMembersClient {...defaultProps} currentPage={2} />,
        { wrapper: Wrapper }
      );

      const prevButton = screen.getByRole("button", { name: /Previous/i });
      fireEvent.click(prevButton);

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("page=1"));
    });

    it("should render pagination even when single page", () => {
      render(
        <LoyaltyMembersClient {...defaultProps} totalPages={1} />,
        { wrapper: Wrapper }
      );

      // Should now render the pagination
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();

      // Both buttons should be disabled
      const prevButton = screen.getByRole("button", { name: /Previous/i });
      const nextButton = screen.getByRole("button", { name: /Next/i });

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  describe("Initial Filters", () => {
    it("should show search value from initialFilters", () => {
      render(
        <LoyaltyMembersClient
          {...defaultProps}
          initialFilters={{ search: "test query" }}
        />,
        { wrapper: Wrapper }
      );

      const searchInput = screen.getByPlaceholderText(
        "Search by phone, name, or email..."
      );
      expect(searchInput).toHaveValue("test query");
    });
  });
});
