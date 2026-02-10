import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationList } from "../LocationList";

const mockLocations = [
  {
    id: "merchant-downtown",
    slug: "downtown",
    name: "Downtown Location",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    phone: "(555) 123-4567",
    email: "downtown@example.com",
    businessHours: {
      mon: { open: "9:00 AM", close: "9:00 PM" },
    },
    status: "active" as const,
  },
  {
    id: "merchant-midtown",
    slug: "midtown",
    name: "Midtown Location",
    address: "456 Broadway",
    city: "New York",
    state: "NY",
    phone: "(555) 987-6543",
    email: "midtown@example.com",
    businessHours: {
      mon: { open: "8:00 AM", close: "10:00 PM" },
    },
    status: "active" as const,
  },
];

describe("LocationList", () => {
  describe("basic rendering", () => {
    it("should render all locations", () => {
      render(<LocationList locations={mockLocations} currentMerchantId="" />);

      expect(screen.getByText("Downtown Location")).toBeInTheDocument();
      expect(screen.getByText("Midtown Location")).toBeInTheDocument();
    });

    it("should show empty message when no locations", () => {
      render(<LocationList locations={[]} currentMerchantId="" />);

      expect(screen.getByText("No locations found.")).toBeInTheDocument();
    });

    it("should render location cards with View Menu and Catering links", () => {
      render(<LocationList locations={mockLocations} currentMerchantId="" />);

      // Each location card has 2 links (View Menu and Catering)
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(4);

      // Check View Menu links
      const viewMenuLinks = screen.getAllByRole("link", { name: /View Menu/i });
      expect(viewMenuLinks).toHaveLength(2);

      // Check Catering links
      const cateringLinks = screen.getAllByRole("link", { name: /Catering/i });
      expect(cateringLinks).toHaveLength(2);
    });
  });

  describe("addItem prop passing", () => {
    it("should pass addItem to all LocationCards when provided", () => {
      render(
        <LocationList
          locations={mockLocations}
          currentMerchantId=""
          addItem="item-pizza-123"
        />
      );

      const viewMenuLinks = screen.getAllByRole("link", { name: /View Menu/i });
      expect(viewMenuLinks[0]).toHaveAttribute("href", "/r/downtown/menu?addItem=item-pizza-123");
      expect(viewMenuLinks[1]).toHaveAttribute("href", "/r/midtown/menu?addItem=item-pizza-123");
    });

    it("should not include addItem param when not provided", () => {
      render(<LocationList locations={mockLocations} currentMerchantId="" />);

      const viewMenuLinks = screen.getAllByRole("link", { name: /View Menu/i });
      expect(viewMenuLinks[0]).toHaveAttribute("href", "/r/downtown/menu");
      expect(viewMenuLinks[1]).toHaveAttribute("href", "/r/midtown/menu");
    });

    it("should not include addItem param when undefined", () => {
      render(
        <LocationList
          locations={mockLocations}
          currentMerchantId=""
          addItem={undefined}
        />
      );

      const viewMenuLinks = screen.getAllByRole("link", { name: /View Menu/i });
      expect(viewMenuLinks[0]).toHaveAttribute("href", "/r/downtown/menu");
      expect(viewMenuLinks[1]).toHaveAttribute("href", "/r/midtown/menu");
    });
  });

  describe("currentMerchantId", () => {
    it("should mark current location with Current badge", () => {
      render(
        <LocationList
          locations={mockLocations}
          currentMerchantId="merchant-downtown"
        />
      );

      expect(screen.getByText("Current")).toBeInTheDocument();
      // Only one Current badge should be shown
      expect(screen.getAllByText("Current")).toHaveLength(1);
    });

    it("should not show Current badge when no currentMerchantId matches", () => {
      render(
        <LocationList
          locations={mockLocations}
          currentMerchantId="non-existent"
        />
      );

      expect(screen.queryByText("Current")).not.toBeInTheDocument();
    });
  });
});
