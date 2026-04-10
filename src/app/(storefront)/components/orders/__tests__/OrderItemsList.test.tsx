import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderItemsList } from "../OrderItemsList";
import { MerchantProvider } from "@/contexts";
import type { ReactNode } from "react";
import type { OrderItemData } from "@/types";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider
        config={{
          name: "Test Restaurant",
          logoUrl: null,
          currency: "USD",
          locale: "en-US",
          timezone: "America/New_York",
          tenantId: "test-company-id",
          companySlug: "test-company",
        }}
      >
        {children}
      </MerchantProvider>
    );
  };
}

const mockItems: OrderItemData[] = [
  {
    menuItemId: "item-1",
    name: "Classic Burger",
    price: 12.99,
    quantity: 2,
    selectedModifiers: [],
    totalPrice: 25.98,
  },
  {
    menuItemId: "item-2",
    name: "French Fries",
    price: 4.99,
    quantity: 1,
    selectedModifiers: [
      {
        groupId: "group-1",
        groupName: "Size",
        modifierId: "mod-1",
        modifierName: "Large",
        price: 1.0,
        quantity: 1,
      },
    ],
    specialInstructions: "Extra crispy",
    totalPrice: 5.99,
  },
];

const mockImageMap: Record<string, string | null> = {
  "item-1": "https://example.com/burger.jpg",
  "item-2": "https://example.com/fries.jpg",
};

describe("OrderItemsList", () => {
  describe("imageMap usage", () => {
    it("should display images from imageMap when available", () => {
      render(
        <OrderItemsList items={mockItems} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      // Check that images are rendered with correct src
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute("src", "https://example.com/burger.jpg");
      expect(images[0]).toHaveAttribute("alt", "Classic Burger");
      expect(images[1]).toHaveAttribute("src", "https://example.com/fries.jpg");
      expect(images[1]).toHaveAttribute("alt", "French Fries");
    });

    it("should display placeholder when imageMap has null value", () => {
      const imageMapWithNull: Record<string, string | null> = {
        "item-1": null,
        "item-2": "https://example.com/fries.jpg",
      };

      render(
        <OrderItemsList items={mockItems} imageMap={imageMapWithNull} />,
        { wrapper: createWrapper() }
      );

      // Only one image should be rendered (for item-2)
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute("src", "https://example.com/fries.jpg");
    });

    it("should display placeholder when item not in imageMap", () => {
      const partialImageMap: Record<string, string | null> = {
        "item-1": "https://example.com/burger.jpg",
        // item-2 is missing
      };

      render(
        <OrderItemsList items={mockItems} imageMap={partialImageMap} />,
        { wrapper: createWrapper() }
      );

      // Only one image should be rendered (for item-1)
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute("src", "https://example.com/burger.jpg");
    });

    it("should display all placeholders when imageMap is empty", () => {
      const emptyImageMap: Record<string, string | null> = {};

      render(
        <OrderItemsList items={mockItems} imageMap={emptyImageMap} />,
        { wrapper: createWrapper() }
      );

      // No images should be rendered
      const images = screen.queryAllByRole("img");
      expect(images).toHaveLength(0);

      // Should show placeholder SVGs instead (check for the container divs)
      const placeholders = document.querySelectorAll(".bg-gray-100.flex.items-center.justify-center");
      expect(placeholders.length).toBe(2);
    });
  });

  describe("item display", () => {
    it("should display item names and quantities", () => {
      render(
        <OrderItemsList items={mockItems} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Classic Burger")).toBeInTheDocument();
      expect(screen.getByText("French Fries")).toBeInTheDocument();
      expect(screen.getByText("2x")).toBeInTheDocument();
      expect(screen.getByText("1x")).toBeInTheDocument();
    });

    it("should display item count in header", () => {
      render(
        <OrderItemsList items={mockItems} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      // 2 + 1 = 3 items total
      expect(screen.getByText("Order Items (3 items)")).toBeInTheDocument();
    });

    it("should display singular 'item' for single item", () => {
      const singleItem = [mockItems[0]];
      singleItem[0] = { ...singleItem[0], quantity: 1 };

      render(
        <OrderItemsList items={singleItem} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Order Items (1 item)")).toBeInTheDocument();
    });

    it("should display modifiers when present", () => {
      render(
        <OrderItemsList items={mockItems} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Large")).toBeInTheDocument();
    });

    it("should display special instructions when present", () => {
      render(
        <OrderItemsList items={mockItems} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Extra crispy")).toBeInTheDocument();
    });

    it("should display formatted prices", () => {
      render(
        <OrderItemsList items={mockItems} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("$25.98")).toBeInTheDocument();
      expect(screen.getByText("$5.99")).toBeInTheDocument();
    });
  });
});
