import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { MenuItemCard } from "../MenuItemCard";
import type { DashboardMenuItem, TaxConfigOption } from "@/services/menu/menu.types";

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
const mockDeleteMenuItemAction = vi.fn();
const mockUpdateMenuItemAction = vi.fn();

vi.mock("@/app/(dashboard)/dashboard/(protected)/menu/actions", () => ({
  deleteMenuItemAction: (...args: unknown[]) => mockDeleteMenuItemAction(...args),
  updateMenuItemAction: (...args: unknown[]) => mockUpdateMenuItemAction(...args),
}));

// Mock window.confirm
const mockConfirm = vi.fn();
window.confirm = mockConfirm;

// Mock @dnd-kit/sortable
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

describe("MenuItemCard", () => {
  const mockTaxConfigs: TaxConfigOption[] = [
    { id: "tax-1", name: "Standard Tax", description: "8.25%" },
    { id: "tax-2", name: "Alcohol Tax", description: "10%" },
  ];

  const singleCategoryItem: DashboardMenuItem = {
    id: "item-1",
    name: "Spring Rolls",
    description: "Crispy vegetable rolls",
    price: 8.99,
    imageUrl: "/images/spring-rolls.jpg",
    sortOrder: 0,
    status: "active",
    modifierGroups: [],
    tags: [],
    taxConfigIds: ["tax-1"],
    categoryIds: ["cat-1"],
  };

  const multiCategoryItem: DashboardMenuItem = {
    id: "item-2",
    name: "Fried Rice",
    description: "Classic fried rice",
    price: 12.99,
    imageUrl: null,
    sortOrder: 1,
    status: "active",
    modifierGroups: [],
    tags: [],
    taxConfigIds: ["tax-1"],
    categoryIds: ["cat-1", "cat-2", "cat-3"],
  };

  const defaultProps = {
    item: singleCategoryItem,
    taxConfigs: mockTaxConfigs,
    categoryId: "cat-1",
    onEdit: vi.fn(),
  };

  beforeEach(() => {
    mockDeleteMenuItemAction.mockClear();
    mockUpdateMenuItemAction.mockClear();
    mockConfirm.mockClear();
    defaultProps.onEdit.mockClear();
  });

  describe("Display", () => {
    it("should display item name", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });
      expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
    });

    it("should display item description", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });
      expect(screen.getByText("Crispy vegetable rolls")).toBeInTheDocument();
    });

    it("should display formatted price", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });
      expect(screen.getByText("$8.99")).toBeInTheDocument();
    });

    it("should display item image when available", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });
      const img = screen.getByAltText("Spring Rolls");
      expect(img).toHaveAttribute("src", "/images/spring-rolls.jpg");
    });

    it("should display placeholder when no image", () => {
      render(
        <MenuItemCard {...defaultProps} item={{ ...singleCategoryItem, imageUrl: null }} />,
        { wrapper: Wrapper }
      );
      // ImageIcon placeholder is rendered
      expect(screen.queryByAltText("Spring Rolls")).not.toBeInTheDocument();
    });

    it("should display tax names", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });
      expect(screen.getByText("Tax: Standard Tax")).toBeInTheDocument();
    });

    it("should display multiple tax names", () => {
      render(
        <MenuItemCard
          {...defaultProps}
          item={{ ...singleCategoryItem, taxConfigIds: ["tax-1", "tax-2"] }}
        />,
        { wrapper: Wrapper }
      );
      expect(screen.getByText("Tax: Standard Tax, Alcohol Tax")).toBeInTheDocument();
    });
  });

  describe("Status Badge", () => {
    it("should show Active badge for active items", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });
      // Badge has specific styling classes - look for the badge specifically
      const badges = screen.getAllByText("Active");
      const badge = badges.find((el) => el.classList.contains("rounded-full"));
      expect(badge).toBeInTheDocument();
    });

    it("should show Hidden badge for inactive items", () => {
      render(
        <MenuItemCard {...defaultProps} item={{ ...singleCategoryItem, status: "inactive" }} />,
        { wrapper: Wrapper }
      );
      const badges = screen.getAllByText("Hidden");
      const badge = badges.find((el) => el.classList.contains("rounded-full"));
      expect(badge).toBeInTheDocument();
    });

    it("should show Out of Stock badge", () => {
      render(
        <MenuItemCard {...defaultProps} item={{ ...singleCategoryItem, status: "out_of_stock" }} />,
        { wrapper: Wrapper }
      );
      const badges = screen.getAllByText("Out of Stock");
      const badge = badges.find((el) => el.classList.contains("rounded-full"));
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Multi-Category Badge", () => {
    it("should NOT show category count badge for single-category item", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });
      // The badge shows the number (e.g., "3")
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("should show category count badge for multi-category item", () => {
      render(
        <MenuItemCard {...defaultProps} item={multiCategoryItem} />,
        { wrapper: Wrapper }
      );
      // Badge shows number of categories
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("Delete Behavior - Single Category Item", () => {
    // Helper to find the delete button (has red color class)
    const findDeleteButton = () => {
      const buttons = screen.getAllByRole("button");
      return buttons.find((btn) => btn.classList.contains("text-red-500"));
    };

    it("should show standard delete confirmation for single-category item", () => {
      mockConfirm.mockReturnValue(true);
      mockDeleteMenuItemAction.mockResolvedValue({ success: true });

      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      expect(mockConfirm).toHaveBeenCalledWith(
        "Are you sure you want to delete this item?"
      );
    });

    it("should call deleteMenuItemAction without categoryId for single-category item", async () => {
      mockConfirm.mockReturnValue(true);
      mockDeleteMenuItemAction.mockResolvedValue({ success: true });

      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(mockDeleteMenuItemAction).toHaveBeenCalledWith("item-1");
      });
    });

    it("should NOT call deleteMenuItemAction when confirmation is cancelled", () => {
      mockConfirm.mockReturnValue(false);

      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      expect(mockDeleteMenuItemAction).not.toHaveBeenCalled();
    });
  });

  describe("Delete Behavior - Multi-Category Item", () => {
    // Helper to find the delete button (has red color class)
    const findDeleteButton = () => {
      const buttons = screen.getAllByRole("button");
      return buttons.find((btn) => btn.classList.contains("text-red-500"));
    };

    it("should show multi-category confirmation message", () => {
      mockConfirm.mockReturnValue(true);
      mockDeleteMenuItemAction.mockResolvedValue({ success: true });

      render(
        <MenuItemCard {...defaultProps} item={multiCategoryItem} />,
        { wrapper: Wrapper }
      );

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.stringContaining("This item is in 3 categories")
      );
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.stringContaining("Click OK to remove from this category only")
      );
    });

    it("should call deleteMenuItemAction with categoryId for multi-category item", async () => {
      mockConfirm.mockReturnValue(true);
      mockDeleteMenuItemAction.mockResolvedValue({ success: true });

      render(
        <MenuItemCard {...defaultProps} item={multiCategoryItem} />,
        { wrapper: Wrapper }
      );

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(mockDeleteMenuItemAction).toHaveBeenCalledWith("item-2", { categoryId: "cat-1" });
      });
    });

    it("should NOT call deleteMenuItemAction when multi-category confirmation is cancelled", () => {
      mockConfirm.mockReturnValue(false);

      render(
        <MenuItemCard {...defaultProps} item={multiCategoryItem} />,
        { wrapper: Wrapper }
      );

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      expect(mockDeleteMenuItemAction).not.toHaveBeenCalled();
    });
  });

  describe("Status Change", () => {
    it("should call updateMenuItemAction when status is changed", async () => {
      mockUpdateMenuItemAction.mockResolvedValue({ success: true });

      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const statusSelect = screen.getByRole("combobox");
      fireEvent.change(statusSelect, { target: { value: "out_of_stock" } });

      await waitFor(() => {
        expect(mockUpdateMenuItemAction).toHaveBeenCalledWith("item-1", {
          status: "out_of_stock",
        });
      });
    });

    it("should call updateMenuItemAction when setting to inactive", async () => {
      mockUpdateMenuItemAction.mockResolvedValue({ success: true });

      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const statusSelect = screen.getByRole("combobox");
      fireEvent.change(statusSelect, { target: { value: "inactive" } });

      await waitFor(() => {
        expect(mockUpdateMenuItemAction).toHaveBeenCalledWith("item-1", {
          status: "inactive",
        });
      });
    });
  });

  describe("Edit Navigation", () => {
    it("should call onEdit when card is clicked", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const card = screen.getByText("Spring Rolls").closest("div[class*='cursor-pointer']");
      fireEvent.click(card!);

      expect(defaultProps.onEdit).toHaveBeenCalled();
    });

    it("should NOT call onEdit when status dropdown is clicked", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const statusSelect = screen.getByRole("combobox");
      fireEvent.click(statusSelect);

      expect(defaultProps.onEdit).not.toHaveBeenCalled();
    });

    it("should NOT call onEdit when delete button is clicked", () => {
      mockConfirm.mockReturnValue(false);

      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      // Find delete button by red color class
      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons.find((btn) => btn.classList.contains("text-red-500"));
      fireEvent.click(deleteButton!);

      expect(defaultProps.onEdit).not.toHaveBeenCalled();
    });
  });

  describe("Modifier Count", () => {
    it("should display modifier count when item has modifiers", () => {
      const itemWithModifiers: DashboardMenuItem = {
        ...singleCategoryItem,
        modifierGroups: [
          { name: "Size", required: true, multiSelect: false, maxSelections: 1, modifiers: [] },
          { name: "Extras", required: false, multiSelect: true, maxSelections: 3, modifiers: [] },
        ],
      };

      render(
        <MenuItemCard {...defaultProps} item={itemWithModifiers} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("2 modifiers")).toBeInTheDocument();
    });

    it("should display singular modifier when only one", () => {
      const itemWithOneModifier: DashboardMenuItem = {
        ...singleCategoryItem,
        modifierGroups: [
          { name: "Size", required: true, multiSelect: false, maxSelections: 1, modifiers: [] },
        ],
      };

      render(
        <MenuItemCard {...defaultProps} item={itemWithOneModifier} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText("1 modifier")).toBeInTheDocument();
    });

    it("should NOT display modifier count when no modifiers", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.queryByText(/modifier/)).not.toBeInTheDocument();
    });
  });
});
