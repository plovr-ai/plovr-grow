import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { MenuItemRow, type MenuItemRowData } from "../MenuItemRow";

// Helper wrapper with DashboardContext
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider
      value={{
        tenantId: "tenant-1",
        companyId: "company-1",
        company: {
          id: "company-1",
          name: "Test Company",
          slug: "test-company",
          logoUrl: null,
        },
        merchants: [],
        currency: "USD",
        locale: "en-US",
      }}
    >
      {children}
    </DashboardProvider>
  );
}

const mockItem: MenuItemRowData = {
  id: "item-1",
  name: "Classic Burger",
  imageUrl: "https://example.com/burger.jpg",
  price: 12.99,
};

describe("MenuItemRow", () => {
  describe("Basic Rendering", () => {
    it("should render item name", () => {
      render(<MenuItemRow item={mockItem} />, { wrapper: Wrapper });
      expect(screen.getByText("Classic Burger")).toBeInTheDocument();
    });

    it("should render formatted price", () => {
      render(<MenuItemRow item={mockItem} />, { wrapper: Wrapper });
      expect(screen.getByText("$12.99")).toBeInTheDocument();
    });

    it("should render image when imageUrl provided", () => {
      const { container } = render(<MenuItemRow item={mockItem} />, {
        wrapper: Wrapper,
      });
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src", "https://example.com/burger.jpg");
      expect(img).toHaveAttribute("alt", "Classic Burger");
    });

    it("should render icon placeholder when no imageUrl (sm size)", () => {
      const itemWithoutImage = { ...mockItem, imageUrl: null };
      render(<MenuItemRow item={itemWithoutImage} imageSize="sm" />, {
        wrapper: Wrapper,
      });
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render text placeholder when no imageUrl (md size)", () => {
      const itemWithoutImage = { ...mockItem, imageUrl: null };
      render(<MenuItemRow item={itemWithoutImage} imageSize="md" />, {
        wrapper: Wrapper,
      });
      expect(screen.getByText("No img")).toBeInTheDocument();
    });

    it("should render subtitle when provided", () => {
      render(<MenuItemRow item={mockItem} subtitle="Appetizers · $12.99" />, {
        wrapper: Wrapper,
      });
      expect(screen.getByText("Appetizers · $12.99")).toBeInTheDocument();
    });

    it("should render metadata when provided", () => {
      render(
        <MenuItemRow
          item={mockItem}
          metadata={<p data-testid="metadata">In: Category 1, Category 2</p>}
        />,
        { wrapper: Wrapper }
      );
      expect(screen.getByTestId("metadata")).toBeInTheDocument();
      expect(screen.getByText("In: Category 1, Category 2")).toBeInTheDocument();
    });
  });

  describe("Slots", () => {
    it("should render leftSlot content", () => {
      render(
        <MenuItemRow
          item={mockItem}
          leftSlot={<div data-testid="left-slot">Checkbox</div>}
        />,
        { wrapper: Wrapper }
      );
      expect(screen.getByTestId("left-slot")).toBeInTheDocument();
    });

    it("should render rightSlot content", () => {
      render(
        <MenuItemRow
          item={mockItem}
          rightSlot={<button data-testid="right-slot">Add</button>}
        />,
        { wrapper: Wrapper }
      );
      expect(screen.getByTestId("right-slot")).toBeInTheDocument();
    });

    it("should render both slots simultaneously", () => {
      render(
        <MenuItemRow
          item={mockItem}
          leftSlot={<div data-testid="left-slot">Left</div>}
          rightSlot={<div data-testid="right-slot">Right</div>}
        />,
        { wrapper: Wrapper }
      );
      expect(screen.getByTestId("left-slot")).toBeInTheDocument();
      expect(screen.getByTestId("right-slot")).toBeInTheDocument();
    });

    it("should not render price when rightSlot is provided", () => {
      render(
        <MenuItemRow
          item={mockItem}
          rightSlot={<button data-testid="right-slot">Add</button>}
        />,
        { wrapper: Wrapper }
      );
      expect(screen.queryByText("$12.99")).not.toBeInTheDocument();
    });
  });

  describe("Image Sizes", () => {
    it("should apply small size classes (h-10 w-10)", () => {
      const { container } = render(
        <MenuItemRow item={mockItem} imageSize="sm" />,
        { wrapper: Wrapper }
      );
      const imageContainer = container.querySelector(".h-10");
      expect(imageContainer).toBeInTheDocument();
      expect(imageContainer).toHaveClass("w-10");
    });

    it("should apply medium size classes (h-12 w-12)", () => {
      const { container } = render(
        <MenuItemRow item={mockItem} imageSize="md" />,
        { wrapper: Wrapper }
      );
      const imageContainer = container.querySelector(".h-12");
      expect(imageContainer).toBeInTheDocument();
      expect(imageContainer).toHaveClass("w-12");
    });

    it("should use medium size by default", () => {
      const { container } = render(<MenuItemRow item={mockItem} />, {
        wrapper: Wrapper,
      });
      const imageContainer = container.querySelector(".h-12");
      expect(imageContainer).toBeInTheDocument();
    });
  });

  describe("States", () => {
    it("should apply highlighted styling when isHighlighted=true", () => {
      const { container } = render(
        <MenuItemRow item={mockItem} isHighlighted={true} />,
        { wrapper: Wrapper }
      );
      const element = container.firstChild as HTMLElement;
      expect(element).toHaveClass("border-theme-primary");
      expect(element).toHaveClass("bg-theme-primary-light");
    });

    it("should not apply highlighted styling when isHighlighted=false", () => {
      const { container } = render(
        <MenuItemRow item={mockItem} isHighlighted={false} />,
        { wrapper: Wrapper }
      );
      const element = container.firstChild as HTMLElement;
      expect(element).not.toHaveClass("border-theme-primary");
      expect(element).not.toHaveClass("bg-theme-primary-light");
    });

    it("should call onClick when clicked", () => {
      const handleClick = vi.fn();
      render(<MenuItemRow item={mockItem} onClick={handleClick} />, {
        wrapper: Wrapper,
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should not call onClick when disabled", () => {
      const handleClick = vi.fn();
      render(
        <MenuItemRow item={mockItem} onClick={handleClick} disabled={true} />,
        { wrapper: Wrapper }
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it("should apply disabled styling when disabled=true", () => {
      const { container } = render(
        <MenuItemRow item={mockItem} onClick={() => {}} disabled={true} />,
        { wrapper: Wrapper }
      );
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveClass("cursor-not-allowed");
      expect(button).toHaveClass("opacity-50");
    });

    it("should render as div when no onClick provided", () => {
      const { container } = render(<MenuItemRow item={mockItem} />, {
        wrapper: Wrapper,
      });
      const element = container.firstChild as HTMLElement;
      expect(element.tagName).toBe("DIV");
    });

    it("should render as button when onClick provided", () => {
      render(<MenuItemRow item={mockItem} onClick={() => {}} />, {
        wrapper: Wrapper,
      });
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Custom Styling", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <MenuItemRow item={mockItem} className="custom-class" />,
        { wrapper: Wrapper }
      );
      const element = container.firstChild as HTMLElement;
      expect(element).toHaveClass("custom-class");
    });

    it("should merge custom className with default classes", () => {
      const { container } = render(
        <MenuItemRow item={mockItem} className="shadow-lg" />,
        { wrapper: Wrapper }
      );
      const element = container.firstChild as HTMLElement;
      expect(element).toHaveClass("shadow-lg");
      expect(element).toHaveClass("flex");
    });
  });
});
