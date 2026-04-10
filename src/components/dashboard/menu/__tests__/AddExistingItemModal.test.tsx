import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { AddExistingItemModal } from "../AddExistingItemModal";
import type { AvailableItem } from "@/services/menu/menu.types";

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
const mockGetAvailableItemsAction = vi.fn();
const mockLinkItemToCategoryAction = vi.fn();

vi.mock("@/app/(dashboard)/dashboard/(protected)/menu/actions", () => ({
  getAvailableItemsAction: (...args: unknown[]) => mockGetAvailableItemsAction(...args),
  linkItemToCategoryAction: (...args: unknown[]) => mockLinkItemToCategoryAction(...args),
}));

describe("AddExistingItemModal", () => {
  const mockAvailableItems: AvailableItem[] = [
    {
      id: "item-1",
      name: "Spring Rolls",
      description: "Crispy vegetable rolls",
      price: 8.99,
      imageUrl: "/images/spring-rolls.jpg",
      categoryNames: ["Appetizers"],
    },
    {
      id: "item-2",
      name: "Fried Rice",
      description: "Classic fried rice with vegetables",
      price: 12.99,
      imageUrl: null,
      categoryNames: ["Main Dishes", "Lunch Specials"],
    },
    {
      id: "item-3",
      name: "Green Tea",
      description: null,
      price: 3.50,
      imageUrl: null,
      categoryNames: [],
    },
  ];

  const defaultProps = {
    categoryId: "cat-1",
    categoryName: "Desserts",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    mockGetAvailableItemsAction.mockClear();
    mockLinkItemToCategoryAction.mockClear();
    defaultProps.onClose.mockClear();
  });

  describe("Loading State", () => {
    it("should show loading spinner while fetching items", async () => {
      mockGetAvailableItemsAction.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      // Look for the animate-spin class on an element
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeTruthy();
    });

    it("should fetch available items on mount", async () => {
      mockGetAvailableItemsAction.mockResolvedValue({
        success: true,
        data: mockAvailableItems,
      });

      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(mockGetAvailableItemsAction).toHaveBeenCalledWith("cat-1");
      });
    });
  });

  describe("Display", () => {
    beforeEach(() => {
      mockGetAvailableItemsAction.mockResolvedValue({
        success: true,
        data: mockAvailableItems,
      });
    });

    it("should display modal title and category name", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Add Existing Items")).toBeInTheDocument();
      });
      expect(screen.getByText(/Add items to "Desserts"/)).toBeInTheDocument();
    });

    it("should display available items after loading", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });
      expect(screen.getByText("Fried Rice")).toBeInTheDocument();
      expect(screen.getByText("Green Tea")).toBeInTheDocument();
    });

    it("should display item descriptions", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Crispy vegetable rolls")).toBeInTheDocument();
      });
      expect(screen.getByText("Classic fried rice with vegetables")).toBeInTheDocument();
    });

    it("should display item prices", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("$8.99")).toBeInTheDocument();
      });
      expect(screen.getByText("$12.99")).toBeInTheDocument();
      expect(screen.getByText("$3.50")).toBeInTheDocument();
    });

    it("should display category names for items", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("In: Appetizers")).toBeInTheDocument();
      });
      expect(screen.getByText("In: Main Dishes, Lunch Specials")).toBeInTheDocument();
    });

    it("should show empty state when no items available", async () => {
      mockGetAvailableItemsAction.mockResolvedValue({
        success: true,
        data: [],
      });

      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(
          screen.getByText(
            "No items available to add - All items are already in this category"
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Search", () => {
    beforeEach(() => {
      mockGetAvailableItemsAction.mockResolvedValue({
        success: true,
        data: mockAvailableItems,
      });
    });

    it("should filter items by name", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "rice" } });

      expect(screen.queryByText("Spring Rolls")).not.toBeInTheDocument();
      expect(screen.getByText("Fried Rice")).toBeInTheDocument();
      expect(screen.queryByText("Green Tea")).not.toBeInTheDocument();
    });

    it("should filter items by description", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "vegetable" } });

      expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      expect(screen.getByText("Fried Rice")).toBeInTheDocument();
      expect(screen.queryByText("Green Tea")).not.toBeInTheDocument();
    });

    it("should show no results message when search has no matches", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "pizza" } });

      expect(
        screen.getByText("No items match your search - Try a different search term")
      ).toBeInTheDocument();
    });

    it("should be case insensitive", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "SPRING" } });

      expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
    });
  });

  describe("Selection", () => {
    beforeEach(() => {
      mockGetAvailableItemsAction.mockResolvedValue({
        success: true,
        data: mockAvailableItems,
      });
    });

    it("should select item when clicked", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const springRollsButton = screen.getByText("Spring Rolls").closest("button");
      fireEvent.click(springRollsButton!);

      expect(screen.getByText("1 item selected")).toBeInTheDocument();
    });

    it("should deselect item when clicked again", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const springRollsButton = screen.getByText("Spring Rolls").closest("button");
      fireEvent.click(springRollsButton!);
      expect(screen.getByText("1 item selected")).toBeInTheDocument();

      fireEvent.click(springRollsButton!);
      expect(screen.getByText("0 items selected")).toBeInTheDocument();
    });

    it("should allow selecting multiple items", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const springRollsButton = screen.getByText("Spring Rolls").closest("button");
      const friedRiceButton = screen.getByText("Fried Rice").closest("button");

      fireEvent.click(springRollsButton!);
      fireEvent.click(friedRiceButton!);

      expect(screen.getByText("2 items selected")).toBeInTheDocument();
    });

    it("should update Add button text based on selection", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      // Initially shows "Add Item" (disabled)
      expect(screen.getByRole("button", { name: /add.*item/i })).toBeDisabled();

      // Select one item
      const springRollsButton = screen.getByText("Spring Rolls").closest("button");
      fireEvent.click(springRollsButton!);
      expect(screen.getByRole("button", { name: /add 1 item/i })).toBeInTheDocument();

      // Select another item
      const friedRiceButton = screen.getByText("Fried Rice").closest("button");
      fireEvent.click(friedRiceButton!);
      expect(screen.getByRole("button", { name: /add 2 items/i })).toBeInTheDocument();
    });
  });

  describe("Add Items", () => {
    beforeEach(() => {
      mockGetAvailableItemsAction.mockResolvedValue({
        success: true,
        data: mockAvailableItems,
      });
      mockLinkItemToCategoryAction.mockResolvedValue({ success: true });
    });

    it("should disable Add button when no items selected", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add.*item/i });
      expect(addButton).toBeDisabled();
    });

    it("should call linkItemToCategoryAction for each selected item", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      // Select two items
      const springRollsButton = screen.getByText("Spring Rolls").closest("button");
      const friedRiceButton = screen.getByText("Fried Rice").closest("button");
      fireEvent.click(springRollsButton!);
      fireEvent.click(friedRiceButton!);

      // Click Add button
      const addButton = screen.getByRole("button", { name: /add 2 items/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockLinkItemToCategoryAction).toHaveBeenCalledWith("cat-1", "item-1");
        expect(mockLinkItemToCategoryAction).toHaveBeenCalledWith("cat-1", "item-2");
        expect(mockLinkItemToCategoryAction).toHaveBeenCalledTimes(2);
      });
    });

    it("should close modal after successful add", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const springRollsButton = screen.getByText("Spring Rolls").closest("button");
      fireEvent.click(springRollsButton!);

      const addButton = screen.getByRole("button", { name: /add 1 item/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it("should show error when linkItemToCategoryAction fails", async () => {
      mockLinkItemToCategoryAction.mockResolvedValue({
        success: false,
        error: "Failed to link item",
      });

      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const springRollsButton = screen.getByText("Spring Rolls").closest("button");
      fireEvent.click(springRollsButton!);

      const addButton = screen.getByRole("button", { name: /add 1 item/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to link item")).toBeInTheDocument();
      });
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should show Adding... while processing", async () => {
      mockLinkItemToCategoryAction.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const springRollsButton = screen.getByText("Spring Rolls").closest("button");
      fireEvent.click(springRollsButton!);

      const addButton = screen.getByRole("button", { name: /add 1 item/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("Adding...")).toBeInTheDocument();
      });
    });
  });

  describe("Cancel", () => {
    beforeEach(() => {
      mockGetAvailableItemsAction.mockResolvedValue({
        success: true,
        data: mockAvailableItems,
      });
    });

    it("should call onClose when clicking Cancel button", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Spring Rolls")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking X button", async () => {
      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Add Existing Items")).toBeInTheDocument();
      });

      // Find the X button (first button with only an icon)
      const closeButton = screen.getAllByRole("button").find(
        (btn) => btn.querySelector("svg") && !btn.textContent?.trim()
      );
      fireEvent.click(closeButton!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should display error when getAvailableItemsAction fails", async () => {
      mockGetAvailableItemsAction.mockResolvedValue({
        success: false,
        error: "Failed to load items",
      });

      render(<AddExistingItemModal {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Failed to load items")).toBeInTheDocument();
      });
    });
  });
});
