import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuItemCard } from "../MenuItemCard";
import { MerchantProvider } from "@/contexts";
import type { MenuItemViewModel } from "@/types/menu-page";
import type { ReactNode } from "react";

function createWrapper(currency: string, locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider config={{ name: "Test Restaurant", logoUrl: null, currency, locale, timezone: "America/New_York" }}>
        {children}
      </MerchantProvider>
    );
  };
}

const mockItem: MenuItemViewModel = {
  id: "item-1",
  name: "Classic Cheese Pizza",
  description: "Our signature pizza with fresh mozzarella",
  price: 18.99,
  imageUrl: "https://example.com/pizza.jpg",
  tags: ["popular"],
  hasModifiers: true,
  modifierGroups: [],
  isAvailable: true,
  taxes: [],
};

describe("MenuItemCard", () => {
  describe("currency formatting", () => {
    it("should display price in USD format", () => {
      const onAddClick = vi.fn();

      render(<MenuItemCard item={mockItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("$18.99")).toBeInTheDocument();
    });

    it("should display price in EUR format with de-DE locale", () => {
      const onAddClick = vi.fn();
      const euroItem = { ...mockItem, price: 100 };

      render(<MenuItemCard item={euroItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("EUR", "de-DE"),
      });

      const priceElement = screen.getByText(/100,00/);
      expect(priceElement).toBeInTheDocument();
      expect(priceElement.textContent).toContain("€");
    });

    it("should display price in CNY format", () => {
      const onAddClick = vi.fn();
      const cnyItem = { ...mockItem, price: 50 };

      render(<MenuItemCard item={cnyItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("CNY", "zh-CN"),
      });

      const priceElement = screen.getByText(/¥50\.00/);
      expect(priceElement).toBeInTheDocument();
    });

    it("should display price in GBP format", () => {
      const onAddClick = vi.fn();
      const gbpItem = { ...mockItem, price: 25.5 };

      render(<MenuItemCard item={gbpItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("GBP", "en-GB"),
      });

      expect(screen.getByText("£25.50")).toBeInTheDocument();
    });

    it("should display price in JPY format without decimals", () => {
      const onAddClick = vi.fn();
      const jpyItem = { ...mockItem, price: 1500 };

      render(<MenuItemCard item={jpyItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("JPY", "ja-JP"),
      });

      const priceElement = screen.getByText(/￥1,500/);
      expect(priceElement).toBeInTheDocument();
    });
  });

  describe("item display", () => {
    it("should display item name and description", () => {
      const onAddClick = vi.fn();

      render(<MenuItemCard item={mockItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Classic Cheese Pizza")).toBeInTheDocument();
      expect(
        screen.getByText("Our signature pizza with fresh mozzarella")
      ).toBeInTheDocument();
    });

    it("should display tags", () => {
      const onAddClick = vi.fn();

      render(<MenuItemCard item={mockItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Popular")).toBeInTheDocument();
    });

    it("should show Add button for available items", () => {
      const onAddClick = vi.fn();

      render(<MenuItemCard item={mockItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Add")).toBeInTheDocument();
    });

    it("should show Unavailable button for unavailable items", () => {
      const onAddClick = vi.fn();
      const unavailableItem = { ...mockItem, isAvailable: false };

      render(<MenuItemCard item={unavailableItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Unavailable")).toBeInTheDocument();
    });

    it("should call onAddClick when Add button is clicked", () => {
      const onAddClick = vi.fn();

      render(<MenuItemCard item={mockItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      fireEvent.click(screen.getByText("Add"));
      expect(onAddClick).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: "item-1",
          imageUrl: "https://example.com/pizza.jpg",
        })
      );
    });
  });

  describe("add button interaction", () => {
    it("should have active scale effect class on button", () => {
      const onAddClick = vi.fn();

      render(<MenuItemCard item={mockItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      const button = screen.getByRole("button");
      expect(button).toHaveClass("active:scale-90");
    });

    it("should allow multiple clicks to add multiple items", () => {
      const onAddClick = vi.fn();

      render(<MenuItemCard item={mockItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onAddClick).toHaveBeenCalledTimes(3);
    });

    it("should not allow clicks on unavailable items", () => {
      const onAddClick = vi.fn();
      const unavailableItem = { ...mockItem, isAvailable: false };

      render(<MenuItemCard item={unavailableItem} onAddClick={onAddClick} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onAddClick).not.toHaveBeenCalled();
    });
  });
});
