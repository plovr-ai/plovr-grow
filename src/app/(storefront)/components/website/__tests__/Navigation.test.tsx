import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Navigation } from "../Navigation";

describe("Navigation", () => {
  const defaultProps = {
    logo: "/images/logo.png",
    restaurantName: "Joe's Pizza",
  };

  describe("basic rendering", () => {
    it("should render restaurant name", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      expect(screen.getByText("Joe's Pizza")).toBeInTheDocument();
    });

    it("should render logo image", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      const logo = screen.getByAltText("Joe's Pizza");
      expect(logo).toHaveAttribute("src", "/images/logo.png");
    });

    it("should render Order Online button", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      expect(screen.getByText("Order Online")).toBeInTheDocument();
    });

    it("should render Sign In button on desktop", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    it("should render navigation links", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      expect(screen.getByText("Menu")).toBeInTheDocument();
      expect(screen.getByText("Locations")).toBeInTheDocument();
      expect(screen.getByText("Our Story")).toBeInTheDocument();
      expect(screen.getByText("Contact")).toBeInTheDocument();
    });
  });

  describe("link generation with companySlug", () => {
    it("should generate correct home link with companySlug", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      const logoLink = screen.getByRole("link", { name: /Joe's Pizza/ });
      expect(logoLink).toHaveAttribute("href", "/joes-pizza");
    });

    it("should generate correct menu link with menuLink prop", () => {
      render(
        <Navigation
          {...defaultProps}
          companySlug="joes-pizza"
          menuLink="/r/joes-pizza-downtown/menu"
        />
      );

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza-downtown/menu");
    });

    it("should generate correct locations link with companySlug", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      const locationsLink = screen.getAllByText("Locations")[0];
      expect(locationsLink).toHaveAttribute("href", "/joes-pizza/locations");
    });

    it("should default menu link to /r/{slug}/menu without menuLink prop", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza/menu");
    });
  });

  describe("backward compatibility with tenantSlug", () => {
    it("should support deprecated tenantSlug prop", () => {
      render(<Navigation {...defaultProps} tenantSlug="joes-pizza" />);

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza/menu");
    });

    it("should use brand-level paths with tenantSlug", () => {
      render(<Navigation {...defaultProps} tenantSlug="joes-pizza" />);

      // Home and locations links should always use brand-level paths
      const logoLink = screen.getByRole("link", { name: /Joe's Pizza/ });
      expect(logoLink).toHaveAttribute("href", "/joes-pizza");
    });

    it("should prefer companySlug over tenantSlug when both provided", () => {
      render(
        <Navigation
          {...defaultProps}
          companySlug="new-slug"
          tenantSlug="old-slug"
        />
      );

      const logoLink = screen.getByRole("link", { name: /Joe's Pizza/ });
      expect(logoLink).toHaveAttribute("href", "/new-slug");
    });
  });

  describe("mobile menu", () => {
    it("should toggle mobile menu when button is clicked", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      const menuButton = screen.getByLabelText("Toggle menu");

      // Menu should be closed initially - only desktop nav links should be visible
      const initialMenuLinks = screen.getAllByText("Menu");
      expect(initialMenuLinks.length).toBe(1);

      // Open menu
      fireEvent.click(menuButton);

      // Menu should be open - both desktop and mobile nav links should be visible
      const openMenuLinks = screen.getAllByText("Menu");
      expect(openMenuLinks.length).toBe(2);

      // Close menu
      fireEvent.click(menuButton);

      // Menu should be closed again
      const closedMenuLinks = screen.getAllByText("Menu");
      expect(closedMenuLinks.length).toBe(1);
    });

    it("should close mobile menu when a link is clicked", () => {
      render(<Navigation {...defaultProps} companySlug="joes-pizza" />);

      const menuButton = screen.getByLabelText("Toggle menu");

      // Open menu
      fireEvent.click(menuButton);
      expect(screen.getAllByText("Menu").length).toBe(2);

      // Click a mobile menu link
      const mobileMenuLinks = screen.getAllByText("Our Story");
      fireEvent.click(mobileMenuLinks[1]); // Click the mobile version

      // Menu should be closed
      expect(screen.getAllByText("Menu").length).toBe(1);
    });
  });
});
