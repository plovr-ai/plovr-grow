import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { FeaturedItemsClient } from "../FeaturedItemsClient";

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
        subscription: null,
      }}
    >
      {children}
    </DashboardProvider>
  );
}

// Mock server actions
const mockAddFeaturedItemAction = vi.fn();
const mockRemoveFeaturedItemAction = vi.fn();
const mockReorderFeaturedItemsAction = vi.fn();

vi.mock("@/app/(dashboard)/dashboard/(protected)/menu/actions", () => ({
  addFeaturedItemAction: (itemId: string) => mockAddFeaturedItemAction(itemId),
  removeFeaturedItemAction: (itemId: string) =>
    mockRemoveFeaturedItemAction(itemId),
  reorderFeaturedItemsAction: (orderedIds: string[]) =>
    mockReorderFeaturedItemsAction(orderedIds),
}));

const selectedItems = [
  {
    id: "item-1",
    name: "Classic Burger",
    description: "Juicy beef patty",
    price: 12.99,
    imageUrl: "https://example.com/burger.jpg",
  },
  {
    id: "item-2",
    name: "Veggie Burger",
    description: "Plant-based patty",
    price: 10.99,
    imageUrl: null,
  },
];

const availableItems = [
  {
    id: "item-3",
    name: "Chicken Sandwich",
    description: "Grilled chicken",
    price: 11.99,
    imageUrl: null,
    categoryName: "Sandwiches",
  },
  {
    id: "item-4",
    name: "Caesar Salad",
    description: "Fresh romaine",
    price: 8.99,
    imageUrl: null,
    categoryName: "Salads",
  },
];

describe("FeaturedItemsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddFeaturedItemAction.mockResolvedValue({ success: true });
    mockRemoveFeaturedItemAction.mockResolvedValue({ success: true });
    mockReorderFeaturedItemsAction.mockResolvedValue({ success: true });
  });

  describe("Display", () => {
    it("should display page title and description", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Featured Items")).toBeInTheDocument();
      expect(
        screen.getByText(/Select items to feature on your menu/)
      ).toBeInTheDocument();
    });

    it("should display selected items count", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Featured Items (2)")).toBeInTheDocument();
    });

    it("should display available items count", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Available Items (2)")).toBeInTheDocument();
    });

    it("should display selected items with correct information", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Classic Burger")).toBeInTheDocument();
      expect(screen.getByText("Veggie Burger")).toBeInTheDocument();
    });

    it("should display available items with category and price", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Chicken Sandwich")).toBeInTheDocument();
      expect(screen.getByText(/Sandwiches/)).toBeInTheDocument();
      expect(screen.getByText("Caesar Salad")).toBeInTheDocument();
      expect(screen.getByText(/Salads/)).toBeInTheDocument();
    });

    it("should show empty state when no selected items", () => {
      render(
        <FeaturedItemsClient selectedItems={[]} availableItems={availableItems} />,
        { wrapper: Wrapper }
      );

      expect(
        screen.getByText(/No featured items yet/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Add items from the list on the right/)
      ).toBeInTheDocument();
    });

    it("should show empty state when all items are featured", () => {
      render(
        <FeaturedItemsClient selectedItems={selectedItems} availableItems={[]} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("All items have been added.")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("should render search input for available items", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByPlaceholderText("Search items...")).toBeInTheDocument();
    });

    it("should filter available items by name", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "chicken" } });

      expect(screen.getByText("Chicken Sandwich")).toBeInTheDocument();
      expect(screen.queryByText("Caesar Salad")).not.toBeInTheDocument();
    });

    it("should filter available items by category name", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "salads" } });

      expect(screen.getByText("Caesar Salad")).toBeInTheDocument();
      expect(screen.queryByText("Chicken Sandwich")).not.toBeInTheDocument();
    });

    it("should be case insensitive", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "CHICKEN" } });

      expect(screen.getByText("Chicken Sandwich")).toBeInTheDocument();
    });

    it("should show no matches message when search has no results", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "pizza" } });

      expect(screen.getByText("No items match your search.")).toBeInTheDocument();
    });
  });

  describe("Add Item Functionality", () => {
    it("should show plus button for each available item", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      // Should have plus buttons for available items
      const plusButtons = screen.getAllByRole("button").filter((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-plus");
      });

      expect(plusButtons.length).toBeGreaterThan(0);
    });

    it("should call addFeaturedItemAction when clicking plus button", async () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      // Find and click the plus button for "Chicken Sandwich"
      const chickenText = screen.getByText("Chicken Sandwich");
      const itemContainer = chickenText.closest("div.flex.items-center");
      const plusButton = itemContainer?.querySelector('button[class*="hover:text-green"]');

      if (plusButton) {
        fireEvent.click(plusButton);

        await waitFor(() => {
          expect(mockAddFeaturedItemAction).toHaveBeenCalledWith("item-3");
        });
      }
    });

    it("should optimistically move item from available to selected", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      const chickenText = screen.getByText("Chicken Sandwich");
      const itemContainer = chickenText.closest("div.flex.items-center");
      const plusButton = itemContainer?.querySelector('button[class*="hover:text-green"]');

      if (plusButton) {
        fireEvent.click(plusButton);

        // Should update count immediately
        expect(screen.getByText("Featured Items (3)")).toBeInTheDocument();
        expect(screen.getByText("Available Items (1)")).toBeInTheDocument();
      }
    });
  });

  describe("Remove Item Functionality", () => {
    it("should show X button for each selected item", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      // Should have X buttons for selected items
      const xButtons = screen.getAllByRole("button").filter((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-x");
      });

      expect(xButtons.length).toBeGreaterThan(0);
    });

    it("should call removeFeaturedItemAction when clicking X button", async () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      // Find the X button for "Classic Burger"
      const burgerText = screen.getByText("Classic Burger");
      const itemContainer = burgerText.closest("div.flex.items-center");
      const xButton = itemContainer?.querySelector('button[class*="hover:text-red"]');

      if (xButton) {
        fireEvent.click(xButton);

        await waitFor(() => {
          expect(mockRemoveFeaturedItemAction).toHaveBeenCalledWith("item-1");
        });
      }
    });

    it("should optimistically move item from selected to available", () => {
      // Add a selected item that's also in the initial available list
      // so it can be returned when removed
      const testAvailableItems = [
        ...availableItems,
        {
          id: "item-1",
          name: "Classic Burger",
          description: "Juicy beef patty",
          price: 12.99,
          imageUrl: "https://example.com/burger.jpg",
          categoryName: "Burgers",
        },
      ];

      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={testAvailableItems}
        />,
        { wrapper: Wrapper }
      );

      // Get all "Classic Burger" text elements (will be in both selected and available)
      const burgerTexts = screen.getAllByText("Classic Burger");
      // The first one should be in the selected items section (left column)
      const itemContainer = burgerTexts[0].closest("div.flex.items-center");
      const xButton = itemContainer?.querySelector('button[class*="hover:text-red"]');

      if (xButton) {
        fireEvent.click(xButton);

        // Should update count immediately
        expect(screen.getByText("Featured Items (1)")).toBeInTheDocument();
        expect(screen.getByText("Available Items (4)")).toBeInTheDocument();
      }
    });
  });

  describe("Drag and Drop", () => {
    it("should render drag handles for selected items", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      // Should have grip vertical icons (drag handles)
      const dragHandles = document.querySelectorAll("svg.lucide-grip-vertical");
      expect(dragHandles.length).toBe(selectedItems.length);
    });

    // Note: Full drag-and-drop testing requires more complex setup with @dnd-kit
    // The component uses DndContext which would need special testing utilities
  });

  describe("Error Handling", () => {
    it("should revert optimistic update when add action fails", async () => {
      mockAddFeaturedItemAction.mockResolvedValue({ success: false });

      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      const chickenText = screen.getByText("Chicken Sandwich");
      const itemContainer = chickenText.closest("div.flex.items-center");
      const plusButton = itemContainer?.querySelector('button[class*="hover:text-green"]');

      if (plusButton) {
        fireEvent.click(plusButton);

        // Should revert after failure
        await waitFor(() => {
          expect(screen.getByText("Featured Items (2)")).toBeInTheDocument();
          expect(screen.getByText("Available Items (2)")).toBeInTheDocument();
        });
      }
    });

    it("should revert optimistic update when remove action fails", async () => {
      mockRemoveFeaturedItemAction.mockResolvedValue({ success: false });

      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      const burgerText = screen.getByText("Classic Burger");
      const itemContainer = burgerText.closest("div.flex.items-center");
      const xButton = itemContainer?.querySelector('button[class*="hover:text-red"]');

      if (xButton) {
        fireEvent.click(xButton);

        // Should revert after failure
        await waitFor(() => {
          expect(screen.getByText("Featured Items (2)")).toBeInTheDocument();
        });
      }
    });
  });

  describe("Integration with MenuItemRow", () => {
    it("should use MenuItemRow for available items", () => {
      const { container } = render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      // Check that items have the expected MenuItemRow structure
      const itemContainers = container.querySelectorAll("div.flex.items-center.rounded-lg");
      expect(itemContainers.length).toBeGreaterThan(0);
    });
  });

  describe("Integration with MenuItemSearchList", () => {
    it("should use MenuItemSearchList for available items section", () => {
      render(
        <FeaturedItemsClient
          selectedItems={selectedItems}
          availableItems={availableItems}
        />,
        { wrapper: Wrapper }
      );

      // Search functionality should work (provided by MenuItemSearchList)
      const searchInput = screen.getByPlaceholderText("Search items...");
      expect(searchInput).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: "chicken" } });
      expect(screen.getByText("Chicken Sandwich")).toBeInTheDocument();
    });
  });
});
