import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuCategorySection } from "../MenuCategorySection";
import { MerchantProvider } from "@/contexts";
import type { MenuCategoryWithItemsViewModel } from "@/types/menu-page";
import type { ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MerchantProvider config={{ name: "Test Restaurant", logoUrl: null, currency: "USD", locale: "en-US", timezone: "America/New_York" }}>
      {children}
    </MerchantProvider>
  );
}

const mockFeaturedCategory: MenuCategoryWithItemsViewModel = {
  category: {
    id: "featured",
    name: "Featured",
    description: "Our most popular dishes",
    itemCount: 4,
  },
  items: [
    {
      id: "item-1",
      name: "Classic Cheese Pizza",
      description: "Our signature pizza with fresh mozzarella",
      price: 18.99,
      imageUrl: "https://example.com/pizza.jpg",
      tags: ["popular"],
      hasModifiers: true,
      modifierGroups: [],
      isAvailable: true,
      taxes: [],
    },
    {
      id: "item-2",
      name: "Pepperoni Pizza",
      description: "Classic pepperoni with premium mozzarella",
      price: 21.99,
      imageUrl: "https://example.com/pepperoni.jpg",
      tags: ["popular"],
      hasModifiers: true,
      modifierGroups: [],
      isAvailable: true,
      taxes: [],
    },
  ],
};

const mockPizzaCategory: MenuCategoryWithItemsViewModel = {
  category: {
    id: "cat-pizza",
    name: "Pizza",
    description: "Our handcrafted New York style pizzas",
    itemCount: 4,
  },
  items: [
    {
      id: "item-1",
      name: "Classic Cheese Pizza",
      description: "Our signature pizza with fresh mozzarella",
      price: 18.99,
      imageUrl: "https://example.com/pizza.jpg",
      tags: ["popular"],
      hasModifiers: true,
      modifierGroups: [],
      isAvailable: true,
      taxes: [],
    },
  ],
};

describe("MenuCategorySection", () => {
  describe("rendering", () => {
    it("should render category name", () => {
      const onAddItem = vi.fn();

      render(<MenuCategorySection data={mockFeaturedCategory} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText("Featured")).toBeInTheDocument();
    });

    it("should render category description", () => {
      const onAddItem = vi.fn();

      render(<MenuCategorySection data={mockFeaturedCategory} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText("Our most popular dishes")).toBeInTheDocument();
    });

    it("should render all items in category", () => {
      const onAddItem = vi.fn();

      render(<MenuCategorySection data={mockFeaturedCategory} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText("Classic Cheese Pizza")).toBeInTheDocument();
      expect(screen.getByText("Pepperoni Pizza")).toBeInTheDocument();
    });

    it("should render section with correct id for scrolling", () => {
      const onAddItem = vi.fn();

      const { container } = render(
        <MenuCategorySection data={mockFeaturedCategory} onAddItem={onAddItem} />,
        { wrapper: Wrapper }
      );

      const section = container.querySelector("section");
      expect(section).toHaveAttribute("id", "category-featured");
    });
  });

  describe("Featured category", () => {
    it("should render Featured category correctly", () => {
      const onAddItem = vi.fn();

      render(<MenuCategorySection data={mockFeaturedCategory} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByRole("heading", { name: "Featured" })).toBeInTheDocument();
      expect(screen.getByText("Our most popular dishes")).toBeInTheDocument();
    });

    it("should have correct section id for Featured", () => {
      const onAddItem = vi.fn();

      const { container } = render(
        <MenuCategorySection data={mockFeaturedCategory} onAddItem={onAddItem} />,
        { wrapper: Wrapper }
      );

      const section = container.querySelector("#category-featured");
      expect(section).toBeInTheDocument();
    });
  });

  describe("regular category", () => {
    it("should render regular category correctly", () => {
      const onAddItem = vi.fn();

      render(<MenuCategorySection data={mockPizzaCategory} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByRole("heading", { name: "Pizza" })).toBeInTheDocument();
      expect(screen.getByText("Our handcrafted New York style pizzas")).toBeInTheDocument();
    });

    it("should have correct section id for regular category", () => {
      const onAddItem = vi.fn();

      const { container } = render(
        <MenuCategorySection data={mockPizzaCategory} onAddItem={onAddItem} />,
        { wrapper: Wrapper }
      );

      const section = container.querySelector("#category-cat-pizza");
      expect(section).toBeInTheDocument();
    });
  });

  describe("item interactions", () => {
    it("should call onAddItem when Add button is clicked", () => {
      const onAddItem = vi.fn();

      render(<MenuCategorySection data={mockFeaturedCategory} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[0]);

      expect(onAddItem).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "item-1" })
      );
    });

    it("should call onAddItem with correct item id for each item", () => {
      const onAddItem = vi.fn();

      render(<MenuCategorySection data={mockFeaturedCategory} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      const addButtons = screen.getAllByText("Add");

      fireEvent.click(addButtons[0]);
      expect(onAddItem).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "item-1" })
      );

      fireEvent.click(addButtons[1]);
      expect(onAddItem).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "item-2" })
      );
    });
  });

  describe("category without description", () => {
    it("should render category without description", () => {
      const onAddItem = vi.fn();
      const categoryWithoutDesc: MenuCategoryWithItemsViewModel = {
        category: {
          id: "cat-beverages",
          name: "Beverages",
          description: null,
          itemCount: 2,
        },
        items: [
          {
            id: "item-11",
            name: "Fountain Drink",
            description: "Coca-Cola, Sprite, or Lemonade",
            price: 2.99,
            imageUrl: null,
            tags: [],
            hasModifiers: true,
            modifierGroups: [],
            isAvailable: true,
            taxes: [],
          },
        ],
      };

      render(<MenuCategorySection data={categoryWithoutDesc} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByRole("heading", { name: "Beverages" })).toBeInTheDocument();
      expect(screen.getByText("Fountain Drink")).toBeInTheDocument();
    });
  });

  describe("empty category", () => {
    it("should render category header even with no items", () => {
      const onAddItem = vi.fn();
      const emptyCategory: MenuCategoryWithItemsViewModel = {
        category: {
          id: "cat-empty",
          name: "Empty Category",
          description: "No items here",
          itemCount: 0,
        },
        items: [],
      };

      render(<MenuCategorySection data={emptyCategory} onAddItem={onAddItem} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByRole("heading", { name: "Empty Category" })).toBeInTheDocument();
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
  });
});
