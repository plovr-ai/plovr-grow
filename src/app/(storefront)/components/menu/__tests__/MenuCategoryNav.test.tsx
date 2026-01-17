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
    it("should highlight active category with red background", () => {
      const onCategoryClick = vi.fn();

      render(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory="featured"
          onCategoryClick={onCategoryClick}
        />
      );

      const featuredButton = screen.getByRole("button", { name: /Featured/i });
      expect(featuredButton).toHaveClass("bg-red-600", "text-white");
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
      expect(featuredButton).toHaveClass("bg-red-600");

      rerender(
        <MenuCategoryNav
          categories={mockCategories}
          activeCategory="cat-pizza"
          onCategoryClick={onCategoryClick}
        />
      );

      const pizzaButton = screen.getByRole("button", { name: /Pizza/i });
      expect(pizzaButton).toHaveClass("bg-red-600");
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
});
