import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyInfoCard } from "../CompanyInfoCard";

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

describe("CompanyInfoCard", () => {
  describe("Basic Information", () => {
    it("should render company name", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("Joe's Pizza")).toBeInTheDocument();
    });

    it("should render legal name", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText(/Joe's Pizza Inc\./)).toBeInTheDocument();
    });

    it("should render slug", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("joes-pizza")).toBeInTheDocument();
    });

    it("should render status badge", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      // Multiple "Active" badges exist (company + merchants)
      const activeBadges = screen.getAllByText("Active");
      expect(activeBadges.length).toBeGreaterThan(0);
    });

    it("should render logo when logoUrl is provided", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      const logo = screen.getByAltText("Joe's Pizza");
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
    });

    it("should render placeholder when logoUrl is not provided", () => {
      const companyWithoutLogo = { ...mockCompany, logoUrl: null };
      render(<CompanyInfoCard company={companyWithoutLogo} />);
      expect(screen.queryByAltText("Joe's Pizza")).not.toBeInTheDocument();
    });
  });

  describe("Contact Information", () => {
    it("should render support email", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("support@joespizza.com")).toBeInTheDocument();
    });

    it("should render support phone", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("555-123-4567")).toBeInTheDocument();
    });

    it("should render website as a link", () => {
      render(<CompanyInfoCard company={mockCompany} />);
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
      render(<CompanyInfoCard company={companyWithoutContact} />);
      const notSetElements = screen.getAllByText("Not set");
      expect(notSetElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Business Information", () => {
    it("should render currency", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("USD")).toBeInTheDocument();
    });

    it("should render locale", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("en-US")).toBeInTheDocument();
    });

    it("should render store count", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("2 active / 3 total")).toBeInTheDocument();
    });

    it("should render created date", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("January 15, 2024")).toBeInTheDocument();
    });
  });

  describe("Description", () => {
    it("should render description when provided", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(
        screen.getByText("Authentic New York Style Pizza Since 1985")
      ).toBeInTheDocument();
    });

    it("should not render description section when not provided", () => {
      const companyWithoutDescription = { ...mockCompany, description: null };
      render(<CompanyInfoCard company={companyWithoutDescription} />);
      expect(
        screen.queryByText("Authentic New York Style Pizza Since 1985")
      ).not.toBeInTheDocument();
    });
  });

  describe("Stores List", () => {
    it("should render all merchants", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("Joe's Pizza Downtown")).toBeInTheDocument();
      expect(screen.getByText("Joe's Pizza Midtown")).toBeInTheDocument();
      expect(screen.getByText("Joe's Pizza Brooklyn")).toBeInTheDocument();
    });

    it("should render merchant locations", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      const locations = screen.getAllByText("New York, NY");
      expect(locations.length).toBe(2);
      expect(screen.getByText("Brooklyn, NY")).toBeInTheDocument();
    });

    it("should render merchant status badges", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      const activeBadges = screen.getAllByText("Active");
      const inactiveBadges = screen.getAllByText("Inactive");
      expect(activeBadges.length).toBeGreaterThanOrEqual(2);
      expect(inactiveBadges.length).toBe(1);
    });

    it("should render stores count in header", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      expect(screen.getByText("Stores (3)")).toBeInTheDocument();
    });

    it("should not render stores section when no merchants", () => {
      const companyWithoutMerchants = { ...mockCompany, merchants: [] };
      render(<CompanyInfoCard company={companyWithoutMerchants} />);
      expect(screen.queryByText(/Stores \(/)).not.toBeInTheDocument();
    });
  });

  describe("Status Variations", () => {
    it("should render active status with green color", () => {
      render(<CompanyInfoCard company={mockCompany} />);
      const badge = screen.getAllByText("Active")[0];
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("should render inactive status with gray color", () => {
      const inactiveCompany = { ...mockCompany, status: "inactive" };
      render(<CompanyInfoCard company={inactiveCompany} />);
      const badges = screen.getAllByText("Inactive");
      const companyBadge = badges[0];
      expect(companyBadge).toHaveClass("bg-gray-100", "text-gray-800");
    });

    it("should render suspended status with red color", () => {
      const suspendedCompany = { ...mockCompany, status: "suspended" };
      render(<CompanyInfoCard company={suspendedCompany} />);
      const badge = screen.getByText("Suspended");
      expect(badge).toHaveClass("bg-red-100", "text-red-800");
    });
  });
});
