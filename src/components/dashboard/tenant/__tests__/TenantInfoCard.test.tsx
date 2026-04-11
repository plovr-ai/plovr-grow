import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TenantInfoCard } from "../TenantInfoCard";

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

// Mock server actions
vi.mock("@/app/(dashboard)/dashboard/(protected)/tenant/actions", () => ({
  updateTenantSettingsAction: vi.fn().mockResolvedValue({ success: true }),
}));

const mockCompany = {
  id: "company-1",
  name: "Joe's Pizza",
  slug: "joes-pizza",
  legalName: "Joe's Pizza Inc.",
  description: "Authentic New York Style Pizza Since 1985",
  logoUrl: "https://example.com/logo.png",
  websiteUrl: "https://joespizza.com",
  supportEmail: "support@joespizza.com",
  supportPhone: "555-123-4567",
  currency: "USD",
  locale: "en-US",
  timezone: "America/New_York",
  status: "active",
  createdAt: new Date("2024-01-15"),
  merchants: [
    {
      id: "merchant-1",
      name: "Joe's Pizza Downtown",
      slug: "joes-pizza-downtown",
      city: "New York",
      state: "NY",
      status: "active",
    },
    {
      id: "merchant-2",
      name: "Joe's Pizza Midtown",
      slug: "joes-pizza-midtown",
      city: "New York",
      state: "NY",
      status: "active",
    },
    {
      id: "merchant-3",
      name: "Joe's Pizza Brooklyn",
      slug: "joes-pizza-brooklyn",
      city: "Brooklyn",
      state: "NY",
      status: "inactive",
    },
  ],
};

describe("TenantInfoCard", () => {
  describe("Basic Information", () => {
    it("should render company name", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("Joe's Pizza")).toBeInTheDocument();
    });

    it("should render legal name", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText(/Joe's Pizza Inc\./)).toBeInTheDocument();
    });

    it("should render slug", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("joes-pizza")).toBeInTheDocument();
    });

    it("should render status badge", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      // Multiple "Active" badges exist (company + merchants)
      const activeBadges = screen.getAllByText("Active");
      expect(activeBadges.length).toBeGreaterThan(0);
    });

    it("should render logo when logoUrl is provided", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const logo = screen.getByAltText("Joe's Pizza");
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
    });

    it("should render placeholder when logoUrl is not provided", () => {
      const companyWithoutLogo = { ...mockCompany, logoUrl: null };
      render(<TenantInfoCard tenant={companyWithoutLogo} />);
      expect(screen.queryByAltText("Joe's Pizza")).not.toBeInTheDocument();
    });
  });

  describe("Contact Information", () => {
    it("should render support email", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("support@joespizza.com")).toBeInTheDocument();
    });

    it("should render support phone", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("555-123-4567")).toBeInTheDocument();
    });

    it("should render website as a link", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const link = screen.getByText("https://joespizza.com");
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "https://joespizza.com");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("should show 'Not set' for missing contact info", () => {
      const companyWithoutContact = {
        ...mockCompany,
        supportEmail: null,
        supportPhone: null,
        websiteUrl: null,
      };
      render(<TenantInfoCard tenant={companyWithoutContact} />);
      const notSetElements = screen.getAllByText("Not set");
      expect(notSetElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Business Information", () => {
    it("should render currency", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("USD")).toBeInTheDocument();
    });

    it("should render locale", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("en-US")).toBeInTheDocument();
    });

    it("should render stores section header with count", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      // The store count is shown in the Stores section header
      expect(screen.getByText("Stores (3)")).toBeInTheDocument();
    });

    it("should render created date", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("January 15, 2024")).toBeInTheDocument();
    });
  });

  describe("Description", () => {
    it("should render description when provided", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(
        screen.getByText("Authentic New York Style Pizza Since 1985")
      ).toBeInTheDocument();
    });

    it("should not render description section when not provided", () => {
      const companyWithoutDescription = { ...mockCompany, description: null };
      render(<TenantInfoCard tenant={companyWithoutDescription} />);
      expect(
        screen.queryByText("Authentic New York Style Pizza Since 1985")
      ).not.toBeInTheDocument();
    });
  });

  describe("Stores List", () => {
    it("should render all merchants", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("Joe's Pizza Downtown")).toBeInTheDocument();
      expect(screen.getByText("Joe's Pizza Midtown")).toBeInTheDocument();
      expect(screen.getByText("Joe's Pizza Brooklyn")).toBeInTheDocument();
    });

    it("should render merchant locations", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const locations = screen.getAllByText("New York, NY");
      expect(locations.length).toBe(2);
      expect(screen.getByText("Brooklyn, NY")).toBeInTheDocument();
    });

    it("should render merchant status badges", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const activeBadges = screen.getAllByText("Active");
      const inactiveBadges = screen.getAllByText("Inactive");
      expect(activeBadges.length).toBeGreaterThanOrEqual(2);
      expect(inactiveBadges.length).toBe(1);
    });

    it("should render stores count in header", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      expect(screen.getByText("Stores (3)")).toBeInTheDocument();
    });

    it("should not render stores section when no merchants", () => {
      const companyWithoutMerchants = { ...mockCompany, merchants: [] };
      render(<TenantInfoCard tenant={companyWithoutMerchants} />);
      expect(screen.queryByText(/Stores \(/)).not.toBeInTheDocument();
    });
  });

  describe("Status Variations", () => {
    it("should render active status with green color", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const badge = screen.getAllByText("Active")[0];
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("should render inactive status with gray color", () => {
      const inactiveCompany = { ...mockCompany, status: "inactive" };
      render(<TenantInfoCard tenant={inactiveCompany} />);
      const badges = screen.getAllByText("Inactive");
      const companyBadge = badges[0];
      expect(companyBadge).toHaveClass("bg-gray-100", "text-gray-800");
    });

    it("should render suspended status with red color", () => {
      const suspendedCompany = { ...mockCompany, status: "suspended" };
      render(<TenantInfoCard tenant={suspendedCompany} />);
      const badge = screen.getByText("Suspended");
      expect(badge).toHaveClass("bg-red-100", "text-red-800");
    });
  });

  describe("Store click navigation", () => {
    it("should navigate to store detail when clicking a store", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      fireEvent.click(screen.getByText("Joe's Pizza Downtown"));
      expect(mockPush).toHaveBeenCalledWith("/dashboard/locations/merchant-1");
    });

    it("should render merchant without city/state", () => {
      const companyWithNoCityMerchant = {
        ...mockCompany,
        merchants: [
          {
            id: "merchant-no-city",
            name: "No City Store",
            slug: "no-city",
            city: null,
            state: null,
            status: "active",
          },
        ],
      };
      render(<TenantInfoCard tenant={companyWithNoCityMerchant} />);
      expect(screen.getByText("No City Store")).toBeInTheDocument();
      // Should not have city/state text
      expect(screen.queryByText(", ")).not.toBeInTheDocument();
    });

    it("should render merchant with unknown status using fallback color", () => {
      const companyWithUnknownStatus = {
        ...mockCompany,
        merchants: [
          {
            id: "merchant-unknown",
            name: "Unknown Status Store",
            slug: "unknown-status",
            city: "Test",
            state: "TX",
            status: "pending" as "active",
          },
        ],
      };
      render(<TenantInfoCard tenant={companyWithUnknownStatus} />);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  describe("link formatting", () => {
    it("should add https prefix to non-http website URLs", () => {
      const companyWithPlainUrl = {
        ...mockCompany,
        websiteUrl: "joespizza.com",
      };
      render(<TenantInfoCard tenant={companyWithPlainUrl} />);
      const link = screen.getByText("joespizza.com");
      expect(link).toHaveAttribute("href", "https://joespizza.com");
    });
  });

  describe("Edit Settings", () => {
    it("should render edit button", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const editButton = screen.getByRole("button", { name: /edit/i });
      expect(editButton).toBeInTheDocument();
    });

    it("should open settings modal when edit button is clicked", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);
      expect(screen.getByText("Edit Regional Settings")).toBeInTheDocument();
    });

    it("should close settings modal when cancel is clicked", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(screen.queryByText("Edit Regional Settings")).not.toBeInTheDocument();
    });

    it("should display current currency and locale in modal", () => {
      render(<TenantInfoCard tenant={mockCompany} />);
      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      const currencySelect = screen.getByLabelText("Currency") as HTMLSelectElement;
      const localeSelect = screen.getByLabelText("Locale") as HTMLSelectElement;

      expect(currencySelect.value).toBe("USD");
      expect(localeSelect.value).toBe("en-US");
    });
  });
});
