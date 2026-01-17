import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "../Footer";
import type { MerchantInfo } from "@/types/website";

const mockMerchant: MerchantInfo = {
  name: "Joe's Pizza",
  logo: "/images/logo.png",
  heroImage: "/images/hero.jpg",
  tagline: "Authentic New York Style Pizza Since 1975",
  description: "The best pizza in town",
  address: "123 Main St",
  city: "New York",
  state: "NY",
  zipCode: "10001",
  phone: "(212) 555-0100",
  email: "info@joespizza.com",
  businessHours: {
    mon: { open: "11:00", close: "22:00", closed: false },
    tue: { open: "11:00", close: "22:00", closed: false },
    wed: { open: "11:00", close: "22:00", closed: false },
    thu: { open: "11:00", close: "22:00", closed: false },
    fri: { open: "11:00", close: "23:00", closed: false },
    sat: { open: "11:00", close: "23:00", closed: false },
    sun: { closed: true, open: "", close: "" },
  },
  socialLinks: [
    { platform: "facebook", url: "https://facebook.com/joespizza" },
    { platform: "instagram", url: "https://instagram.com/joespizza" },
    { platform: "twitter", url: "https://twitter.com/joespizza" },
  ],
};

describe("Footer", () => {
  describe("brand section", () => {
    it("should render merchant name", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Joe's Pizza")).toBeInTheDocument();
    });

    it("should render logo image", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const logo = screen.getByAltText("Joe's Pizza");
      expect(logo).toHaveAttribute("src", "/images/logo.png");
    });

    it("should render tagline", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(
        screen.getByText("Authentic New York Style Pizza Since 1975")
      ).toBeInTheDocument();
    });
  });

  describe("contact section", () => {
    it("should render phone with tel link", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      // Escape parentheses in regex
      const phoneLink = screen.getByRole("link", { name: /\(212\) 555-0100/ });
      expect(phoneLink).toHaveAttribute("href", "tel:(212) 555-0100");
    });

    it("should render email with mailto link", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const emailLink = screen.getByRole("link", { name: /info@joespizza.com/ });
      expect(emailLink).toHaveAttribute("href", "mailto:info@joespizza.com");
    });

    it("should render full address", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(
        screen.getByText("123 Main St, New York, NY 10001")
      ).toBeInTheDocument();
    });
  });

  describe("business hours", () => {
    it("should render business hours for each day", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Monday")).toBeInTheDocument();
      expect(screen.getByText("Tuesday")).toBeInTheDocument();
      expect(screen.getByText("Wednesday")).toBeInTheDocument();
      expect(screen.getByText("Thursday")).toBeInTheDocument();
      expect(screen.getByText("Friday")).toBeInTheDocument();
      expect(screen.getByText("Saturday")).toBeInTheDocument();
      expect(screen.getByText("Sunday")).toBeInTheDocument();
    });

    it("should display open hours correctly", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      // Multiple days have the same hours, so use getAllByText
      expect(screen.getAllByText("11:00 - 22:00").length).toBeGreaterThan(0);
      expect(screen.getAllByText("11:00 - 23:00").length).toBeGreaterThan(0);
    });

    it("should display Closed for closed days", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Closed")).toBeInTheDocument();
    });
  });

  describe("social links", () => {
    it("should render social media links", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const facebookLink = screen.getByRole("link", { name: "facebook" });
      expect(facebookLink).toHaveAttribute(
        "href",
        "https://facebook.com/joespizza"
      );

      const instagramLink = screen.getByRole("link", { name: "instagram" });
      expect(instagramLink).toHaveAttribute(
        "href",
        "https://instagram.com/joespizza"
      );

      const twitterLink = screen.getByRole("link", { name: "twitter" });
      expect(twitterLink).toHaveAttribute(
        "href",
        "https://twitter.com/joespizza"
      );
    });

    it("should open social links in new tab", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const facebookLink = screen.getByRole("link", { name: "facebook" });
      expect(facebookLink).toHaveAttribute("target", "_blank");
      expect(facebookLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("quick links with companySlug", () => {
    it("should generate correct Order Online link with menuLink prop", () => {
      render(
        <Footer
          merchant={mockMerchant}
          companySlug="joes-pizza"
          menuLink="/r/joes-pizza-downtown/menu"
        />
      );

      const orderLinks = screen.getAllByRole("link", { name: /Order/ });
      orderLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/r/joes-pizza-downtown/menu");
      });
    });

    it("should generate correct locations link with companySlug", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const locationsLink = screen.getByRole("link", {
        name: "View All Locations",
      });
      expect(locationsLink).toHaveAttribute("href", "/joes-pizza/locations");
    });

    it("should default menu link to /r/{slug}/menu without menuLink prop", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const orderLinks = screen.getAllByRole("link", { name: /Order/ });
      orderLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/r/joes-pizza/menu");
      });
    });
  });

  describe("backward compatibility with tenantSlug", () => {
    it("should support deprecated tenantSlug prop", () => {
      render(<Footer merchant={mockMerchant} tenantSlug="joes-pizza" />);

      const orderLinks = screen.getAllByRole("link", { name: /Order/ });
      orderLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/r/joes-pizza/menu");
      });
    });

    it("should use /r/{slug}/locations with tenantSlug", () => {
      render(<Footer merchant={mockMerchant} tenantSlug="joes-pizza" />);

      const locationsLink = screen.getByRole("link", {
        name: "View All Locations",
      });
      expect(locationsLink).toHaveAttribute("href", "/r/joes-pizza/locations");
    });

    it("should prefer companySlug over tenantSlug when both provided", () => {
      render(
        <Footer
          merchant={mockMerchant}
          companySlug="new-slug"
          tenantSlug="old-slug"
        />
      );

      const locationsLink = screen.getByRole("link", {
        name: "View All Locations",
      });
      expect(locationsLink).toHaveAttribute("href", "/new-slug/locations");
    });
  });

  describe("copyright section", () => {
    it("should display current year in copyright", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const currentYear = new Date().getFullYear();
      expect(
        screen.getByText(`© ${currentYear} Joe's Pizza. All rights reserved.`)
      ).toBeInTheDocument();
    });

    it("should display powered by text", () => {
      render(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Powered by")).toBeInTheDocument();
      expect(screen.getByText("Reborn")).toBeInTheDocument();
    });
  });
});
