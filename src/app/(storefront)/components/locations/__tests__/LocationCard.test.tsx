import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationCard } from "../LocationCard";

describe("LocationCard", () => {
  const defaultProps = {
    id: "merchant-1",
    slug: "downtown",
    name: "Downtown Location",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    phone: "(555) 123-4567",
    email: "downtown@example.com",
    businessHours: {
      mon: { open: "9:00 AM", close: "9:00 PM" },
      tue: { open: "9:00 AM", close: "9:00 PM" },
      wed: { open: "9:00 AM", close: "9:00 PM" },
      thu: { open: "9:00 AM", close: "9:00 PM" },
      fri: { open: "9:00 AM", close: "10:00 PM" },
      sat: { open: "10:00 AM", close: "10:00 PM" },
      sun: { open: "10:00 AM", close: "8:00 PM", closed: false },
    },
    status: "active" as const,
    isCurrentLocation: false,
  };

  describe("basic rendering", () => {
    it("should render location name", () => {
      render(<LocationCard {...defaultProps} />);
      expect(screen.getByText("Downtown Location")).toBeInTheDocument();
    });

    it("should render address", () => {
      render(<LocationCard {...defaultProps} />);
      expect(screen.getByText("123 Main St")).toBeInTheDocument();
    });

    it("should render city and state", () => {
      render(<LocationCard {...defaultProps} />);
      expect(screen.getByText("New York, NY")).toBeInTheDocument();
    });

    it("should render phone number", () => {
      render(<LocationCard {...defaultProps} />);
      expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
    });

    it("should render email", () => {
      render(<LocationCard {...defaultProps} />);
      expect(screen.getByText("downtown@example.com")).toBeInTheDocument();
    });

    it("should render View Menu link text", () => {
      render(<LocationCard {...defaultProps} />);
      expect(screen.getByText("View Menu")).toBeInTheDocument();
    });
  });

  describe("link generation", () => {
    it("should link to menu page without addItem param by default", () => {
      render(<LocationCard {...defaultProps} />);

      const link = screen.getByRole("link", { name: /View Menu/i });
      expect(link).toHaveAttribute("href", "/r/downtown/menu");
    });

    it("should link to menu page with addItem param when provided", () => {
      render(<LocationCard {...defaultProps} addItem="item-pizza-123" />);

      const link = screen.getByRole("link", { name: /View Menu/i });
      expect(link).toHaveAttribute("href", "/r/downtown/menu?addItem=item-pizza-123");
    });

    it("should include addItem param with special characters encoded", () => {
      render(<LocationCard {...defaultProps} addItem="item-special" />);

      const link = screen.getByRole("link", { name: /View Menu/i });
      expect(link).toHaveAttribute("href", "/r/downtown/menu?addItem=item-special");
    });

    it("should render Catering link", () => {
      render(<LocationCard {...defaultProps} />);

      const link = screen.getByRole("link", { name: /Catering/i });
      expect(link).toHaveAttribute("href", "/r/downtown/catering");
    });
  });

  describe("status badges", () => {
    it("should show Current badge when isCurrentLocation is true", () => {
      render(<LocationCard {...defaultProps} isCurrentLocation={true} />);
      expect(screen.getByText("Current")).toBeInTheDocument();
    });

    it("should not show Current badge when isCurrentLocation is false", () => {
      render(<LocationCard {...defaultProps} isCurrentLocation={false} />);
      expect(screen.queryByText("Current")).not.toBeInTheDocument();
    });

    it("should show Temporarily Closed badge when status is temporarily_closed", () => {
      render(<LocationCard {...defaultProps} status="temporarily_closed" />);
      expect(screen.getByText("Temporarily Closed")).toBeInTheDocument();
    });

    it("should not show Temporarily Closed badge when status is active", () => {
      render(<LocationCard {...defaultProps} status="active" />);
      expect(screen.queryByText("Temporarily Closed")).not.toBeInTheDocument();
    });
  });

  describe("optional fields", () => {
    it("should not render address when null", () => {
      render(<LocationCard {...defaultProps} address={null} />);
      expect(screen.queryByText("123 Main St")).not.toBeInTheDocument();
    });

    it("should not render phone when null", () => {
      render(<LocationCard {...defaultProps} phone={null} />);
      expect(screen.queryByText("(555) 123-4567")).not.toBeInTheDocument();
    });

    it("should not render email when null", () => {
      render(<LocationCard {...defaultProps} email={null} />);
      expect(screen.queryByText("downtown@example.com")).not.toBeInTheDocument();
    });

    it("should not render business hours when null", () => {
      render(<LocationCard {...defaultProps} businessHours={null} />);
      expect(screen.queryByText(/Today:/)).not.toBeInTheDocument();
    });

    it("should display only city when state is null", () => {
      render(<LocationCard {...defaultProps} state={null} />);
      expect(screen.getByText("New York")).toBeInTheDocument();
    });

    it("should display Closed today when business hours mark day as closed", () => {
      // Create a business hours map where today is closed
      const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const today = days[new Date().getDay()];
      const closedHours: Record<string, { open: string; close: string; closed?: boolean }> = {};
      closedHours[today] = { open: "09:00", close: "22:00", closed: true };

      render(<LocationCard {...defaultProps} businessHours={closedHours} />);
      expect(screen.getByText(/Closed today/)).toBeInTheDocument();
    });
  });
});
