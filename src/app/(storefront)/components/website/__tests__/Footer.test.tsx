import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "../Footer";
import { MerchantProvider } from "@/contexts/MerchantContext";
import type { MerchantInfo } from "@/types/website";

const renderWithProvider = (ui: React.ReactElement, locale = "en-US") => {
  return render(
    <MerchantProvider config={{ name: "Test Restaurant", logoUrl: null, currency: "USD", locale, timezone: "America/New_York" }}>
      {ui}
    </MerchantProvider>
  );
};

const mockMerchant: MerchantInfo = {
  name: "Joe's Pizza",
  logo: "/images/logo.png",
  heroImage: "/images/hero.jpg",
  tagline: "Authentic New York Style Pizza Since 1975",
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
  currency: "USD",
  locale: "en-US",
};

describe("Footer", () => {
  describe("brand section", () => {
    it("should render merchant name", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Joe's Pizza")).toBeInTheDocument();
    });

    it("should render logo image", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const logo = screen.getByAltText("Joe's Pizza");
      expect(logo).toHaveAttribute("src", "/images/logo.png");
    });

    it("should render tagline", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(
        screen.getByText("Authentic New York Style Pizza Since 1975")
      ).toBeInTheDocument();
    });
  });

  describe("contact section", () => {
    it("should render phone with tel link", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      // Escape parentheses in regex
      const phoneLink = screen.getByRole("link", { name: /\(212\) 555-0100/ });
      expect(phoneLink).toHaveAttribute("href", "tel:(212) 555-0100");
    });

    it("should render email with mailto link", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const emailLink = screen.getByRole("link", { name: /info@joespizza.com/ });
      expect(emailLink).toHaveAttribute("href", "mailto:info@joespizza.com");
    });

    it("should render full address", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(
        screen.getByText("123 Main St, New York, NY 10001")
      ).toBeInTheDocument();
    });
  });

  describe("business hours", () => {
    it("should render business hours for each day", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Monday")).toBeInTheDocument();
      expect(screen.getByText("Tuesday")).toBeInTheDocument();
      expect(screen.getByText("Wednesday")).toBeInTheDocument();
      expect(screen.getByText("Thursday")).toBeInTheDocument();
      expect(screen.getByText("Friday")).toBeInTheDocument();
      expect(screen.getByText("Saturday")).toBeInTheDocument();
      expect(screen.getByText("Sunday")).toBeInTheDocument();
    });

    it("should display open hours correctly", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      // Multiple days have the same hours, so use getAllByText
      expect(screen.getAllByText("11:00 - 22:00").length).toBeGreaterThan(0);
      expect(screen.getAllByText("11:00 - 23:00").length).toBeGreaterThan(0);
    });

    it("should display Closed for closed days", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Closed")).toBeInTheDocument();
    });

    it("should show Sunday first for en-US locale", () => {
      renderWithProvider(
        <Footer merchant={mockMerchant} companySlug="joes-pizza" />,
        "en-US"
      );

      // Get all day elements from the Hours section
      const hoursHeading = screen.getByText("Hours");
      const hoursSection = hoursHeading.parentElement;
      const dayElements = hoursSection?.querySelectorAll(".space-y-2 > div > span:first-child");
      const days = Array.from(dayElements || []).map((el) => el.textContent);

      // en-US should start with Sunday
      expect(days[0]).toBe("Sunday");
    });

    it("should show Monday first for de-DE locale", () => {
      renderWithProvider(
        <Footer merchant={mockMerchant} companySlug="joes-pizza" />,
        "de-DE"
      );

      // Get all day elements from the Hours section
      const hoursHeading = screen.getByText("Hours");
      const hoursSection = hoursHeading.parentElement;
      const dayElements = hoursSection?.querySelectorAll(".space-y-2 > div > span:first-child");
      const days = Array.from(dayElements || []).map((el) => el.textContent);

      // de-DE should start with Monday (Montag in German)
      expect(days[0]).toBe("Montag");
    });
  });

  describe("social links", () => {
    it("should render social media links", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

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
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const facebookLink = screen.getByRole("link", { name: "facebook" });
      expect(facebookLink).toHaveAttribute("target", "_blank");
      expect(facebookLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("quick links with companySlug", () => {
    it("should generate correct Order Online link with menuLink prop", () => {
      renderWithProvider(
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
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const locationsLink = screen.getByRole("link", {
        name: "View All Locations",
      });
      expect(locationsLink).toHaveAttribute("href", "/joes-pizza/locations");
    });

    it("should default menu link to /r/{slug}/menu without menuLink prop", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const orderLinks = screen.getAllByRole("link", { name: /Order/ });
      orderLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/r/joes-pizza/menu");
      });
    });
  });

  describe("backward compatibility with tenantSlug", () => {
    it("should support deprecated tenantSlug prop", () => {
      renderWithProvider(<Footer merchant={mockMerchant} tenantSlug="joes-pizza" />);

      const orderLinks = screen.getAllByRole("link", { name: /Order/ });
      orderLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/r/joes-pizza/menu");
      });
    });

    it("should use brand-level locations path with tenantSlug", () => {
      renderWithProvider(<Footer merchant={mockMerchant} tenantSlug="joes-pizza" />);

      // Locations link should always use brand-level path
      const locationsLink = screen.getByRole("link", {
        name: "View All Locations",
      });
      expect(locationsLink).toHaveAttribute("href", "/joes-pizza/locations");
    });

    it("should prefer companySlug over tenantSlug when both provided", () => {
      renderWithProvider(
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
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      const currentYear = new Date().getFullYear();
      expect(
        screen.getByText(`© ${currentYear} Joe's Pizza. All rights reserved.`)
      ).toBeInTheDocument();
    });

    it("should display powered by text", () => {
      renderWithProvider(<Footer merchant={mockMerchant} companySlug="joes-pizza" />);

      expect(screen.getByText("Powered by")).toBeInTheDocument();
      expect(screen.getByText("Plovr")).toBeInTheDocument();
    });
  });

  describe("conditional sections for multi-merchant companies", () => {
    const emptyContactMerchant: MerchantInfo = {
      ...mockMerchant,
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      businessHours: {},
    };

    it("should hide Contact section when no contact info", () => {
      renderWithProvider(<Footer merchant={emptyContactMerchant} companySlug="joes-pizza" />);

      expect(screen.queryByText("Contact")).not.toBeInTheDocument();
    });

    it("should hide Hours section when no business hours", () => {
      renderWithProvider(<Footer merchant={emptyContactMerchant} companySlug="joes-pizza" />);

      expect(screen.queryByText("Hours")).not.toBeInTheDocument();
    });

    it("should show Contact section when phone is provided", () => {
      const merchantWithPhone = { ...emptyContactMerchant, phone: "(555) 123-4567" };
      renderWithProvider(<Footer merchant={merchantWithPhone} companySlug="joes-pizza" />);

      expect(screen.getByText("Contact")).toBeInTheDocument();
    });

    it("should show Contact section when email is provided", () => {
      const merchantWithEmail = { ...emptyContactMerchant, email: "test@example.com" };
      renderWithProvider(<Footer merchant={merchantWithEmail} companySlug="joes-pizza" />);

      expect(screen.getByText("Contact")).toBeInTheDocument();
    });

    it("should show Contact section when address is provided", () => {
      const merchantWithAddress = { ...emptyContactMerchant, address: "123 Main St" };
      renderWithProvider(<Footer merchant={merchantWithAddress} companySlug="joes-pizza" />);

      expect(screen.getByText("Contact")).toBeInTheDocument();
    });

    it("should show Hours section when business hours are provided", () => {
      const merchantWithHours = {
        ...emptyContactMerchant,
        businessHours: { mon: { open: "9:00", close: "17:00", closed: false } },
      };
      renderWithProvider(<Footer merchant={merchantWithHours} companySlug="joes-pizza" />);

      expect(screen.getByText("Hours")).toBeInTheDocument();
    });
  });
});
