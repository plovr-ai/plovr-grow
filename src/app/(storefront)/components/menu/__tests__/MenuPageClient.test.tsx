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
let mockSearchParams = new URLSearchParams();
const setMockSearchParams = (params: URLSearchParams) => {
  mockSearchParams = params;
};
const mockRouterReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    replace: mockRouterReplace,
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

// Mock useMerchantInfo hook
vi.mock("@/contexts", () => ({
  useMerchantInfo: () => ({ name: "Test Bakery", logoUrl: null }),
}));

// Mock cartAnimation
vi.mock("@storefront/lib/cartAnimation", () => ({
  animateFlyToCart: vi.fn(),
}));

// Mock sonner toast
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => mockToastSuccess(message),
  },
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
const createMenuData = (items: MenuItemViewModel[] = []): MenuDisplayData => {
  const menuItems = items.length > 0 ? items : [createMenuItem()];
  return {
    companySlug: "test-bakery",
    categories: [
      {
        category: {
          id: "cat-1",
          name: "Breads",
          description: "Fresh breads",
          itemCount: menuItems.length,
        },
        items: menuItems,
      },
    ],
  };
};

describe("MenuPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset search params
    setMockSearchParams(new URLSearchParams());
    mockRouterReplace.mockClear();
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
      const params = new URLSearchParams();
      params.set("addItem", "item-coffee");
      setMockSearchParams(params);

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

    it("should show toast when adding item without modifiers via addItem param", async () => {
      const params = new URLSearchParams();
      params.set("addItem", "item-bread");
      setMockSearchParams(params);

      const item = createMenuItem({
        id: "item-bread",
        name: "Sourdough Bread",
        hasModifiers: false,
        modifierGroups: [],
      });

      const data = createMenuData([item]);

      render(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      await waitFor(() => {
        expect(mockAddItem).toHaveBeenCalledWith(
          expect.objectContaining({
            menuItemId: "item-bread",
            name: "Sourdough Bread",
          })
        );
        expect(mockToastSuccess).toHaveBeenCalledWith("Sourdough Bread added to cart");
      });
    });

    it("should clean up URL after processing addItem param", async () => {
      const params = new URLSearchParams();
      params.set("addItem", "item-bread");
      setMockSearchParams(params);

      const item = createMenuItem({
        id: "item-bread",
        name: "Sourdough Bread",
        hasModifiers: false,
        modifierGroups: [],
      });

      const data = createMenuData([item]);

      render(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith(
          "/r/test-bakery/menu",
          { scroll: false }
        );
      });
    });

    it("should handle multiple different items when searchParams changes (simulating navigation)", async () => {
      // First item
      const item1 = createMenuItem({
        id: "item-bread",
        name: "Sourdough Bread",
        hasModifiers: false,
        modifierGroups: [],
      });

      const item2 = createMenuItem({
        id: "item-croissant",
        name: "Croissant",
        hasModifiers: false,
        modifierGroups: [],
      });

      const data = createMenuData([item1, item2]);

      // First navigation: add item-bread
      const params1 = new URLSearchParams();
      params1.set("addItem", "item-bread");
      setMockSearchParams(params1);

      const { rerender } = render(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      await waitFor(() => {
        expect(mockAddItem).toHaveBeenCalledWith(
          expect.objectContaining({ menuItemId: "item-bread" })
        );
        expect(mockToastSuccess).toHaveBeenCalledWith("Sourdough Bread added to cart");
        // URL should be cleaned up
        expect(mockRouterReplace).toHaveBeenCalledWith(
          "/r/test-bakery/menu",
          { scroll: false }
        );
      });

      // Clear mocks to verify second call
      mockAddItem.mockClear();
      mockToastSuccess.mockClear();
      mockRouterReplace.mockClear();

      // Second navigation: user went back to website and clicked different item
      const params2 = new URLSearchParams();
      params2.set("addItem", "item-croissant");
      setMockSearchParams(params2);

      // Re-render to simulate navigation (component stays mounted but searchParams changes)
      rerender(<MenuPageClient data={data} merchantSlug="test-bakery" />);

      await waitFor(() => {
        expect(mockAddItem).toHaveBeenCalledWith(
          expect.objectContaining({ menuItemId: "item-croissant" })
        );
        expect(mockToastSuccess).toHaveBeenCalledWith("Croissant added to cart");
      });
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
