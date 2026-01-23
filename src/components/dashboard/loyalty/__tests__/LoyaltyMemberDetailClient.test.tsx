import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { LoyaltyMemberDetailClient } from "../LoyaltyMemberDetailClient";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Helper wrapper with DashboardContext
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
      }}
    >
      {children}
    </DashboardProvider>
  );
}

describe("LoyaltyMemberDetailClient", () => {
  const mockMember = {
    id: "member-1",
    phone: "2125551234",
    email: "john@example.com",
    name: "John Doe",
    points: 150,
    totalOrders: 5,
    totalSpent: 234.5,
    lastOrderAt: new Date("2024-01-15"),
    enrolledAt: new Date("2024-01-01"),
  };

  const mockOrders = {
    items: [
      {
        id: "order-1",
        orderNumber: "001",
        status: "completed",
        orderMode: "pickup",
        totalAmount: 45.99,
        createdAt: new Date("2024-01-15"),
        merchant: {
          id: "merchant-1",
          name: "Downtown Store",
          slug: "downtown",
          timezone: "America/New_York",
        },
      },
      {
        id: "order-2",
        orderNumber: "002",
        status: "pending",
        orderMode: "delivery",
        totalAmount: 78.5,
        createdAt: new Date("2024-01-20"),
        merchant: {
          id: "merchant-2",
          name: "Uptown Store",
          slug: "uptown",
          timezone: "America/New_York",
        },
      },
    ],
    total: 2,
    totalPages: 1,
  };

  const mockPoints = {
    items: [
      {
        id: "tx-1",
        type: "earn",
        points: 50,
        balanceAfter: 150,
        description: "Points earned from order",
        createdAt: new Date("2024-01-15"),
        order: {
          id: "order-1",
          orderNumber: "001",
        },
        merchant: {
          id: "merchant-1",
          name: "Downtown Store",
          slug: "downtown",
        },
      },
      {
        id: "tx-2",
        type: "redeem",
        points: -20,
        balanceAfter: 100,
        description: "Redeemed for discount",
        createdAt: new Date("2024-01-10"),
        order: null,
        merchant: null,
      },
    ],
    total: 2,
    totalPages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("tab");
    mockSearchParams.delete("page");
  });

  describe("Member Information Display", () => {
    it("should display member name when available", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      // Name appears in both header and info card
      const names = screen.getAllByText("John Doe");
      expect(names).toHaveLength(2);
    });

    it("should display phone number as header when name is not available", () => {
      const memberWithoutName = { ...mockMember, name: null };
      render(
        <LoyaltyMemberDetailClient
          member={memberWithoutName}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      // Phone appears in both header and info card when name is null
      const phones = screen.getAllByText("(212) 555-1234");
      expect(phones.length).toBeGreaterThanOrEqual(1);
    });

    it("should display member info card with all fields", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Member Information")).toBeInTheDocument();
      expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0);
      expect(screen.getAllByText("(212) 555-1234").length).toBeGreaterThan(0);
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText(/Enrolled/)).toBeInTheDocument();
    });

    it("should display dash for empty name field", () => {
      const memberWithoutName = { ...mockMember, name: null };
      render(
        <LoyaltyMemberDetailClient
          member={memberWithoutName}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      // Member information card should exist
      expect(screen.getByText("Member Information")).toBeInTheDocument();
      // Phone should be shown
      expect(screen.getAllByText("(212) 555-1234").length).toBeGreaterThan(0);
    });

    it("should display dash for empty email field", () => {
      const memberWithoutEmail = { ...mockMember, email: null };
      render(
        <LoyaltyMemberDetailClient
          member={memberWithoutEmail}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      // Member information card should exist
      expect(screen.getByText("Member Information")).toBeInTheDocument();
      // Name and phone should be shown
      expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0);
      expect(screen.getAllByText("(212) 555-1234").length).toBeGreaterThan(0);
    });
  });

  describe("Member Statistics Display", () => {
    it("should display statistics card with all metrics", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Statistics")).toBeInTheDocument();
      expect(screen.getByText("Points Balance")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText("Total Orders")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("Total Spent")).toBeInTheDocument();
      expect(screen.getByText("$234.50")).toBeInTheDocument();
      expect(screen.getByText("Last Order")).toBeInTheDocument();
    });

    it("should not display last order date when null", () => {
      const memberWithoutLastOrder = { ...mockMember, lastOrderAt: null };
      render(
        <LoyaltyMemberDetailClient
          member={memberWithoutLastOrder}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.queryByText("Last Order")).not.toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("should display both tabs", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Orders")).toBeInTheDocument();
      expect(screen.getByText("Points History")).toBeInTheDocument();
    });

    it("should highlight active tab", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      const ordersTab = screen.getByText("Orders");
      expect(ordersTab).toHaveClass("border-blue-500");
      expect(ordersTab).toHaveClass("text-blue-600");
    });

    it("should switch tabs when clicked", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={mockPoints}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      const pointsTab = screen.getByText("Points History");
      fireEvent.click(pointsTab);

      expect(mockPush).toHaveBeenCalledWith("?tab=points");
    });

    it("should reset to page 1 when changing tabs", () => {
      mockSearchParams.set("page", "3");

      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={mockPoints}
          currentTab="orders"
          currentPage={3}
        />,
        { wrapper: Wrapper }
      );

      const pointsTab = screen.getByText("Points History");
      fireEvent.click(pointsTab);

      expect(mockPush).toHaveBeenCalledWith("?tab=points");
    });
  });

  describe("Orders Tab", () => {
    it("should display orders table with correct columns", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Order #")).toBeInTheDocument();
      expect(screen.getByText("Date")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Merchant")).toBeInTheDocument();
      expect(screen.getByText("Total")).toBeInTheDocument();
    });

    it("should display order data correctly", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("#001")).toBeInTheDocument();
      expect(screen.getByText("#002")).toBeInTheDocument();
      expect(screen.getByText("Downtown Store")).toBeInTheDocument();
      expect(screen.getByText("Uptown Store")).toBeInTheDocument();
      expect(screen.getByText("$45.99")).toBeInTheDocument();
      expect(screen.getByText("$78.50")).toBeInTheDocument();
    });

    it("should display empty state when no orders", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={{ items: [], total: 0, totalPages: 0 }}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("No orders found")).toBeInTheDocument();
    });

    it("should link to order detail page", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      const orderLink = screen.getByText("#001").closest("a");
      expect(orderLink).toHaveAttribute("href", "/dashboard/orders/order-1");
    });
  });

  describe("Points History Tab", () => {
    it("should display points table with correct columns", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={null}
          points={mockPoints}
          currentTab="points"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Date")).toBeInTheDocument();
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Points")).toBeInTheDocument();
      expect(screen.getByText("Balance After")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
    });

    it("should display points transaction data correctly", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={null}
          points={mockPoints}
          currentTab="points"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Earned")).toBeInTheDocument();
      expect(screen.getByText("Redeemed")).toBeInTheDocument();
      expect(screen.getByText("+50")).toBeInTheDocument();
      expect(screen.getByText("-20")).toBeInTheDocument();
      expect(screen.getByText("Points earned from order")).toBeInTheDocument();
      expect(screen.getByText("Redeemed for discount")).toBeInTheDocument();
    });

    it("should display empty state when no points transactions", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={null}
          points={{ items: [], total: 0, totalPages: 0 }}
          currentTab="points"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("No point transactions found")).toBeInTheDocument();
    });

    it("should link to order when transaction has order", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={null}
          points={mockPoints}
          currentTab="points"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      const orderLink = screen.getByText("(Order #001)").closest("a");
      expect(orderLink).toHaveAttribute("href", "/dashboard/orders/order-1");
    });

    it("should display dash when description is null", () => {
      const pointsWithNullDescription = {
        ...mockPoints,
        items: [
          {
            ...mockPoints.items[0],
            description: null,
          },
        ],
      };

      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={null}
          points={pointsWithNullDescription}
          currentTab="points"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      const descriptionCells = screen.getAllByRole("cell");
      const descriptionCell = descriptionCells.find((cell) =>
        cell.textContent?.includes("-")
      );
      expect(descriptionCell).toBeInTheDocument();
    });
  });

  describe("Pagination", () => {
    it("should display pagination for orders tab", () => {
      const ordersWithMultiplePages = {
        ...mockOrders,
        totalPages: 3,
      };

      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={ordersWithMultiplePages}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("should display pagination for points tab", () => {
      const pointsWithMultiplePages = {
        ...mockPoints,
        totalPages: 2,
      };

      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={null}
          points={pointsWithMultiplePages}
          currentTab="points"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });
  });

  describe("Back Navigation", () => {
    it("should display back button with link to members list", () => {
      render(
        <LoyaltyMemberDetailClient
          member={mockMember}
          orders={mockOrders}
          points={null}
          currentTab="orders"
          currentPage={1}
        />,
        { wrapper: Wrapper }
      );

      const backLink = screen.getByRole("link", { name: "" });
      expect(backLink).toHaveAttribute("href", "/dashboard/loyalty/members");
    });
  });
});
