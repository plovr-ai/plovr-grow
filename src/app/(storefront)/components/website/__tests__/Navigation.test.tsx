import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Navigation } from "../Navigation";
import { MerchantProvider, LoyaltyProvider } from "@/contexts";

// Mock fetch for LoyaltyProvider - returns success: false to indicate no member logged in
vi.stubGlobal("fetch", vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ success: false }),
  })
));

// Wrapper component that provides required context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MerchantProvider
      config={{
        name: "Test Restaurant",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companyId: "test-company-id",
        companySlug: "test-company",
      }}
    >
      <LoyaltyProvider>{children}</LoyaltyProvider>
    </MerchantProvider>
  );
}

describe("Navigation", () => {
  const defaultProps = {
    logo: "/images/logo.png",
    restaurantName: "Joe's Pizza",
  };

  describe("basic rendering", () => {
    it("should render restaurant name", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

      expect(screen.getByText("Joe's Pizza")).toBeInTheDocument();
    });

    it("should render logo image", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

      const logo = screen.getByAltText("Joe's Pizza");
      expect(logo).toHaveAttribute("src", "/images/logo.png");
    });

    it("should render Order Online button", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

      expect(screen.getByText("Order Online")).toBeInTheDocument();
    });

    it("should not render Sign In button when loyalty is disabled", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" isLoyaltyEnabled={false} />
        </TestWrapper>
      );

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
      });
    });

    it("should render Sign In button when loyalty is enabled", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" isLoyaltyEnabled={true} />
        </TestWrapper>
      );

      // Wait for loading to finish and Sign In button to appear
      await waitFor(() => {
        expect(screen.getByText("Sign In")).toBeInTheDocument();
      });
    });

    it("should render navigation links", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

      expect(screen.getByText("Menu")).toBeInTheDocument();
      expect(screen.getByText("Catering")).toBeInTheDocument();
      expect(screen.getByText("Gift Cards")).toBeInTheDocument();
      expect(screen.getByText("Locations")).toBeInTheDocument();
      expect(screen.getByText("Our Story")).toBeInTheDocument();
    });
  });

  describe("link generation with companySlug", () => {
    it("should generate correct home link with companySlug", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

      const logoLink = screen.getByRole("link", { name: /Joe's Pizza/ });
      expect(logoLink).toHaveAttribute("href", "/joes-pizza");
    });

    it("should generate correct menu link with menuLink prop", async () => {
      render(
        <TestWrapper>
          <Navigation
            {...defaultProps}
            companySlug="joes-pizza"
            menuLink="/r/joes-pizza-downtown/menu"
          />
        </TestWrapper>
      );

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza-downtown/menu");
    });

    it("should generate correct locations link with companySlug", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

      const locationsLink = screen.getAllByText("Locations")[0];
      expect(locationsLink).toHaveAttribute("href", "/joes-pizza/locations");
    });

    it("should default menu link to /r/{slug}/menu without menuLink prop", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza/menu");
    });
  });

  describe("backward compatibility with tenantSlug", () => {
    it("should support deprecated tenantSlug prop", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} tenantSlug="joes-pizza" />
        </TestWrapper>
      );

      const orderButton = screen.getByRole("link", { name: "Order Online" });
      expect(orderButton).toHaveAttribute("href", "/r/joes-pizza/menu");
    });

    it("should use brand-level paths with tenantSlug", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} tenantSlug="joes-pizza" />
        </TestWrapper>
      );

      // Home and locations links should always use brand-level paths
      const logoLink = screen.getByRole("link", { name: /Joe's Pizza/ });
      expect(logoLink).toHaveAttribute("href", "/joes-pizza");
    });

    it("should prefer companySlug over tenantSlug when both provided", async () => {
      render(
        <TestWrapper>
          <Navigation
            {...defaultProps}
            companySlug="new-slug"
            tenantSlug="old-slug"
          />
        </TestWrapper>
      );

      const logoLink = screen.getByRole("link", { name: /Joe's Pizza/ });
      expect(logoLink).toHaveAttribute("href", "/new-slug");
    });
  });

  describe("mobile menu", () => {
    it("should toggle mobile menu when button is clicked", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

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

    it("should close mobile menu when a link is clicked", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" />
        </TestWrapper>
      );

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

    it("should show Sign In in mobile menu when loyalty is enabled", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" isLoyaltyEnabled={true} />
        </TestWrapper>
      );

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.getByText("Sign In")).toBeInTheDocument();
      });

      const menuButton = screen.getByLabelText("Toggle menu");

      // Open menu
      fireEvent.click(menuButton);

      // Should have Sign In button in mobile menu (2 instances: desktop + mobile)
      const signInButtons = screen.getAllByText("Sign In");
      expect(signInButtons.length).toBe(2);
    });
  });

  describe("Sign In modal", () => {
    it("should open Sign In modal when button is clicked", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" isLoyaltyEnabled={true} />
        </TestWrapper>
      );

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.getByText("Sign In")).toBeInTheDocument();
      });

      const signInButton = screen.getByRole("button", { name: "Sign In" });
      fireEvent.click(signInButton);

      // Modal should be open
      expect(screen.getByText("Sign In to Earn Rewards")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    });

    it("should close Sign In modal when close button is clicked", async () => {
      render(
        <TestWrapper>
          <Navigation {...defaultProps} companySlug="joes-pizza" isLoyaltyEnabled={true} />
        </TestWrapper>
      );

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.getByText("Sign In")).toBeInTheDocument();
      });

      // Open modal
      const signInButton = screen.getByRole("button", { name: "Sign In" });
      fireEvent.click(signInButton);
      expect(screen.getByText("Sign In to Earn Rewards")).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByLabelText("Close");
      fireEvent.click(closeButton);

      // Modal should be closed
      expect(screen.queryByText("Sign In to Earn Rewards")).not.toBeInTheDocument();
    });
  });
});
