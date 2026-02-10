import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuManagementClient } from "../MenuManagementClient";
import type {
  DashboardCategory,
  TaxConfigOption,
  MenuInfo,
} from "@/services/menu/menu.types";

// Mock next-auth to avoid module resolution issues
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

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
vi.mock("../MenuTabs", () => ({
  MenuTabs: ({
    menus,
    selectedMenuId,
    onSelectMenu,
    onAddMenu,
  }: {
    menus: MenuInfo[];
    selectedMenuId: string;
    onSelectMenu: (id: string) => void;
    onAddMenu: () => void;
    onEditMenu: (menu: MenuInfo) => void;
  }) => (
    <div data-testid="menu-tabs">
      {menus.map((menu) => (
        <button
          key={menu.id}
          data-testid={`menu-${menu.id}`}
          data-selected={selectedMenuId === menu.id}
          onClick={() => onSelectMenu(menu.id)}
        >
          {menu.name}
        </button>
      ))}
      <button data-testid="add-menu-btn" onClick={onAddMenu}>
        Add Menu
      </button>
    </div>
  ),
}));

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
    onAddExistingItem,
    onEditItem,
  }: {
    category: DashboardCategory | null;
    taxConfigs: TaxConfigOption[];
    onAddItem: () => void;
    onAddExistingItem: () => void;
    onEditItem: (itemId: string) => void;
  }) => (
    <div data-testid="menu-item-list">
      {category ? (
        <>
          <span data-testid="selected-category-name">{category.name}</span>
          <button data-testid="add-item-btn" onClick={onAddItem}>
            Add Item
          </button>
          <button data-testid="add-existing-item-btn" onClick={onAddExistingItem}>
            Add Existing Item
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

vi.mock("../MenuForm", () => ({
  MenuForm: () => <div data-testid="menu-form">Menu Form</div>,
}));

vi.mock("../AddExistingItemModal", () => ({
  AddExistingItemModal: ({
    categoryId,
    categoryName,
    onClose,
  }: {
    categoryId: string;
    categoryName: string;
    onClose: () => void;
  }) => (
    <div data-testid="add-existing-item-modal">
      <span data-testid="modal-category-id">{categoryId}</span>
      <span data-testid="modal-category-name">{categoryName}</span>
      <button data-testid="close-modal-btn" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

describe("MenuManagementClient", () => {
  const mockMenus: MenuInfo[] = [
    {
      id: "menu-1",
      name: "Main Menu",
      description: null,
      sortOrder: 0,
      status: "active",
    },
    {
      id: "menu-2",
      name: "Lunch Menu",
      description: "Available 11am-3pm",
      sortOrder: 1,
      status: "active",
    },
  ];

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
          categoryIds: ["cat-1"],
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
          categoryIds: ["cat-2"],
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
    menus: mockMenus,
    currentMenuId: "menu-1",
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
      render(
        <MenuManagementClient
          menus={mockMenus}
          currentMenuId="menu-1"
          categories={[]}
          taxConfigs={mockTaxConfigs}
        />
      );

      expect(screen.getByTestId("no-category-selected")).toBeInTheDocument();
    });
  });

  describe("Category Selection Interaction", () => {
    it("should update URL when clicking a category", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const cat2Button = screen.getByTestId("category-cat-2");
      fireEvent.click(cat2Button);

      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/menu?menu=menu-1&category=cat-2",
        { scroll: false }
      );
    });

    it("should update URL with correct category ID when clicking different categories", () => {
      render(<MenuManagementClient {...defaultProps} />);

      // Click cat-3
      fireEvent.click(screen.getByTestId("category-cat-3"));
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/menu?menu=menu-1&category=cat-3",
        { scroll: false }
      );

      mockReplace.mockClear();

      // Click cat-1
      fireEvent.click(screen.getByTestId("category-cat-1"));
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/menu?menu=menu-1&category=cat-1",
        { scroll: false }
      );
    });
  });

  describe("Menu Item Navigation", () => {
    it("should navigate to new item page with menuId and categoryId when clicking Add Item", () => {
      mockSearchParams.set("category", "cat-2");

      render(<MenuManagementClient {...defaultProps} />);

      const addItemBtn = screen.getByTestId("add-item-btn");
      fireEvent.click(addItemBtn);

      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/menu/items/new?menuId=menu-1&categoryId=cat-2"
      );
    });

    it("should navigate to edit item page with menuId when clicking edit on an item", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const editItemBtn = screen.getByTestId("edit-item-item-1");
      fireEvent.click(editItemBtn);

      expect(mockPush).toHaveBeenCalledWith("/dashboard/menu/items/item-1/edit?menuId=menu-1");
    });

    it("should use first category ID for new item when no URL parameter", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const addItemBtn = screen.getByTestId("add-item-btn");
      fireEvent.click(addItemBtn);

      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/menu/items/new?menuId=menu-1&categoryId=cat-1"
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
        screen.getByText("Manage your menus, categories and items")
      ).toBeInTheDocument();
    });
  });

  describe("Menu Tabs", () => {
    it("should render menu tabs with all menus", () => {
      render(<MenuManagementClient {...defaultProps} />);

      expect(screen.getByTestId("menu-tabs")).toBeInTheDocument();
      expect(screen.getByTestId("menu-menu-1")).toBeInTheDocument();
      expect(screen.getByTestId("menu-menu-2")).toBeInTheDocument();
    });

    it("should show current menu as selected", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const menu1Button = screen.getByTestId("menu-menu-1");
      expect(menu1Button).toHaveAttribute("data-selected", "true");

      const menu2Button = screen.getByTestId("menu-menu-2");
      expect(menu2Button).toHaveAttribute("data-selected", "false");
    });

    it("should update URL when clicking a different menu", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const menu2Button = screen.getByTestId("menu-menu-2");
      fireEvent.click(menu2Button);

      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/menu?menu=menu-2",
        { scroll: false }
      );
    });
  });

  describe("Menu Form Modal", () => {
    it("should open menu form when clicking Add Menu", () => {
      render(<MenuManagementClient {...defaultProps} />);

      expect(screen.queryByTestId("menu-form")).not.toBeInTheDocument();

      const addMenuBtn = screen.getByTestId("add-menu-btn");
      fireEvent.click(addMenuBtn);

      expect(screen.getByTestId("menu-form")).toBeInTheDocument();
    });
  });

  describe("Empty Categories", () => {
    it("should show empty state when no categories", () => {
      render(
        <MenuManagementClient
          menus={mockMenus}
          currentMenuId="menu-1"
          categories={[]}
          taxConfigs={mockTaxConfigs}
        />
      );

      expect(screen.getByText("No categories yet")).toBeInTheDocument();
    });
  });

  describe("Add Existing Item Modal", () => {
    it("should NOT show modal initially", () => {
      render(<MenuManagementClient {...defaultProps} />);

      expect(screen.queryByTestId("add-existing-item-modal")).not.toBeInTheDocument();
    });

    it("should open modal when clicking Add Existing Item", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const addExistingBtn = screen.getByTestId("add-existing-item-btn");
      fireEvent.click(addExistingBtn);

      expect(screen.getByTestId("add-existing-item-modal")).toBeInTheDocument();
    });

    it("should pass correct categoryId to modal", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const addExistingBtn = screen.getByTestId("add-existing-item-btn");
      fireEvent.click(addExistingBtn);

      // First category (Appetizers, cat-1) is selected by default
      expect(screen.getByTestId("modal-category-id")).toHaveTextContent("cat-1");
    });

    it("should pass correct categoryName to modal", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const addExistingBtn = screen.getByTestId("add-existing-item-btn");
      fireEvent.click(addExistingBtn);

      expect(screen.getByTestId("modal-category-name")).toHaveTextContent("Appetizers");
    });

    it("should pass correct categoryId when different category is selected", () => {
      mockSearchParams.set("category", "cat-2");

      render(<MenuManagementClient {...defaultProps} />);

      const addExistingBtn = screen.getByTestId("add-existing-item-btn");
      fireEvent.click(addExistingBtn);

      expect(screen.getByTestId("modal-category-id")).toHaveTextContent("cat-2");
      expect(screen.getByTestId("modal-category-name")).toHaveTextContent("Main Dishes");
    });

    it("should close modal when onClose is called", () => {
      render(<MenuManagementClient {...defaultProps} />);

      const addExistingBtn = screen.getByTestId("add-existing-item-btn");
      fireEvent.click(addExistingBtn);

      expect(screen.getByTestId("add-existing-item-modal")).toBeInTheDocument();

      const closeBtn = screen.getByTestId("close-modal-btn");
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId("add-existing-item-modal")).not.toBeInTheDocument();
    });

    it("should NOT open modal when no category is selected", () => {
      render(
        <MenuManagementClient
          menus={mockMenus}
          currentMenuId="menu-1"
          categories={[]}
          taxConfigs={mockTaxConfigs}
        />
      );

      // The add-existing-item-btn won't exist when there's no category
      expect(screen.queryByTestId("add-existing-item-btn")).not.toBeInTheDocument();
    });
  });
});
