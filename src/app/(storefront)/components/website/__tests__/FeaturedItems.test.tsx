import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeaturedItems } from "../FeaturedItems";
import { MerchantProvider } from "@/contexts";
import type { FeaturedItem } from "@/types/website";
import type { ReactNode } from "react";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock cart store
const mockSetTenantId = vi.fn();
const mockAddItem = vi.fn();
vi.mock("@/stores", () => ({
  useCartStore: (selector: (state: unknown) => unknown) => {
    const state = {
      setTenantId: mockSetTenantId,
      addItem: mockAddItem,
    };
    return selector(state);
  },
}));

function createWrapper(currency: string, locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider config={{ name: "Test Restaurant", logoUrl: null, currency, locale }}>
        {children}
      </MerchantProvider>
    );
  };
}

const mockItems: FeaturedItem[] = [
  {
    id: "1",
    name: "Classic Cheese Pizza",
    description: "Our signature pizza with fresh mozzarella",
    price: 18.99,
    image: "https://example.com/pizza.jpg",
    category: "Pizza",
  },
  {
    id: "2",
    name: "Pepperoni Pizza",
    description: "Classic pepperoni with premium mozzarella",
    price: 21.99,
    image: "https://example.com/pepperoni.jpg",
    category: "Pizza",
  },
];

describe("FeaturedItems", () => {
  describe("currency formatting", () => {
    it("should display prices in USD format", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("$18.99")).toBeInTheDocument();
      expect(screen.getByText("$21.99")).toBeInTheDocument();
    });

    it("should display prices in EUR format with de-DE locale", () => {
      const euroItems: FeaturedItem[] = [
        { ...mockItems[0], price: 100 },
        { ...mockItems[1], price: 200 },
      ];

      render(<FeaturedItems items={euroItems} />, {
        wrapper: createWrapper("EUR", "de-DE"),
      });

      // German format: comma as decimal separator, € after number
      expect(screen.getByText(/100,00.*€/)).toBeInTheDocument();
      expect(screen.getByText(/200,00.*€/)).toBeInTheDocument();
    });

    it("should display prices in CNY format", () => {
      const cnyItems: FeaturedItem[] = [
        { ...mockItems[0], price: 50 },
        { ...mockItems[1], price: 75 },
      ];

      render(<FeaturedItems items={cnyItems} />, {
        wrapper: createWrapper("CNY", "zh-CN"),
      });

      expect(screen.getByText(/¥50\.00/)).toBeInTheDocument();
      expect(screen.getByText(/¥75\.00/)).toBeInTheDocument();
    });

    it("should display prices in GBP format", () => {
      const gbpItems: FeaturedItem[] = [
        { ...mockItems[0], price: 15 },
        { ...mockItems[1], price: 20 },
      ];

      render(<FeaturedItems items={gbpItems} />, {
        wrapper: createWrapper("GBP", "en-GB"),
      });

      expect(screen.getByText("£15.00")).toBeInTheDocument();
      expect(screen.getByText("£20.00")).toBeInTheDocument();
    });

    it("should display prices in JPY format without decimals", () => {
      const jpyItems: FeaturedItem[] = [
        { ...mockItems[0], price: 1500 },
        { ...mockItems[1], price: 2000 },
      ];

      render(<FeaturedItems items={jpyItems} />, {
        wrapper: createWrapper("JPY", "ja-JP"),
      });

      expect(screen.getByText(/￥1,500/)).toBeInTheDocument();
      expect(screen.getByText(/￥2,000/)).toBeInTheDocument();
    });
  });

  describe("image rendering", () => {
    it("should render images with correct src URLs", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      const images = screen.getAllByRole("img");
      expect(images[0]).toHaveAttribute("src", "https://example.com/pizza.jpg");
      expect(images[1]).toHaveAttribute("src", "https://example.com/pepperoni.jpg");
    });

    it("should render images with correct alt text from item names", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByAltText("Classic Cheese Pizza")).toBeInTheDocument();
      expect(screen.getByAltText("Pepperoni Pizza")).toBeInTheDocument();
    });

    it("should render images from database with Unsplash URLs", () => {
      const itemsFromDatabase: FeaturedItem[] = [
        {
          id: "item-cheese-pizza",
          name: "Classic Cheese Pizza",
          description: "Fresh mozzarella and tomato sauce",
          price: 18.99,
          image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
          menuItemId: "item-cheese-pizza",
          hasModifiers: true,
        },
        {
          id: "item-garlic-knots",
          name: "Garlic Knots",
          description: "Fresh baked knots with garlic butter",
          price: 5.99,
          image: "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop",
          menuItemId: "item-garlic-knots",
          hasModifiers: false,
        },
      ];

      render(<FeaturedItems items={itemsFromDatabase} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      const cheeseImg = screen.getByAltText("Classic Cheese Pizza");
      expect(cheeseImg).toHaveAttribute(
        "src",
        "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"
      );

      const garlicImg = screen.getByAltText("Garlic Knots");
      expect(garlicImg).toHaveAttribute(
        "src",
        "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop"
      );
    });

    it("should handle empty image URL gracefully", () => {
      const itemsWithEmptyImage: FeaturedItem[] = [
        {
          id: "1",
          name: "Item Without Image",
          description: "No image available",
          price: 10.99,
          image: "",
        },
      ];

      render(<FeaturedItems items={itemsWithEmptyImage} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      // Should display placeholder icon instead of img element
      expect(screen.queryByAltText("Item Without Image")).not.toBeInTheDocument();
      // The item card should still render with name and price
      expect(screen.getByText("Item Without Image")).toBeInTheDocument();
      expect(screen.getByText("$10.99")).toBeInTheDocument();
    });
  });

  describe("item display", () => {
    it("should display item names", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Classic Cheese Pizza")).toBeInTheDocument();
      expect(screen.getByText("Pepperoni Pizza")).toBeInTheDocument();
    });

    it("should display item descriptions", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(
        screen.getByText("Our signature pizza with fresh mozzarella")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Classic pepperoni with premium mozzarella")
      ).toBeInTheDocument();
    });

    it("should display item categories", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      // Both items have "Pizza" category
      const categories = screen.getAllByText("Pizza");
      expect(categories).toHaveLength(2);
    });

    it("should display Add buttons for single location (default)", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      const addButtons = screen.getAllByText("Add");
      expect(addButtons).toHaveLength(2);
    });

    it("should display Order buttons for multiple locations", () => {
      render(
        <FeaturedItems
          items={mockItems}
          menuLink="/joes-pizza/locations"
          hasMultipleLocations={true}
        />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const orderButtons = screen.getAllByText("Order");
      expect(orderButtons).toHaveLength(2);
      expect(screen.queryByText("Add")).not.toBeInTheDocument();
    });

    it("should display section header", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Featured Items")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Discover our most popular dishes, crafted with the finest ingredients"
        )
      ).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    beforeEach(() => {
      mockPush.mockClear();
      mockSetTenantId.mockClear();
      mockAddItem.mockClear();
    });

    it("should show 'View Full Menu' link for single location", () => {
      render(
        <FeaturedItems items={mockItems} menuLink="/r/downtown/menu" />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const link = screen.getByText("View Full Menu");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "/r/downtown/menu");
    });

    it("should show 'Find a Location' link for multiple locations", () => {
      render(
        <FeaturedItems
          items={mockItems}
          menuLink="/joes-pizza/locations"
          hasMultipleLocations={true}
        />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const link = screen.getByText("Find a Location");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "/joes-pizza/locations");
    });

    it("should navigate to menu page when clicking Add button (single location)", () => {
      render(
        <FeaturedItems items={mockItems} menuLink="/r/downtown/menu" />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[0]);

      expect(mockPush).toHaveBeenCalledWith("/r/downtown/menu");
    });

    it("should navigate to locations page when clicking Order button (multiple locations)", () => {
      render(
        <FeaturedItems
          items={mockItems}
          menuLink="/joes-pizza/locations"
          hasMultipleLocations={true}
        />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const orderButtons = screen.getAllByText("Order");
      fireEvent.click(orderButtons[0]);

      expect(mockPush).toHaveBeenCalledWith("/joes-pizza/locations");
    });

    it("should navigate to locations page with addItem param when item has menuItemId (multiple locations)", () => {
      const itemsWithMenuId: FeaturedItem[] = [
        {
          id: "1",
          name: "Classic Pizza",
          description: "Fresh pizza",
          price: 18.99,
          image: "https://example.com/pizza.jpg",
          menuItemId: "item-pizza",
          hasModifiers: true,
        },
      ];

      render(
        <FeaturedItems
          items={itemsWithMenuId}
          menuLink="/joes-pizza/locations"
          hasMultipleLocations={true}
        />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const orderButtons = screen.getAllByText("Order");
      fireEvent.click(orderButtons[0]);

      expect(mockPush).toHaveBeenCalledWith("/joes-pizza/locations?addItem=item-pizza");
    });

    it("should navigate to locations page without addItem param when item has no menuItemId (multiple locations)", () => {
      render(
        <FeaturedItems
          items={mockItems} // Items without menuItemId
          menuLink="/joes-pizza/locations"
          hasMultipleLocations={true}
        />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const orderButtons = screen.getAllByText("Order");
      fireEvent.click(orderButtons[0]);

      expect(mockPush).toHaveBeenCalledWith("/joes-pizza/locations");
    });
  });

  describe("cart functionality (single location)", () => {
    const itemsWithMenuId: FeaturedItem[] = [
      {
        id: "1",
        name: "Sourdough Loaf",
        description: "Fresh baked sourdough",
        price: 8.99,
        image: "https://example.com/sourdough.jpg",
        category: "Bread",
        menuItemId: "item-sourdough",
        hasModifiers: false,
      },
      {
        id: "2",
        name: "Cappuccino",
        description: "Rich espresso with milk",
        price: 4.99,
        image: "https://example.com/cappuccino.jpg",
        category: "Coffee",
        menuItemId: "item-cappuccino",
        hasModifiers: true,
      },
    ];

    beforeEach(() => {
      mockPush.mockClear();
      mockSetTenantId.mockClear();
      mockAddItem.mockClear();
    });

    it("should add item to cart and navigate when item has no modifiers", () => {
      render(
        <FeaturedItems
          items={itemsWithMenuId}
          menuLink="/r/bakery/menu"
          merchantSlug="bakery"
        />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[0]); // Click Sourdough (no modifiers)

      expect(mockSetTenantId).toHaveBeenCalledWith("bakery");
      expect(mockAddItem).toHaveBeenCalledWith({
        menuItemId: "item-sourdough",
        name: "Sourdough Loaf",
        price: 8.99,
        quantity: 1,
        selectedModifiers: [],
        imageUrl: "https://example.com/sourdough.jpg",
      });
      expect(mockPush).toHaveBeenCalledWith("/r/bakery/menu");
    });

    it("should navigate with query param when item has modifiers", () => {
      render(
        <FeaturedItems
          items={itemsWithMenuId}
          menuLink="/r/bakery/menu"
          merchantSlug="bakery"
        />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[1]); // Click Cappuccino (has modifiers)

      expect(mockSetTenantId).toHaveBeenCalledWith("bakery");
      expect(mockAddItem).not.toHaveBeenCalled(); // Should not add directly
      expect(mockPush).toHaveBeenCalledWith("/r/bakery/menu?addItem=item-cappuccino");
    });

    it("should just navigate when item has no menuItemId", () => {
      render(
        <FeaturedItems
          items={mockItems} // Items without menuItemId
          menuLink="/r/bakery/menu"
          merchantSlug="bakery"
        />,
        {
          wrapper: createWrapper("USD", "en-US"),
        }
      );

      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[0]);

      expect(mockAddItem).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/r/bakery/menu");
    });
  });
});
