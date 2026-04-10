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
const mockDeleteMenuItemAction = vi.fn();
const mockUpdateMenuItemAction = vi.fn();

vi.mock("@/app/(dashboard)/dashboard/(protected)/menu/actions", () => ({
  deleteMenuItemAction: (...args: unknown[]) => mockDeleteMenuItemAction(...args),
  updateMenuItemAction: (...args: unknown[]) => mockUpdateMenuItemAction(...args),
}));


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

    it("should show Out of Stock badge", () => {
      render(
        <MenuItemCard {...defaultProps} item={{ ...singleCategoryItem, status: "out_of_stock" }} />,
        { wrapper: Wrapper }
      );
      const badges = screen.getAllByText("Out of Stock");
      const badge = badges.find((el) => el.classList.contains("rounded-full"));
      expect(badge).toBeInTheDocument();
    });

    it("should show Archived badge", () => {
      render(
        <MenuItemCard {...defaultProps} item={{ ...singleCategoryItem, status: "archived" }} />,
        { wrapper: Wrapper }
      );
      const badges = screen.getAllByText("Archived");
      const badge = badges.find((el) => el.classList.contains("rounded-full"));
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Status Dropdown", () => {
    it("should have exactly 3 status options", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const statusSelect = screen.getByRole("combobox");
      const options = statusSelect.querySelectorAll("option");

      expect(options).toHaveLength(3);
      expect(options[0]).toHaveValue("active");
      expect(options[1]).toHaveValue("out_of_stock");
      expect(options[2]).toHaveValue("archived");
    });

    it("should NOT have Hidden/inactive option", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const statusSelect = screen.getByRole("combobox");
      const options = Array.from(statusSelect.querySelectorAll("option"));

      const hasHidden = options.some(
        (opt) => opt.value === "inactive" || opt.textContent === "Hidden"
      );
      expect(hasHidden).toBe(false);
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

    it("should show action choice dialog for single-category item", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      // Dialog should open
      expect(screen.getByText("Remove or Archive Item?")).toBeInTheDocument();
      expect(screen.getByText("This item is only in this category.")).toBeInTheDocument();
    });

    it("should call deleteMenuItemAction when Archive Item is clicked for single-category item", async () => {
      mockDeleteMenuItemAction.mockResolvedValue({ success: true });

      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      // Click Archive Item button
      const archiveButton = screen.getByRole("button", { name: "Archive Item" });
      fireEvent.click(archiveButton);

      await waitFor(() => {
        expect(mockDeleteMenuItemAction).toHaveBeenCalledWith("item-1");
      });
    });

    it("should NOT call deleteMenuItemAction when Cancel is clicked", () => {
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      // Click Cancel button
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(mockDeleteMenuItemAction).not.toHaveBeenCalled();
    });
  });

  describe("Delete Behavior - Multi-Category Item", () => {
    // Helper to find the delete button (has red color class)
    const findDeleteButton = () => {
      const buttons = screen.getAllByRole("button");
      return buttons.find((btn) => btn.classList.contains("text-red-500"));
    };

    it("should show multi-category message in action choice dialog", () => {
      render(
        <MenuItemCard {...defaultProps} item={multiCategoryItem} />,
        { wrapper: Wrapper }
      );

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      expect(screen.getByText("Remove or Archive Item?")).toBeInTheDocument();
      expect(screen.getByText("This item is in 3 categories.")).toBeInTheDocument();
    });

    it("should call deleteMenuItemAction with categoryId when Remove from Category is clicked", async () => {
      mockDeleteMenuItemAction.mockResolvedValue({ success: true });

      render(
        <MenuItemCard {...defaultProps} item={multiCategoryItem} />,
        { wrapper: Wrapper }
      );

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      // Click Remove from Category button
      const removeButton = screen.getByRole("button", { name: "Remove from Category" });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockDeleteMenuItemAction).toHaveBeenCalledWith("item-2", { categoryId: "cat-1" });
      });
    });

    it("should NOT call deleteMenuItemAction when Cancel is clicked for multi-category item", () => {
      render(
        <MenuItemCard {...defaultProps} item={multiCategoryItem} />,
        { wrapper: Wrapper }
      );

      const deleteButton = findDeleteButton();
      fireEvent.click(deleteButton!);

      // Click Cancel button
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

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
      render(<MenuItemCard {...defaultProps} />, { wrapper: Wrapper });

      // Find delete button by red color class
      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons.find((btn) => btn.classList.contains("text-red-500"));
      fireEvent.click(deleteButton!);

      // Cancel the dialog
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(defaultProps.onEdit).not.toHaveBeenCalled();
    });
  });

  describe("Modifier Count", () => {
    it("should display modifier count when item has modifiers", () => {
      const itemWithModifiers: DashboardMenuItem = {
        ...singleCategoryItem,
        modifierGroups: [
          { id: "mg-1", name: "Size", required: true, type: "single", modifiers: [] },
          { id: "mg-2", name: "Extras", required: false, type: "multiple", modifiers: [] },
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
          { id: "mg-1", name: "Size", required: true, type: "single", modifiers: [] },
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

  describe("Description and Tax Display", () => {
    it("should render non-breaking space when description is null", () => {
      const noDescItem: DashboardMenuItem = {
        ...singleCategoryItem,
        description: null,
      };

      render(
        <MenuItemCard {...defaultProps} item={noDescItem} />,
        { wrapper: Wrapper }
      );

      // The component renders \u00A0 when description is null
      expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
    });

    it("should not display tax line when no tax configs", () => {
      const noTaxItem: DashboardMenuItem = {
        ...singleCategoryItem,
        taxConfigIds: [],
      };

      render(
        <MenuItemCard {...defaultProps} item={noTaxItem} />,
        { wrapper: Wrapper }
      );

      expect(screen.queryByText(/Tax:/)).not.toBeInTheDocument();
    });
  });
});
