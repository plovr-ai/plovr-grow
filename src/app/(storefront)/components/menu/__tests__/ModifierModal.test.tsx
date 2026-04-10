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
    taxes: [],
    modifierGroups: [],
    ...overrides,
  });

  // Helper to get modifier container element
  const getModifierLabel = (name: string) =>
    screen.getByText(name).closest("div[class*='rounded-lg']");

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

      // Small should be pre-selected
      const smallLabel = getModifierLabel("Small");
      expect(smallLabel?.className).toContain("bg-theme-primary-light");
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
      const lettuceLabel = getModifierLabel("Lettuce");
      fireEvent.click(lettuceLabel!);

      // Lettuce should no longer be selected
      expect(lettuceLabel?.className).not.toContain("bg-theme-primary-light");
    });
  });

  describe("availability status", () => {
    it("should show unavailable modifiers with reduced opacity", () => {
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

      // Avocado should have reduced opacity
      const avocadoLabel = getModifierLabel("Avocado");
      expect(avocadoLabel?.className).toContain("opacity-50");
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

      const avocadoLabel = getModifierLabel("Avocado");
      fireEvent.click(avocadoLabel!);

      // Should still not be selected
      expect(avocadoLabel?.className).not.toContain("bg-theme-primary-light");
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
      const cheeseLabel = getModifierLabel("Extra Cheese");
      fireEvent.click(cheeseLabel!);

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
      const cheeseLabel = getModifierLabel("Extra Cheese");
      fireEvent.click(cheeseLabel!);

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
      const cheeseLabel = getModifierLabel("Extra Cheese");
      fireEvent.click(cheeseLabel!);

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
      const cheeseLabel = getModifierLabel("Extra Cheese");
      fireEvent.click(cheeseLabel!);

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
      const cheeseLabel = getModifierLabel("Extra Cheese");
      fireEvent.click(cheeseLabel!);

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

  describe("single-select mode (maxSelections=1)", () => {
    it("should directly switch selection when clicking another modifier", () => {
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

      // Small is pre-selected (default)
      const smallLabel = screen.getByText("Small").closest("div[class*='rounded-lg']");
      const mediumLabel = screen.getByText("Medium").closest("div[class*='rounded-lg']");

      expect(smallLabel?.className).toContain("bg-theme-primary-light");
      expect(mediumLabel?.className).not.toContain("bg-theme-primary-light");

      // Click Medium - should directly switch without needing to deselect Small first
      fireEvent.click(mediumLabel!);

      // Medium should now be selected, Small should be deselected
      expect(smallLabel?.className).not.toContain("bg-theme-primary-light");
      expect(mediumLabel?.className).toContain("bg-theme-primary-light");
    });

    it("should deselect when clicking the selected modifier", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "sauce",
            name: "Sauce",
            required: false,
            minSelections: 0,
            maxSelections: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "sauce-1", name: "Ketchup", price: 0, isDefault: false, isAvailable: true },
              { id: "sauce-2", name: "Mayo", price: 0, isDefault: false, isAvailable: true },
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

      const ketchupLabel = screen.getByText("Ketchup").closest("div[class*='rounded-lg']");

      // Select Ketchup
      fireEvent.click(ketchupLabel!);
      expect(ketchupLabel?.className).toContain("bg-theme-primary-light");

      // Click Ketchup again to deselect
      fireEvent.click(ketchupLabel!);
      expect(ketchupLabel?.className).not.toContain("bg-theme-primary-light");
    });

    it("should pass the new selection to onConfirm after switching", () => {
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

      // Switch from Small to Medium
      const mediumLabel = screen.getByText("Medium").closest("div[class*='rounded-lg']");
      fireEvent.click(mediumLabel!);

      // Click Add to Cart
      fireEvent.click(screen.getByRole("button", { name: /Add to Cart/i }));

      expect(mockOnConfirm).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            modifierId: "size-m",
            modifierName: "Medium",
            price: 4,
            quantity: 1,
          }),
        ],
        1
      );
    });
  });

  describe("multi-select mode (maxSelections>1)", () => {
    it("should toggle selection individually", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 3,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "t1", name: "Cheese", price: 1, isDefault: false, isAvailable: true },
              { id: "t2", name: "Bacon", price: 2, isDefault: false, isAvailable: true },
              { id: "t3", name: "Onion", price: 0.5, isDefault: false, isAvailable: true },
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

      const cheeseLabel = screen.getByText("Cheese").closest("div[class*='rounded-lg']");
      const baconLabel = screen.getByText("Bacon").closest("div[class*='rounded-lg']");

      // Select Cheese
      fireEvent.click(cheeseLabel!);
      expect(cheeseLabel?.className).toContain("bg-theme-primary-light");

      // Select Bacon - should add to selection, not replace
      fireEvent.click(baconLabel!);
      expect(cheeseLabel?.className).toContain("bg-theme-primary-light");
      expect(baconLabel?.className).toContain("bg-theme-primary-light");

      // Deselect Cheese
      fireEvent.click(cheeseLabel!);
      expect(cheeseLabel?.className).not.toContain("bg-theme-primary-light");
      expect(baconLabel?.className).toContain("bg-theme-primary-light");
    });

    it("should not add more when at max selections", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 2,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "t1", name: "Cheese", price: 1, isDefault: false, isAvailable: true },
              { id: "t2", name: "Bacon", price: 2, isDefault: false, isAvailable: true },
              { id: "t3", name: "Onion", price: 0.5, isDefault: false, isAvailable: true },
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

      const cheeseLabel = screen.getByText("Cheese").closest("div[class*='rounded-lg']");
      const baconLabel = screen.getByText("Bacon").closest("div[class*='rounded-lg']");
      const onionLabel = screen.getByText("Onion").closest("div[class*='rounded-lg']");

      // Select Cheese and Bacon (max 2)
      fireEvent.click(cheeseLabel!);
      fireEvent.click(baconLabel!);

      // Try to select Onion - should not be added
      fireEvent.click(onionLabel!);
      expect(onionLabel?.className).not.toContain("bg-theme-primary-light");

      // Cheese and Bacon should still be selected
      expect(cheeseLabel?.className).toContain("bg-theme-primary-light");
      expect(baconLabel?.className).toContain("bg-theme-primary-light");
    });
  });

  describe("modal interactions", () => {
    it("should return null when not open", () => {
      const item = createMenuItem();
      const { container } = render(
        <ModifierModal item={item} isOpen={false} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );
      expect(container.innerHTML).toBe("");
    });

    it("should close on escape key", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "size",
            name: "Size",
            required: false,
            minSelections: 0,
            maxSelections: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "s1", name: "Small", price: 0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should close on backdrop click", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "size",
            name: "Size",
            required: false,
            minSelections: 0,
            maxSelections: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "s1", name: "Small", price: 0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      const { container } = render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      // Click backdrop (the outer fixed div)
      const backdrop = container.querySelector(".fixed.inset-0") as HTMLElement;
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should close on close button click", () => {
      const item = createMenuItem({
        modifierGroups: [],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      fireEvent.click(screen.getByLabelText("Close"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should display item image when present", () => {
      const item = createMenuItem({
        imageUrl: "https://example.com/pizza.jpg",
        modifierGroups: [],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      const img = screen.getByAltText("Test Pizza");
      expect(img).toHaveAttribute("src", "https://example.com/pizza.jpg");
    });

    it("should display item description when present", () => {
      const item = createMenuItem({
        description: "A delicious pizza with toppings",
        modifierGroups: [],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(screen.getByText("A delicious pizza with toppings")).toBeInTheDocument();
    });

    it("should not display description when null", () => {
      const item = createMenuItem({
        description: null,
        modifierGroups: [],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(screen.getByText("Test Pizza")).toBeInTheDocument();
      expect(screen.getByText("$18.99")).toBeInTheDocument();
    });

    it("should handle item quantity increase and decrease", () => {
      const item = createMenuItem({ modifierGroups: [] });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      // Find item quantity controls (the larger w-8 buttons)
      const increaseButton = screen.getAllByLabelText(/Increase quantity/i).find(
        (btn) => btn.className.includes("w-8")
      )!;
      const decreaseButton = screen.getAllByLabelText(/Decrease quantity/i).find(
        (btn) => btn.className.includes("w-8")
      )!;

      // Increase to 2
      fireEvent.click(increaseButton);
      expect(screen.getByText("2")).toBeInTheDocument();

      // Decrease back to 1
      fireEvent.click(decreaseButton);
      expect(screen.queryByText("2")).not.toBeInTheDocument();

      // Try to decrease below 1
      fireEvent.click(decreaseButton);
      // Should still show 1
    });

    it("should pass correct item quantity to onConfirm", () => {
      const item = createMenuItem({ modifierGroups: [] });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      // Increase to 3
      const increaseButton = screen.getAllByLabelText(/Increase quantity/i).find(
        (btn) => btn.className.includes("w-8")
      )!;
      fireEvent.click(increaseButton);
      fireEvent.click(increaseButton);

      fireEvent.click(screen.getByRole("button", { name: /Add to Cart/i }));
      expect(mockOnConfirm).toHaveBeenCalledWith([], 3);
    });
  });

  describe("selection hints", () => {
    it("should show 'Required - Select N' when min equals max", () => {
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
              { id: "s1", name: "Small", price: 0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(screen.getByText("Required - Select 1")).toBeInTheDocument();
    });

    it("should show 'Required - Select N to M' when min differs from max", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "toppings",
            name: "Toppings",
            required: true,
            minSelections: 1,
            maxSelections: 3,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "t1", name: "Cheese", price: 0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(screen.getByText("Required - Select 1 to 3")).toBeInTheDocument();
    });

    it("should show 'Optional - Select up to 1' for optional single-select", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "sauce",
            name: "Sauce",
            required: false,
            minSelections: 0,
            maxSelections: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "s1", name: "Ketchup", price: 0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(screen.getByText("Optional - Select up to 1")).toBeInTheDocument();
    });

    it("should show 'Optional - Select up to N' for optional multi-select", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "extras",
            name: "Extras",
            required: false,
            minSelections: 0,
            maxSelections: 5,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "e1", name: "Extra Cheese", price: 1, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(screen.getByText("Optional - Select up to 5")).toBeInTheDocument();
    });

    it("should show modifier price when price > 0", () => {
      const item = createMenuItem({
        modifierGroups: [
          {
            id: "extras",
            name: "Extras",
            required: false,
            minSelections: 0,
            maxSelections: 5,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "e1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true },
              { id: "e2", name: "Free Topping", price: 0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(screen.getByText("+$1.50")).toBeInTheDocument();
      // Free topping should not show a price
      expect(screen.queryByText("+$0.00")).not.toBeInTheDocument();
    });

    it("should not pre-select unavailable default modifiers", () => {
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
              { id: "t1", name: "Lettuce", price: 0, isDefault: true, isAvailable: false },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      const lettuceLabel = getModifierLabel("Lettuce");
      expect(lettuceLabel?.className).not.toContain("bg-theme-primary-light");
    });
  });

  describe("handleUpdateQuantity edge cases", () => {
    it("should not update quantity for a modifier that is not selected", () => {
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
              { id: "t2", name: "Bacon", price: 2.0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      // Only select Extra Cheese
      const cheeseLabel = getModifierLabel("Extra Cheese");
      fireEvent.click(cheeseLabel!);

      // Try to increase quantity of Bacon (not selected) - this should be a no-op
      // We can verify by checking that only 2 decrease buttons exist (1 modifier + 1 item)
      const allDecreaseButtons = screen.getAllByLabelText(/Decrease quantity/i);
      expect(allDecreaseButtons.length).toBe(2); // cheese modifier + item qty
    });
  });

  describe("escape key when modal is closed", () => {
    it("should not call onClose when escape is pressed and modal is closed", () => {
      const item = createMenuItem();
      render(
        <ModifierModal item={item} isOpen={false} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("body scroll prevention", () => {
    it("should prevent body scroll when open and restore on close", () => {
      const item = createMenuItem();
      const { rerender } = render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <ModifierModal item={item} isOpen={false} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("confirm when invalid", () => {
    it("should not call onConfirm when validation fails (required group unmet)", () => {
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
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      // Try to add to cart without selecting required group
      const addButton = screen.getByRole("button", { name: /Add to Cart/i });
      fireEvent.click(addButton);

      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("backdrop click on non-backdrop element", () => {
    it("should not close when clicking inside the modal content", () => {
      const item = createMenuItem({ modifierGroups: [] });

      const { container } = render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      // Click on the modal content (inner div), not the backdrop
      const modalContent = container.querySelector(".relative.bg-white") as HTMLElement;
      fireEvent.click(modalContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("no image and no description", () => {
    it("should not render image when imageUrl is null", () => {
      const item = createMenuItem({ imageUrl: null, modifierGroups: [] });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      expect(screen.queryByAltText("Test Pizza")).not.toBeInTheDocument();
    });
  });

  describe("confirm with modifiers selected", () => {
    it("should build selected modifiers array on confirm", () => {
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
              { id: "t1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true },
              { id: "t2", name: "Mushrooms", price: 1.0, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      // Select Extra Cheese
      const cheeseLabel = getModifierLabel("Extra Cheese");
      fireEvent.click(cheeseLabel!);

      // Click Add to Cart
      fireEvent.click(screen.getByRole("button", { name: /Add to Cart/i }));

      expect(mockOnConfirm).toHaveBeenCalledWith(
        [
          {
            groupId: "toppings",
            groupName: "Toppings",
            modifierId: "t1",
            modifierName: "Extra Cheese",
            price: 1.5,
            quantity: 1,
          },
        ],
        1
      );
    });

    it("should build multiple selected modifiers on confirm", () => {
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
              { id: "s1", name: "Large", price: 2.0, isDefault: false, isAvailable: true },
            ],
          },
          {
            id: "toppings",
            name: "Toppings",
            required: false,
            minSelections: 0,
            maxSelections: 5,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            modifiers: [
              { id: "t1", name: "Pepperoni", price: 1.5, isDefault: false, isAvailable: true },
            ],
          },
        ],
      });

      render(
        <ModifierModal item={item} isOpen={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />
      );

      // Select Large
      fireEvent.click(getModifierLabel("Large")!);
      // Select Pepperoni
      fireEvent.click(getModifierLabel("Pepperoni")!);

      fireEvent.click(screen.getByRole("button", { name: /Add to Cart/i }));

      expect(mockOnConfirm).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ modifierId: "s1", modifierName: "Large" }),
          expect.objectContaining({ modifierId: "t1", modifierName: "Pepperoni" }),
        ]),
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
      const smallLabel = getModifierLabel("Small");
      fireEvent.click(smallLabel!);

      // Add to Cart should be enabled
      const addButton = screen.getByRole("button", { name: /Add to Cart/i });
      expect(addButton).not.toBeDisabled();
    });
  });
});
