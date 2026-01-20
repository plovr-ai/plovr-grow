import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuCategoryNav } from "../MenuCategoryNav";
import type { MenuCategoryViewModel } from "@/types/menu-page";

const mockCategories: MenuCategoryViewModel[] = [
  {
    id: "featured",
    name: "Featured",
    description: "Our most popular dishes",
    itemCount: 4,
  },
  {
    id: "cat-pizza",
    name: "Pizza",
    description: "Our handcrafted pizzas",
    itemCount: 4,
  },
  {
    id: "cat-pasta",
    name: "Pasta",
    description: "Homemade pasta dishes",
    itemCount: 3,
  },
  {
    id: "cat-sides",
    name: "Sides",
    description: "Perfect additions",
    itemCount: 3,
  },
];

describe("MenuCategoryNav", () => {
  describe("rendering", () => {
    it("should render all categories", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory={null}
          onCategoryClick={onCategoryClick}
        />
      );

      expect(screen.getByText("Featured")).toBeInTheDocument();
      expect(screen.getByText("Pizza")).toBeInTheDocument();
      expect(screen.getByText("Pasta")).toBeInTheDocument();
      expect(screen.getByText("Sides")).toBeInTheDocument();
    });

    it("should render Featured as first category", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory={null}
          onCategoryClick={onCategoryClick}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons[0]).toHaveTextContent("Featured");
    });

    it("should display item count for each category", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory={null}
          onCategoryClick={onCategoryClick}
        />
      );

      // Featured and Pizza both have 4 items
      expect(screen.getAllByText("(4)")).toHaveLength(2);
      // Pasta and Sides both have 3 items
      expect(screen.getAllByText("(3)")).toHaveLength(2);
    });
  });

  describe("active state", () => {
    it("should highlight active category with theme primary background", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory="featured"
          onCategoryClick={onCategoryClick}
        />
      );

      const featuredButton = screen.getByRole("button", { name: /Featured/i });
      expect(featuredButton).toHaveClass("bg-theme-primary", "text-theme-primary-foreground");
    });

    it("should show inactive categories with gray background", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory="featured"
          onCategoryClick={onCategoryClick}
        />
      );

      const pizzaButton = screen.getByRole("button", { name: /Pizza/i });
      expect(pizzaButton).toHaveClass("bg-gray-100", "text-gray-700");
    });

    it("should update active state when activeCategory changes", () => {
      const onCategoryClick = vi.fn();

      const { rerender } = render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory="featured"
          onCategoryClick={onCategoryClick}
        />
      );

      const featuredButton = screen.getByRole("button", { name: /Featured/i });
      expect(featuredButton).toHaveClass("bg-theme-primary");

      rerender(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory="cat-pizza"
          onCategoryClick={onCategoryClick}
        />
      );

      const pizzaButton = screen.getByRole("button", { name: /Pizza/i });
      expect(pizzaButton).toHaveClass("bg-theme-primary");
      expect(featuredButton).toHaveClass("bg-gray-100");
    });
  });

  describe("click handling", () => {
    it("should call onCategoryClick with category id when clicked", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory={null}
          onCategoryClick={onCategoryClick}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Featured/i }));
      expect(onCategoryClick).toHaveBeenCalledWith("featured");

      fireEvent.click(screen.getByRole("button", { name: /Pizza/i }));
      expect(onCategoryClick).toHaveBeenCalledWith("cat-pizza");
    });

    it("should call onCategoryClick for each category", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory={null}
          onCategoryClick={onCategoryClick}
        />
      );

      mockCategories.forEach((category) => {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(category.name) }));
      });

      expect(onCategoryClick).toHaveBeenCalledTimes(4);
    });
  });

  describe("empty state", () => {
    it("should render nothing when categories array is empty", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={[]}
          activeCategory={null}
          onCategoryClick={onCategoryClick}
        />
      );

      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
  });

  describe("layout prop", () => {
    describe("horizontal layout (default)", () => {
      it("should render horizontal layout by default", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
          />
        );

        const nav = screen.getByRole("navigation");
        expect(nav).toHaveClass("sticky", "top-16", "z-40");
      });

      it("should render horizontal layout when layout prop is horizontal", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
            layout="horizontal"
          />
        );

        const nav = screen.getByRole("navigation");
        expect(nav).toHaveClass("sticky", "top-16");
      });

      it("should use rounded-full style for horizontal buttons", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
            layout="horizontal"
          />
        );

        const button = screen.getByRole("button", { name: /Featured/i });
        expect(button).toHaveClass("rounded-full");
      });

      it("should display item count in parentheses format for horizontal", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
            layout="horizontal"
          />
        );

        expect(screen.getAllByText("(4)")).toHaveLength(2);
      });
    });

    describe("vertical layout", () => {
      it("should render vertical layout when layout prop is vertical", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
            layout="vertical"
          />
        );

        const nav = screen.getByRole("navigation");
        expect(nav).toHaveClass("flex", "flex-col");
      });

      it("should use rounded-lg style for vertical buttons", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
            layout="vertical"
          />
        );

        const button = screen.getByRole("button", { name: /Featured/i });
        expect(button).toHaveClass("rounded-lg", "w-full", "text-left");
      });

      it("should display item count with 'items' suffix for vertical", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
            layout="vertical"
          />
        );

        expect(screen.getAllByText("4 items")).toHaveLength(2);
        expect(screen.getAllByText("3 items")).toHaveLength(2);
      });

      it("should highlight active category with light background and left border in vertical layout", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory="featured"
            onCategoryClick={onCategoryClick}
            layout="vertical"
          />
        );

        const featuredButton = screen.getByRole("button", { name: /Featured/i });
        expect(featuredButton).toHaveClass(
          "bg-theme-primary-light",
          "text-theme-primary-hover",
          "border-l-4",
          "border-theme-primary"
        );
      });

      it("should show inactive categories without border in vertical layout", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory="featured"
            onCategoryClick={onCategoryClick}
            layout="vertical"
          />
        );

        const pizzaButton = screen.getByRole("button", { name: /Pizza/i });
        expect(pizzaButton).toHaveClass("text-gray-700");
        expect(pizzaButton).not.toHaveClass("border-l-4");
      });

      it("should call onCategoryClick when vertical button is clicked", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
            layout="vertical"
          />
        );

        fireEvent.click(screen.getByRole("button", { name: /Pizza/i }));
        expect(onCategoryClick).toHaveBeenCalledWith("cat-pizza");
      });

      it("should have max-height constraint for scrolling in vertical layout", () => {
        const onCategoryClick = vi.fn();

        render(
          <MenuCategoryNav
            categories={mockCategories}
            activeCategory={null}
            onCategoryClick={onCategoryClick}
            layout="vertical"
          />
        );

        const nav = screen.getByRole("navigation");
        expect(nav).toHaveClass("max-h-[calc(100vh-160px)]", "overflow-y-auto");
      });
    });
  });
});
