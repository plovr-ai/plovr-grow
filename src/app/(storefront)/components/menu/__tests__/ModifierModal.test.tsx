import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModifierModal } from "../ModifierModal";
import type { MenuItemViewModel } from "@/types/menu-page";

// Mock useFormatPrice hook
vi.mock("@/hooks", () => ({
  useFormatPrice: () => (price: number) => `$${price.toFixed(2)}`,
}));

describe("ModifierModal", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMenuItem = (
    overrides: Partial<MenuItemViewModel> = {}
  ): MenuItemViewModel => ({
    id: "item-1",
    name: "Test Pizza",
    description: "A delicious pizza",
    price: 18.99,
    imageUrl: null,
    tags: [],
    hasModifiers: true,
    isAvailable: true,
    taxConfigId: null,
    modifierGroups: [],
    ...overrides,
  });

  describe("default selections", () => {
    it("should pre-select modifiers with isDefault=true", () => {
      const item = createMenuItem({
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
              { id: "size-s", name: "Small", price: 0, isDefault: true, isAvailable: true },
              { id: "size-m", name: "Medium", price: 4, isDefault: false, isAvailable: true },
              { id: "size-l", name: "Large", price: 8, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Small should be pre-selected (has checkbox checked)
      const smallButton = screen.getByRole("button", { name: /Small/i });
      expect(smallButton.querySelector('[class*="bg-red-600"]')).toBeTruthy();
    });

    it("should allow deselecting default modifiers", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 5,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "t1", name: "Lettuce", price: 0, isDefault: true, isAvailable: true },
              { id: "t2", name: "Tomato", price: 0, isDefault: true, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Click to deselect Lettuce
      const lettuceButton = screen.getByRole("button", { name: /Lettuce/i });
      fireEvent.click(lettuceButton);

      // Lettuce should no longer be selected
      expect(lettuceButton.querySelector('[class*="bg-red-600"]')).toBeFalsy();
    });
  });

  describe("availability status", () => {
    it("should disable unavailable modifiers", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 5,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "t1", name: "Cheese", price: 1.5, isDefault: false, isAvailable: true },
              { id: "t2", name: "Avocado", price: 2.5, isDefault: false, isAvailable: false, availabilityNote: "Sold out" },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Avocado should show "Sold out"
      expect(screen.getByText(/Sold out/i)).toBeInTheDocument();

      // Avocado button should be disabled
      const avocadoButton = screen.getByRole("button", { name: /Avocado/i });
      expect(avocadoButton).toBeDisabled();
    });

    it("should not allow selecting unavailable modifiers", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 5,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "t1", name: "Avocado", price: 2.5, isDefault: false, isAvailable: false },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const avocadoButton = screen.getByRole("button", { name: /Avocado/i });
      fireEvent.click(avocadoButton);

      // Should still not be selected
      expect(avocadoButton.querySelector('[class*="bg-red-600"]')).toBeFalsy();
    });
  });

  describe("quantity selection", () => {
    // Helper to get modifier quantity controls (smaller buttons inside modifier card)
    const getModifierQuantityControls = () => {
      // Modifier quantity buttons have w-6 class, item quantity buttons have w-8 class
      const allDecreaseButtons = screen.getAllByLabelText(/Decrease quantity/i);
      const allIncreaseButtons = screen.getAllByLabelText(/Increase quantity/i);

      // The modifier quantity buttons are the smaller ones (w-6)
      const modifierDecrease = allDecreaseButtons.find(btn => btn.className.includes("w-6"));
      const modifierIncrease = allIncreaseButtons.find(btn => btn.className.includes("w-6"));

      return { modifierDecrease, modifierIncrease };
    };

    it("should show quantity selector when allowQuantity is true and modifier is selected", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Extra Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 5,
            allowQuantity: true,
            maxQuantityPerModifier: 3,
            modifiers: [
              { id: "t1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Select the modifier
      const cheeseButton = screen.getByRole("button", { name: /Extra Cheese/i });
      fireEvent.click(cheeseButton);

      // Modifier quantity selector should appear (2 decrease buttons: 1 for modifier, 1 for item)
      const allDecreaseButtons = screen.getAllByLabelText(/Decrease quantity/i);
      expect(allDecreaseButtons.length).toBe(2);
    });

    it("should not show modifier quantity selector when allowQuantity is false", () => {
      const item = createMenuItem({
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
              { id: "size-s", name: "Small", price: 0, isDefault: true, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Only item quantity selector should appear (1 decrease button)
      const allDecreaseButtons = screen.getAllByLabelText(/Decrease quantity/i);
      expect(allDecreaseButtons.length).toBe(1);
    });

    it("should increase modifier quantity", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Extra Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 10,
            allowQuantity: true,
            maxQuantityPerModifier: 3,
            modifiers: [
              { id: "t1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Select the modifier
      fireEvent.click(screen.getByRole("button", { name: /Extra Cheese/i }));

      const { modifierIncrease } = getModifierQuantityControls();

      // Increase quantity
      fireEvent.click(modifierIncrease!);

      // Should show quantity 2 (there will be two "1"s - one for item qty, check for "2")
      expect(screen.getByText("2")).toBeInTheDocument();

      // Increase again
      fireEvent.click(modifierIncrease!);
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should not exceed maxQuantityPerModifier", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Extra Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 10,
            allowQuantity: true,
            maxQuantityPerModifier: 2,
            modifiers: [
              { id: "t1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Select the modifier
      fireEvent.click(screen.getByRole("button", { name: /Extra Cheese/i }));

      const { modifierIncrease } = getModifierQuantityControls();

      // Increase to max
      fireEvent.click(modifierIncrease!);
      expect(screen.getByText("2")).toBeInTheDocument();

      // Button should be disabled at max
      expect(modifierIncrease).toBeDisabled();
    });

    it("should remove modifier when quantity decreased to 0", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Extra Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 10,
            allowQuantity: true,
            maxQuantityPerModifier: 3,
            modifiers: [
              { id: "t1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Select the modifier
      fireEvent.click(screen.getByRole("button", { name: /Extra Cheese/i }));

      // Before decrease: 2 decrease buttons (modifier + item)
      expect(screen.getAllByLabelText(/Decrease quantity/i).length).toBe(2);

      const { modifierDecrease } = getModifierQuantityControls();
      fireEvent.click(modifierDecrease!);

      // After decrease to 0: only 1 decrease button (item only)
      expect(screen.getAllByLabelText(/Decrease quantity/i).length).toBe(1);
    });
  });

  describe("onConfirm callback", () => {
    // Helper to get modifier quantity controls (smaller buttons inside modifier card)
    const getModifierQuantityControls = () => {
      const allIncreaseButtons = screen.getAllByLabelText(/Increase quantity/i);
      const modifierIncrease = allIncreaseButtons.find(btn => btn.className.includes("w-6"));
      return { modifierIncrease };
    };

    it("should pass quantity in selectedModifiers", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Extra Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 10,
            allowQuantity: true,
            maxQuantityPerModifier: 3,
            modifiers: [
              { id: "t1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Select the modifier
      fireEvent.click(screen.getByRole("button", { name: /Extra Cheese/i }));

      // Increase quantity to 2
      const { modifierIncrease } = getModifierQuantityControls();
      fireEvent.click(modifierIncrease!);

      // Click Add to Cart
      fireEvent.click(screen.getByRole("button", { name: /Add to Cart/i }));

      expect(mockOnConfirm).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            modifierId: "t1",
            modifierName: "Extra Cheese",
            price: 1.5,
            quantity: 2,
          }),
        ],
        1 // item quantity
      );
    });

    it("should pass quantity=1 for non-quantity modifiers", () => {
      const item = createMenuItem({
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
              { id: "size-s", name: "Small", price: 0, isDefault: true, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Click Add to Cart
      fireEvent.click(screen.getByRole("button", { name: /Add to Cart/i }));

      expect(mockOnConfirm).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            modifierId: "size-s",
            quantity: 1,
          }),
        ],
        1
      );
    });
  });

  describe("validation", () => {
    it("should disable Add to Cart when required group has no selection", () => {
      const item = createMenuItem({
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
              { id: "size-s", name: "Small", price: 0, isDefault: false, isAvailable: true },
              { id: "size-m", name: "Medium", price: 4, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Add to Cart should be disabled
      const addButton = screen.getByRole("button", { name: /Add to Cart/i });
      expect(addButton).toBeDisabled();
    });

    it("should enable Add to Cart when required group has selection", () => {
      const item = createMenuItem({
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
              { id: "size-s", name: "Small", price: 0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal
          item={item}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Select a size
      fireEvent.click(screen.getByRole("button", { name: /Small/i }));

      // Add to Cart should be enabled
      const addButton = screen.getByRole("button", { name: /Add to Cart/i });
      expect(addButton).not.toBeDisabled();
    });
  });
});
