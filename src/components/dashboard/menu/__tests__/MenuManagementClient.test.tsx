import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuManagementClient } from "../MenuManagementClient";
import type { DashboardCategory, TaxConfigOption } from "@/services/menu/menu.types";

// Mock Next.js navigation hooks
const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock child components to isolate MenuManagementClient logic
vi.mock("../CategoryList", () => ({
  CategoryList: ({
    categories,
    selectedCategoryId,
    onSelectCategory,
  }: {
    categories: DashboardCategory[];
    selectedCategoryId: string | null;
    onSelectCategory: (id: string) => void;
    onEditCategory: (category: DashboardCategory) => void;
  }) => (
    <div data-testid="category-list">
      {categories.map((cat) => (
        <button
          key={cat.id}
          data-testid={`category-${cat.id}`}
          data-selected={selectedCategoryId === cat.id}
          onClick={() => onSelectCategory(cat.id)}
        >
          {cat.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../MenuItemList", () => ({
  MenuItemList: ({
    category,
    onAddItem,
    onEditItem,
  }: {
    category: DashboardCategory | null;
    taxConfigs: TaxConfigOption[];
    onAddItem: () => void;
    onEditItem: (itemId: string) => void;
  }) => (
    <div data-testid="menu-item-list">
      {category ? (
        <>
          <span data-testid="selected-category-name">{category.name}</span>
          <button data-testid="add-item-btn" onClick={onAddItem}>
            Add Item
          </button>
          {category.menuItems.map((item) => (
            <button
              key={item.id}
              data-testid={`edit-item-${item.id}`}
              onClick={() => onEditItem(item.id)}
            >
              Edit {item.name}
            </button>
          ))}
        </>
      ) : (
        <span data-testid="no-category-selected">No category selected</span>
      )}
    </div>
  ),
}));

vi.mock("../CategoryForm", () => ({
  CategoryForm: () => <div data-testid="category-form">Category Form</div>,
}));

describe("MenuManagementClient", () => {
  const mockCategories: DashboardCategory[] = [
    {
      id: "cat-1",
      name: "Appetizers",
      description: "Starter dishes",
      imageUrl: null,
      sortOrder: 0,
      status: "active",
      menuItems: [
        {
          id: "item-1",
          name: "Spring Rolls",
          description: null,
          price: 8.99,
          imageUrl: null,
          sortOrder: 0,
          status: "active",
          modifierGroups: [],
          tags: [],
          taxConfigIds: [],
        },
      ],
    },
    {
      id: "cat-2",
      name: "Main Dishes",
      description: "Main courses",
      imageUrl: null,
      sortOrder: 1,
      status: "active",
      menuItems: [
        {
          id: "item-2",
          name: "Fried Rice",
          description: null,
          price: 12.99,
          imageUrl: null,
          sortOrder: 0,
          status: "active",
          modifierGroups: [],
          tags: [],
          taxConfigIds: [],
        },
      ],
    },
    {
      id: "cat-3",
      name: "Desserts",
      description: "Sweet treats",
      imageUrl: null,
      sortOrder: 2,
      status: "active",
      menuItems: [],
    },
  ];

  const mockTaxConfigs: TaxConfigOption[] = [
    { id: "tax-1", name: "Standard Tax", description: "8.25%" },
  ];

  const defaultProps = {
    categories: mockCategories,
    taxConfigs: mockTaxConfigs,
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  describe("Category Selection from URL", () => {
    it("should select first category by default when no URL parameter", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const selectedName = screen.getByTestId("selected-category-name");
      expect(selectedName).toHaveTextContent("Appetizers");

      const cat1Button = screen.getByTestId("category-cat-1");
      expect(cat1Button).toHaveAttribute("data-selected", "true");
    });

    it("should select category from URL parameter", () => {
      mockSearchParams.set("category", "cat-2");

      render(<MenuManagementClient {...defaultProps} />);

      const selectedName = screen.getByTestId("selected-category-name");
      expect(selectedName).toHaveTextContent("Main Dishes");

      const cat2Button = screen.getByTestId("category-cat-2");
      expect(cat2Button).toHaveAttribute("data-selected", "true");
    });

    it("should fallback to first category when URL category does not exist", () => {
      mockSearchParams.set("category", "non-existent-cat");

      render(<MenuManagementClient {...defaultProps} />);

      const selectedName = screen.getByTestId("selected-category-name");
      expect(selectedName).toHaveTextContent("Appetizers");
    });

    it("should show no category selected when categories array is empty", () => {
      render(<MenuManagementClient categories={[]} taxConfigs={mockTaxConfigs} />);

      expect(screen.getByTestId("no-category-selected")).toBeInTheDocument();
    });
  });

  describe("Category Selection Interaction", () => {
    it("should update URL when clicking a category", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const cat2Button = screen.getByTestId("category-cat-2");
      fireEvent.click(cat2Button);

      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/menu?category=cat-2",
        { scroll: false }
      );
    });

    it("should update URL with correct category ID when clicking different categories", () => {
      render(<MenuManagementClient {...defaultProps} />);

      // Click cat-3
      fireEvent.click(screen.getByTestId("category-cat-3"));
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/menu?category=cat-3",
        { scroll: false }
      );

      mockReplace.mockClear();

      // Click cat-1
      fireEvent.click(screen.getByTestId("category-cat-1"));
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/menu?category=cat-1",
        { scroll: false }
      );
    });
  });

  describe("Menu Item Navigation", () => {
    it("should navigate to new item page with categoryId when clicking Add Item", () => {
      mockSearchParams.set("category", "cat-2");

      render(<MenuManagementClient {...defaultProps} />);

      const addItemBtn = screen.getByTestId("add-item-btn");
      fireEvent.click(addItemBtn);

      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/menu/items/new?categoryId=cat-2"
      );
    });

    it("should navigate to edit item page when clicking edit on an item", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const editItemBtn = screen.getByTestId("edit-item-item-1");
      fireEvent.click(editItemBtn);

      expect(mockPush).toHaveBeenCalledWith("/dashboard/menu/items/item-1/edit");
    });

    it("should use first category ID for new item when no URL parameter", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const addItemBtn = screen.getByTestId("add-item-btn");
      fireEvent.click(addItemBtn);

      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/menu/items/new?categoryId=cat-1"
      );
    });
  });

  describe("Category Form Modal", () => {
    it("should open category form when clicking Add Category", () => {
      render(<MenuManagementClient {...defaultProps} />);

      expect(screen.queryByTestId("category-form")).not.toBeInTheDocument();

      const addCategoryBtn = screen.getByRole("button", { name: /add category/i });
      fireEvent.click(addCategoryBtn);

      expect(screen.getByTestId("category-form")).toBeInTheDocument();
    });
  });

  describe("Header Display", () => {
    it("should display Menu Management title", () => {
      render(<MenuManagementClient {...defaultProps} />);

      expect(screen.getByText("Menu Management")).toBeInTheDocument();
    });

    it("should display subtitle", () => {
      render(<MenuManagementClient {...defaultProps} />);

      expect(
        screen.getByText("Manage your menu categories and items")
      ).toBeInTheDocument();
    });
  });
});
