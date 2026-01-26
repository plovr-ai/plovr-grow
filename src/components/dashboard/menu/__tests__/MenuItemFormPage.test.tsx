import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { MenuItemFormPage } from "../MenuItemFormPage";
import type { DashboardMenuItem, DashboardCategory, TaxConfigOption } from "@/services/menu/menu.types";

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
      }}
    >
      {children}
    </DashboardProvider>
  );
}

// Mock Next.js navigation
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock server actions
const mockCreateMenuItemAction = vi.fn();
const mockUpdateMenuItemAction = vi.fn();

vi.mock("@/app/(dashboard)/dashboard/(protected)/menu/actions", () => ({
  createMenuItemAction: (...args: unknown[]) => mockCreateMenuItemAction(...args),
  updateMenuItemAction: (...args: unknown[]) => mockUpdateMenuItemAction(...args),
}));

// Mock child components
vi.mock("../ImageUploader", () => ({
  ImageUploader: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (url: string) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid="image-uploader"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("../TaxSelector", () => ({
  TaxSelector: ({
    selectedIds,
    onChange,
  }: {
    taxConfigs: TaxConfigOption[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="tax-selector">
      <span data-testid="selected-tax-count">{selectedIds.length}</span>
      <button
        data-testid="toggle-tax-1"
        onClick={() =>
          onChange(
            selectedIds.includes("tax-1")
              ? selectedIds.filter((id) => id !== "tax-1")
              : [...selectedIds, "tax-1"]
          )
        }
      >
        Toggle Tax 1
      </button>
    </div>
  ),
}));

vi.mock("../ModifierGroupEditor", () => ({
  ModifierGroupEditor: () => <div data-testid="modifier-group-editor">Modifier Editor</div>,
}));

describe("MenuItemFormPage", () => {
  const mockTaxConfigs: TaxConfigOption[] = [
    { id: "tax-1", name: "Standard Tax", description: "8.25%" },
    { id: "tax-2", name: "Alcohol Tax", description: "10%" },
  ];

  const mockCategories: DashboardCategory[] = [
    {
      id: "cat-1",
      name: "Appetizers",
      description: null,
      imageUrl: null,
      sortOrder: 0,
      status: "active",
      menuItems: [],
    },
    {
      id: "cat-2",
      name: "Main Dishes",
      description: null,
      imageUrl: null,
      sortOrder: 1,
      status: "active",
      menuItems: [],
    },
    {
      id: "cat-3",
      name: "Lunch Specials",
      description: null,
      imageUrl: null,
      sortOrder: 2,
      status: "active",
      menuItems: [],
    },
  ];

  const mockMenuItem: DashboardMenuItem = {
    id: "item-1",
    name: "Spring Rolls",
    description: "Crispy vegetable spring rolls",
    price: 8.99,
    imageUrl: "/images/spring-rolls.jpg",
    sortOrder: 0,
    status: "active",
    modifierGroups: [],
    tags: [],
    taxConfigIds: ["tax-1"],
    categoryIds: ["cat-1"],
  };

  const defaultProps = {
    item: null,
    categoryId: "cat-1",
    categoryName: "Appetizers",
    categories: mockCategories,
    taxConfigs: mockTaxConfigs,
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockCreateMenuItemAction.mockClear();
    mockUpdateMenuItemAction.mockClear();
  });

  describe("Create Mode (item is null)", () => {
    it("should display 'Add Menu Item' title", () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Add Menu Item")).toBeInTheDocument();
    });

    it("should display category name", () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Category: Appetizers")).toBeInTheDocument();
    });

    it("should have empty form fields", () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      const priceInput = screen.getByLabelText(/price/i) as HTMLInputElement;

      expect(nameInput.value).toBe("");
      expect(priceInput.value).toBe("");
    });

    it("should display 'Create Item' button", () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByRole("button", { name: /create item/i })).toBeInTheDocument();
    });

    it("should not display status options in create mode", () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.queryByText("Active")).not.toBeInTheDocument();
      expect(screen.queryByText("Out of Stock")).not.toBeInTheDocument();
    });

    it("should call createMenuItemAction on submit", async () => {
      mockCreateMenuItemAction.mockResolvedValue({ success: true });

      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      // Fill in required fields
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: "New Item" },
      });
      fireEvent.change(screen.getByLabelText(/price/i), {
        target: { value: "15.99" },
      });

      // Submit form
      fireEvent.click(screen.getByRole("button", { name: /create item/i }));

      await waitFor(() => {
        expect(mockCreateMenuItemAction).toHaveBeenCalledWith(
          expect.objectContaining({
            categoryIds: ["cat-1"],
            name: "New Item",
            price: 15.99,
          })
        );
      });
    });

    it("should navigate back to menu page on successful create", async () => {
      mockCreateMenuItemAction.mockResolvedValue({ success: true });

      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: "New Item" },
      });
      fireEvent.change(screen.getByLabelText(/price/i), {
        target: { value: "15.99" },
      });

      fireEvent.click(screen.getByRole("button", { name: /create item/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard/menu?category=cat-1");
      });
    });
  });

  describe("Edit Mode (item is provided)", () => {
    const editProps = {
      ...defaultProps,
      item: mockMenuItem,
    };

    it("should display 'Edit Menu Item' title", () => {
      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Edit Menu Item")).toBeInTheDocument();
    });

    it("should populate form with item data", () => {
      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      const priceInput = screen.getByLabelText(/price/i) as HTMLInputElement;

      expect(nameInput.value).toBe("Spring Rolls");
      expect(priceInput.value).toBe("8.99");
    });

    it("should display 'Save Changes' button", () => {
      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("should display status options in edit mode", () => {
      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      expect(screen.getByLabelText("Active")).toBeInTheDocument();
      expect(screen.getByLabelText("Out of Stock")).toBeInTheDocument();
      expect(screen.getByLabelText("Hidden")).toBeInTheDocument();
    });

    it("should call updateMenuItemAction on submit", async () => {
      mockUpdateMenuItemAction.mockResolvedValue({ success: true });

      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      // Change name
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: "Updated Spring Rolls" },
      });

      // Submit form
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateMenuItemAction).toHaveBeenCalledWith(
          "item-1",
          expect.objectContaining({
            name: "Updated Spring Rolls",
          })
        );
      });
    });
  });

  describe("Form Validation", () => {
    it("should show error when name is empty", async () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      // Set price but leave name empty
      fireEvent.change(screen.getByLabelText(/price/i), {
        target: { value: "10.00" },
      });

      fireEvent.click(screen.getByRole("button", { name: /create item/i }));

      await waitFor(() => {
        expect(screen.getByText("Name is required")).toBeInTheDocument();
      });

      expect(mockCreateMenuItemAction).not.toHaveBeenCalled();
    });

    it("should show error when price is empty", async () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: "Test Item" },
      });
      // Leave price empty

      fireEvent.click(screen.getByRole("button", { name: /create item/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Price must be a valid non-negative number")
        ).toBeInTheDocument();
      });

      expect(mockCreateMenuItemAction).not.toHaveBeenCalled();
    });

    it("should show error when price is not a number", async () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: "Test Item" },
      });
      fireEvent.change(screen.getByLabelText(/price/i), {
        target: { value: "abc" },
      });

      fireEvent.click(screen.getByRole("button", { name: /create item/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Price must be a valid non-negative number")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate back to menu page when clicking Cancel", () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockPush).toHaveBeenCalledWith("/dashboard/menu?category=cat-1");
    });

    it("should navigate back to menu page when clicking back button", () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      // Find the back button (ArrowLeft icon button)
      const backButton = screen.getByRole("button", { name: "" });
      fireEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/dashboard/menu?category=cat-1");
    });
  });

  describe("Error Handling", () => {
    it("should display error message from server action", async () => {
      mockCreateMenuItemAction.mockResolvedValue({
        success: false,
        error: "Server error occurred",
      });

      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: "Test Item" },
      });
      fireEvent.change(screen.getByLabelText(/price/i), {
        target: { value: "10.00" },
      });

      fireEvent.click(screen.getByRole("button", { name: /create item/i }));

      await waitFor(() => {
        expect(screen.getByText("Server error occurred")).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("should disable form while submitting", async () => {
      // Make the action hang
      mockCreateMenuItemAction.mockImplementation(
        () => new Promise(() => {})
      );

      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: "Test Item" },
      });
      fireEvent.change(screen.getByLabelText(/price/i), {
        target: { value: "10.00" },
      });

      fireEvent.click(screen.getByRole("button", { name: /create item/i }));

      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeInTheDocument();
      });
    });
  });

  describe("Category Display", () => {
    it("should not display categories field in create mode", () => {
      render(<MenuItemFormPage {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.queryByText("Categories")).not.toBeInTheDocument();
    });

    it("should display single category in edit mode", () => {
      const editProps = {
        ...defaultProps,
        item: mockMenuItem,
      };

      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Categories")).toBeInTheDocument();
      expect(screen.getByText("Appetizers")).toBeInTheDocument();
    });

    it("should display multiple categories in edit mode", () => {
      const itemWithMultipleCategories: DashboardMenuItem = {
        ...mockMenuItem,
        categoryIds: ["cat-1", "cat-2", "cat-3"],
      };

      const editProps = {
        ...defaultProps,
        item: itemWithMultipleCategories,
      };

      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Categories")).toBeInTheDocument();
      expect(screen.getByText("Appetizers")).toBeInTheDocument();
      expect(screen.getByText("Main Dishes")).toBeInTheDocument();
      expect(screen.getByText("Lunch Specials")).toBeInTheDocument();
    });

    it("should display 'No category assigned' when item has no categories", () => {
      const itemWithNoCategories: DashboardMenuItem = {
        ...mockMenuItem,
        categoryIds: [],
      };

      const editProps = {
        ...defaultProps,
        item: itemWithNoCategories,
      };

      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Categories")).toBeInTheDocument();
      expect(screen.getByText("No category assigned")).toBeInTheDocument();
    });

    it("should filter out missing categories", () => {
      const itemWithMissingCategory: DashboardMenuItem = {
        ...mockMenuItem,
        categoryIds: ["cat-1", "nonexistent-cat", "cat-2"],
      };

      const editProps = {
        ...defaultProps,
        item: itemWithMissingCategory,
      };

      render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      expect(screen.getByText("Categories")).toBeInTheDocument();
      expect(screen.getByText("Appetizers")).toBeInTheDocument();
      expect(screen.getByText("Main Dishes")).toBeInTheDocument();
      expect(screen.queryByText("nonexistent-cat")).not.toBeInTheDocument();
    });

    it("should render categories as badges with proper styling", () => {
      const editProps = {
        ...defaultProps,
        item: mockMenuItem,
      };

      const { container } = render(<MenuItemFormPage {...editProps} />, { wrapper: Wrapper });

      const categoryBadge = screen.getByText("Appetizers");
      expect(categoryBadge).toHaveClass("rounded-full", "bg-gray-100", "px-3", "py-1", "text-sm", "text-gray-700");
    });
  });
});
