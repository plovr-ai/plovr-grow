import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { MenuItemList } from "../MenuItemList";
import type { DashboardCategory, TaxConfigOption } from "@/services/menu/menu.types";

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
        onboarding: { status: "not_started" as const, data: null },
      }}
    >
      {children}
    </DashboardProvider>
  );
}

// Mock server actions
const mockUpdateMenuItemSortOrderAction = vi.fn();

vi.mock("@/app/(dashboard)/dashboard/(protected)/menu/actions", () => ({
  updateMenuItemSortOrderAction: (...args: unknown[]) => mockUpdateMenuItemSortOrderAction(...args),
  deleteMenuItemAction: vi.fn(),
  updateMenuItemAction: vi.fn(),
}));

// Mock MenuItemCard to simplify testing
vi.mock("../MenuItemCard", () => ({
  MenuItemCard: ({
    item,
    onEdit,
  }: {
    item: { id: string; name: string };
    onEdit: () => void;
  }) => (
    <div data-testid={`menu-item-${item.id}`} onClick={onEdit}>
      {item.name}
    </div>
  ),
}));

// Mock @dnd-kit components
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  rectSortingStrategy: vi.fn(),
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  },
}));

describe("MenuItemList", () => {
  const mockTaxConfigs: TaxConfigOption[] = [
    { id: "tax-1", name: "Standard Tax", description: "8.25%" },
  ];

  const mockCategory: DashboardCategory = {
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
        description: "Crispy vegetable rolls",
        price: 8.99,
        imageUrl: null,
        sortOrder: 0,
        status: "active",
        modifierGroups: [],
        tags: [],
        taxConfigIds: ["tax-1"],
        categoryIds: ["cat-1"],
      },
      {
        id: "item-2",
        name: "Dumplings",
        description: "Steamed pork dumplings",
        price: 9.99,
        imageUrl: null,
        sortOrder: 1,
        status: "active",
        modifierGroups: [],
        tags: [],
        taxConfigIds: ["tax-1"],
        categoryIds: ["cat-1"],
      },
    ],
  };

  const emptyCategory: DashboardCategory = {
    id: "cat-2",
    name: "Empty Category",
    description: null,
    imageUrl: null,
    sortOrder: 1,
    status: "active",
    menuItems: [],
  };

  const defaultProps = {
    category: mockCategory,
    taxConfigs: mockTaxConfigs,
    onAddItem: vi.fn(),
    onAddExistingItem: vi.fn(),
    onEditItem: vi.fn(),
  };

  beforeEach(() => {
    mockUpdateMenuItemSortOrderAction.mockClear();
    defaultProps.onAddItem.mockClear();
    defaultProps.onAddExistingItem.mockClear();
    defaultProps.onEditItem.mockClear();
  });

  describe("No Category Selected", () => {
    it("should show placeholder when no category is selected", () => {
      render(
        <MenuItemList {...defaultProps} category={null} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("Select a category to view items")).toBeInTheDocument();
    });
  });

  describe("Category Header", () => {
    it("should display category name", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Appetizers")).toBeInTheDocument();
    });

    it("should display item count (plural)", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("2 items")).toBeInTheDocument();
    });

    it("should display item count (singular)", () => {
      const singleItemCategory = {
        ...mockCategory,
        menuItems: [mockCategory.menuItems[0]],
      };

      render(
        <MenuItemList {...defaultProps} category={singleItemCategory} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("1 item")).toBeInTheDocument();
    });

    it("should display zero items", () => {
      render(
        <MenuItemList {...defaultProps} category={emptyCategory} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("0 items")).toBeInTheDocument();
    });
  });

  describe("Add Item Dropdown", () => {
    it("should display Add Item button with dropdown chevron", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      const addButton = screen.getByRole("button", { name: /add item/i });
      expect(addButton).toBeInTheDocument();
    });

    it("should NOT show dropdown menu initially", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.queryByText("Create New Item")).not.toBeInTheDocument();
      expect(screen.queryByText("Add Existing Item")).not.toBeInTheDocument();
    });

    it("should show dropdown menu when clicking Add Item button", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      const addButton = screen.getByRole("button", { name: /add item/i });
      fireEvent.click(addButton);

      expect(screen.getByText("Create New Item")).toBeInTheDocument();
      expect(screen.getByText("Add Existing Item")).toBeInTheDocument();
    });

    it("should call onAddItem when clicking Create New Item", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      const addButton = screen.getByRole("button", { name: /add item/i });
      fireEvent.click(addButton);

      const createNewButton = screen.getByText("Create New Item");
      fireEvent.click(createNewButton);

      expect(defaultProps.onAddItem).toHaveBeenCalled();
    });

    it("should call onAddExistingItem when clicking Add Existing Item", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      const addButton = screen.getByRole("button", { name: /add item/i });
      fireEvent.click(addButton);

      const addExistingButton = screen.getByText("Add Existing Item");
      fireEvent.click(addExistingButton);

      expect(defaultProps.onAddExistingItem).toHaveBeenCalled();
    });

    it("should close dropdown after clicking Create New Item", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      const addButton = screen.getByRole("button", { name: /add item/i });
      fireEvent.click(addButton);

      const createNewButton = screen.getByText("Create New Item");
      fireEvent.click(createNewButton);

      expect(screen.queryByText("Create New Item")).not.toBeInTheDocument();
    });

    it("should close dropdown after clicking Add Existing Item", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      const addButton = screen.getByRole("button", { name: /add item/i });
      fireEvent.click(addButton);

      const addExistingButton = screen.getByText("Add Existing Item");
      fireEvent.click(addExistingButton);

      expect(screen.queryByText("Add Existing Item")).not.toBeInTheDocument();
    });

    it("should close dropdown when clicking outside", async () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      const addButton = screen.getByRole("button", { name: /add item/i });
      fireEvent.click(addButton);

      expect(screen.getByText("Create New Item")).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText("Create New Item")).not.toBeInTheDocument();
      });
    });
  });

  describe("Empty Category", () => {
    it("should show empty state for category with no items", () => {
      render(
        <MenuItemList {...defaultProps} category={emptyCategory} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("No items in this category")).toBeInTheDocument();
      expect(screen.getByText(/Click "Add Item" to add your first menu item/)).toBeInTheDocument();
    });
  });

  describe("Items Display", () => {
    it("should display all menu items", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByTestId("menu-item-item-1")).toBeInTheDocument();
      expect(screen.getByTestId("menu-item-item-2")).toBeInTheDocument();
    });

    it("should display item names", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      expect(screen.getByText("Dumplings")).toBeInTheDocument();
    });
  });

  describe("Edit Item", () => {
    it("should call onEditItem when clicking on an item", () => {
      render(<MenuItemList {...defaultProps} />, { wrapper: Wrapper });

      const item = screen.getByTestId("menu-item-item-1");
      fireEvent.click(item);

      expect(defaultProps.onEditItem).toHaveBeenCalledWith("item-1");
    });
  });
});
