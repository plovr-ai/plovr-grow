import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MenuPanel } from "../MenuPanel";
import type { MenuCategoryWithItems } from "@/services/menu/menu.types";

function makeCategory(
  overrides: Partial<MenuCategoryWithItems> = {}
): MenuCategoryWithItems {
  return {
    id: "cat-1",
    tenantId: "tenant-1",
    menuId: "menu-1",
    name: "Appetizers",
    description: null,
    imageUrl: null,
    sortOrder: 0,
    status: "active",
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    menuItems: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<MenuCategoryWithItems["menuItems"][number]> = {}) {
  return {
    id: "item-1",
    tenantId: "tenant-1",
    name: "Caesar Salad",
    description: null,
    price: 12.5,
    imageUrl: null,
    status: "active",
    nutrition: null,
    tags: [],
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    taxes: [],
    ...overrides,
  };
}

describe("MenuPanel", () => {
  it("renders empty state when no categories", () => {
    render(<MenuPanel categories={[]} />);
    expect(screen.getByText("No menu items available")).toBeInTheDocument();
  });

  it("renders native <img> with original src for items that have imageUrl", () => {
    const categories = [
      makeCategory({
        menuItems: [
          makeItem({
            id: "item-1",
            name: "Margherita Pizza",
            imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400",
          }),
        ],
      }),
    ];

    render(<MenuPanel categories={categories} />);

    const img = screen.getByAltText("Margherita Pizza");
    expect(img.tagName).toBe("IMG");
    // The URL must be passed through verbatim — no /_next/image rewriting.
    expect(img).toHaveAttribute(
      "src",
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400"
    );
  });

  it("does not render an <img> when item has no imageUrl", () => {
    const categories = [
      makeCategory({
        menuItems: [makeItem({ name: "Plain Item", imageUrl: null })],
      }),
    ];

    render(<MenuPanel categories={categories} />);

    expect(screen.getByText("Plain Item")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("formats price using the supplied currency", () => {
    const categories = [
      makeCategory({
        menuItems: [makeItem({ name: "Espresso", price: 4.5 })],
      }),
    ];

    render(<MenuPanel categories={categories} currency="USD" />);
    expect(screen.getByText(/\$4\.50/)).toBeInTheDocument();
  });

  it("renders category name and optional description", () => {
    const categories = [
      makeCategory({
        name: "Mains",
        description: "Hearty dishes",
        menuItems: [makeItem()],
      }),
    ];

    render(<MenuPanel categories={categories} />);
    expect(screen.getByText("Mains")).toBeInTheDocument();
    expect(screen.getByText("Hearty dishes")).toBeInTheDocument();
  });

  it("shows the merchant name in the menu heading when provided", () => {
    const categories = [
      makeCategory({ menuItems: [makeItem()] }),
    ];

    render(
      <MenuPanel categories={categories} merchantName="Burger Shack" />
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Burger Shack's Menu" })
    ).toBeInTheDocument();
  });

  it("falls back to a generic 'Menu' heading when no merchant name is given", () => {
    const categories = [
      makeCategory({ menuItems: [makeItem()] }),
    ];

    render(<MenuPanel categories={categories} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Menu" })
    ).toBeInTheDocument();
  });
});
