import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroBanner } from "../HeroBanner";
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
    sun: { open: "12:00", close: "21:00", closed: false },
  },
  socialLinks: [],
};

describe("HeroBanner", () => {
  describe("basic rendering", () => {
    it("should render merchant name as heading", () => {
      render(<HeroBanner merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(
        screen.getByRole("heading", { name: "Joe's Pizza" })
      ).toBeInTheDocument();
    });

    it("should render tagline when provided", () => {
      render(<HeroBanner merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(
        screen.getByText("Authentic New York Style Pizza Since 1975")
      ).toBeInTheDocument();
    });

    it("should render full address", () => {
      render(<HeroBanner merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(
        screen.getByText("123 Main St, New York, NY 10001")
      ).toBeInTheDocument();
    });

    it("should render Order Online button", () => {
      render(<HeroBanner merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Order Online")).toBeInTheDocument();
    });

    it("should not render tagline when not provided", () => {
      const merchantWithoutTagline = { ...mockMerchant, tagline: undefined };
      render(
        <HeroBanner
          merchant={merchantWithoutTagline}
          companySlug="joes-pizza"
        />
      );

      expect(
        screen.queryByText("Authentic New York Style Pizza Since 1975")
      ).not.toBeInTheDocument();
    });
  });

  describe("link generation with companySlug", () => {
    it("should generate correct order link with menuLink prop", () => {
      render(
        <HeroBanner
          merchant={mockMerchant}
          companySlug="joes-pizza"
          menuLink="/r/joes-pizza-downtown/menu"
        />
      );

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza-downtown/menu");
    });

    it("should default menu link to /r/{slug}/menu without menuLink prop", () => {
      render(<HeroBanner merchant={mockMerchant} companySlug="joes-pizza" />);

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza/menu");
    });
  });

  describe("backward compatibility with tenantSlug", () => {
    it("should support deprecated tenantSlug prop", () => {
      render(<HeroBanner merchant={mockMerchant} tenantSlug="joes-pizza" />);

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza/menu");
    });

    it("should prefer companySlug over tenantSlug when both provided", () => {
      render(
        <HeroBanner
          merchant={mockMerchant}
          companySlug="new-slug"
          tenantSlug="old-slug"
        />
      );

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/new-slug/menu");
    });
  });

  describe("background styling", () => {
    it("should set hero image as background", () => {
      const { container } = render(
        <HeroBanner merchant={mockMerchant} companySlug="joes-pizza" />
      );

      const backgroundDiv = container.querySelector('[class*="bg-cover"]');
      expect(backgroundDiv).toHaveStyle({
        backgroundImage: "url(/images/hero.jpg)",
      });
    });
  });
});
