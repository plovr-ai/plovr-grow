import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MenuPageClient } from "../MenuPageClient";
import type { MenuDisplayData } from "@storefront/r/[merchantSlug]/menu/utils";
import type { MenuItemViewModel } from "@/types/menu-page";

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor() {}
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock next/navigation
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock cart store
const mockSetTenantId = vi.fn();
const mockAddItem = vi.fn();
vi.mock("@/stores", () => ({
  useCartStore: (selector: (state: unknown) => unknown) => {
    const state = {
      setTenantId: mockSetTenantId,
      addItem: mockAddItem,
      items: [],
      getItemCount: () => 0,
      getSubtotal: () => 0,
    };
    return selector(state);
  },
  useCartHydration: () => true,
}));

// Mock useFormatPrice hook
vi.mock("@/hooks", () => ({
  useFormatPrice: () => (price: number) => `$${price.toFixed(2)}`,
}));

// Mock cartAnimation
vi.mock("@storefront/lib/cartAnimation", () => ({
  animateFlyToCart: vi.fn(),
}));

// Helper to create menu item
const createMenuItem = (
  overrides: Partial<MenuItemViewModel> = {}
): MenuItemViewModel => ({
  id: "item-1",
  name: "Test Item",
  description: "A test item",
  price: 10.99,
  imageUrl: null,
  tags: [],
  hasModifiers: false,
  isAvailable: true,
  taxConfigId: null,
  modifierGroups: [],
  ...overrides,
});

// Helper to create menu data
const createMenuData = (items: MenuItemViewModel[] = []): MenuDisplayData => ({
  merchantName: "Test Bakery",
  merchantLogo: null,
  companySlug: "test-bakery",
  categories: [
    {
      category: {
        id: "cat-1",
        name: "Breads",
        description: "Fresh breads",
      },
      items: items.length > 0 ? items : [createMenuItem()],
    },
  ],
});

describe("MenuPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset search params
    mockSearchParams.delete("addItem");
  });

  describe("addItem query param handling", () => {
    it("should auto-open modifier modal when addItem param matches item with modifiers", async () => {
      // Set up search params with addItem
      mockSearchParams.set("addItem", "item-cappuccino");

      const itemWithModifiers = createMenuItem({
        id: "item-cappuccino",
        name: "Cappuccino",
        hasModifiers: true,
        modifierGroups: [
          {
            id: "size",
            name: "Size",
            required: true,
            minSelections: 1,
            maxSelections: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "small", name: "Small", price: 0, isDefault: true, isAvailable: true },
              { id: "large", name: "Large", price: 1.5, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      const data = createMenuData([itemWithModifiers]);

      render(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      // Wait for the modal to open
      await waitFor(() => {
        // Check for modal elements (size options) - these only appear in the modal
        expect(screen.getByText("Size")).toBeInTheDocument();
        expect(screen.getByText("Small")).toBeInTheDocument();
        expect(screen.getByText("Large")).toBeInTheDocument();
        // Check for Add to Cart button which is in the modal
        expect(screen.getByText("Add to Cart")).toBeInTheDocument();
      });
    });

    it("should not open modal when addItem param matches item without modifiers", async () => {
      // Set up search params with addItem
      mockSearchParams.set("addItem", "item-bread");

      const itemWithoutModifiers = createMenuItem({
        id: "item-bread",
        name: "Sourdough Bread",
        hasModifiers: false,
        modifierGroups: [],
      });

      const data = createMenuData([itemWithoutModifiers]);

      render(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      // Wait a bit to ensure effect runs
      await waitFor(() => {
        // The item name should appear in the menu but not in a modal
        expect(screen.getByText("Sourdough Bread")).toBeInTheDocument();
      });

      // Modal-specific elements should not be present (like Add to Cart button in modal)
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should not open modal when addItem param does not match any item", async () => {
      mockSearchParams.set("addItem", "non-existent-item");

      const data = createMenuData([createMenuItem({ id: "item-1", name: "Test Item" })]);

      render(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      // Wait a bit to ensure effect runs
      await waitFor(() => {
        expect(screen.getByText("Test Item")).toBeInTheDocument();
      });

      // No modal should be open
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should not open modal when no addItem param is present", () => {
      // No addItem param set
      const itemWithModifiers = createMenuItem({
        id: "item-1",
        name: "Coffee",
        hasModifiers: true,
        modifierGroups: [
          {
            id: "size",
            name: "Size",
            required: true,
            minSelections: 1,
            maxSelections: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "small", name: "Small", price: 0, isDefault: true, isAvailable: true },
            ],
          },
        ],
      });

      const data = createMenuData([itemWithModifiers]);

      render(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      // No modal should be open initially
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should only handle addItem param once (not on re-renders)", async () => {
      mockSearchParams.set("addItem", "item-coffee");

      const itemWithModifiers = createMenuItem({
        id: "item-coffee",
        name: "Coffee",
        hasModifiers: true,
        modifierGroups: [
          {
            id: "size",
            name: "Size",
            required: true,
            minSelections: 1,
            maxSelections: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "small", name: "Small", price: 0, isDefault: true, isAvailable: true },
            ],
          },
        ],
      });

      const data = createMenuData([itemWithModifiers]);

      const { rerender } = render(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText("Size")).toBeInTheDocument();
      });

      // Re-render with same props
      rerender(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      // Modal should still be open (handled only once, not reopened)
      expect(screen.getByText("Size")).toBeInTheDocument();
    });
  });

  describe("cart initialization", () => {
    it("should set tenant ID on mount", () => {
      const data = createMenuData();

      render(<MenuPageClient data={data} merchantSlug="bakery-sf" />);

      expect(mockSetTenantId).toHaveBeenCalledWith("bakery-sf");
    });

    it("should support legacy tenantSlug prop", () => {
      const data = createMenuData();

      render(<MenuPageClient data={data} tenantSlug="legacy-bakery" />);

      expect(mockSetTenantId).toHaveBeenCalledWith("legacy-bakery");
    });
  });
});
