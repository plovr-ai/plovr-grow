import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GiftcardSuccessClient } from "../GiftcardSuccessClient";
import { MerchantProvider, LoyaltyProvider } from "@/contexts";
import type { ReactNode } from "react";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider
        config={{
          name: "Test Restaurant",
          logoUrl: null,
          currency: "USD",
          locale: "en-US",
          timezone: "America/New_York",
          tenantId: "test-company-id",
          companySlug: "test-company",
        }}
      >
        <LoyaltyProvider>{children}</LoyaltyProvider>
      </MerchantProvider>
    );
  };
}

const defaultProps = {
  order: {
    id: "order-123",
    orderNumber: "GC-001",
    totalAmount: 50.0,
    customerFirstName: "John",
    customerLastName: "Doe",
    customerPhone: "+15551234567",
    customerEmail: "john@example.com",
  },
  companySlug: "test-company",
};

// Helper to set up default mocks for non-member scenario
// Uses same format as LoyaltyRegistrationCTA tests
function setupNonMemberMocks() {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: "Not logged in" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { pointsAwarded: false } }),
    });
}

describe("GiftcardSuccessClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("order details display", () => {
    it("should display success message and order number", () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Gift Card Purchased!")).toBeInTheDocument();
      expect(screen.getByText("Thank you for your purchase")).toBeInTheDocument();
      expect(screen.getByText("Order #GC-001")).toBeInTheDocument();
    });

    it("should display order amount with formatted currency", () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Should display amount with USD format
      expect(screen.getByText("$50.00")).toBeInTheDocument();
    });

    it("should display buyer name", () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should display customer email when provided", () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("john@example.com")).toBeInTheDocument();
    });

    it("should not display email row when email is null", () => {
      setupNonMemberMocks();
      const propsWithoutEmail = {
        ...defaultProps,
        order: {
          ...defaultProps.order,
          customerEmail: null,
        },
      };

      render(<GiftcardSuccessClient {...propsWithoutEmail} />, {
        wrapper: createWrapper(),
      });

      // Email label should not be present
      const emailLabels = screen.queryAllByText("Email:");
      expect(emailLabels).toHaveLength(0);
    });

    it("should handle null names gracefully", () => {
      setupNonMemberMocks();
      const propsWithNullNames = {
        ...defaultProps,
        order: {
          ...defaultProps.order,
          customerFirstName: null,
          customerLastName: null,
        },
      };

      render(<GiftcardSuccessClient {...propsWithNullNames} />, {
        wrapper: createWrapper(),
      });

      // Should render without crashing
      expect(screen.getByText("Gift Card Purchased!")).toBeInTheDocument();
    });
  });

  describe("confirmation message", () => {
    it("should display email confirmation when email is provided", () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByText("A confirmation email has been sent to john@example.com")
      ).toBeInTheDocument();
    });

    it("should display save order number message when no email", () => {
      setupNonMemberMocks();
      const propsWithoutEmail = {
        ...defaultProps,
        order: {
          ...defaultProps.order,
          customerEmail: null,
        },
      };

      render(<GiftcardSuccessClient {...propsWithoutEmail} />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByText("Please save your order number for your records")
      ).toBeInTheDocument();
    });
  });

  describe("action buttons", () => {
    it("should display Buy Another Gift Card button with correct link", () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      const buyAnotherButton = screen.getByRole("button", {
        name: "Buy Another Gift Card",
      });
      expect(buyAnotherButton).toBeInTheDocument();

      // Check parent link
      const link = buyAnotherButton.closest("a");
      expect(link).toHaveAttribute("href", "/test-company/giftcard");
    });

    it("should display Return to Homepage button with correct link", () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      const homeButton = screen.getByRole("button", {
        name: "Return to Homepage",
      });
      expect(homeButton).toBeInTheDocument();

      // Check parent link
      const link = homeButton.closest("a");
      expect(link).toHaveAttribute("href", "/test-company");
    });
  });

  describe("LoyaltyRegistrationCTA integration", () => {
    it("should render LoyaltyRegistrationCTA component for non-members", async () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Wait for loyalty CTA to appear (content comes from LoyaltyRegistrationCTA)
      await waitFor(() => {
        expect(screen.getByText(/Join rewards and earn/)).toBeInTheDocument();
      });
    });

    it("should include orderId in LoyaltyRegistrationCTA", async () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Verify the order points status API is called with orderId
      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const pointsStatusCall = calls.find((call) =>
          (call[0] as string).includes("/api/storefront/loyalty/order-points-status")
        );
        expect(pointsStatusCall).toBeDefined();
        expect(pointsStatusCall![0]).toContain("orderId=order-123");
      });
    });
  });

  describe("currency formatting", () => {
    it("should use locale-aware currency formatting", () => {
      setupNonMemberMocks();
      render(<GiftcardSuccessClient {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // USD with en-US locale should show $50.00
      expect(screen.getByText("$50.00")).toBeInTheDocument();
    });

    it("should format different amounts correctly", () => {
      setupNonMemberMocks();
      const propsWithDifferentAmount = {
        ...defaultProps,
        order: {
          ...defaultProps.order,
          totalAmount: 100.5,
        },
      };

      render(<GiftcardSuccessClient {...propsWithDifferentAmount} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("$100.50")).toBeInTheDocument();
    });
  });
});
