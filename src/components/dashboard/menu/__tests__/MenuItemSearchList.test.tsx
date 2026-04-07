import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuItemSearchList } from "../MenuItemSearchList";

interface TestItem {
  id: string;
  name: string;
  description?: string;
}

const mockItems: TestItem[] = [
  { id: "1", name: "Classic Burger", description: "Juicy beef patty" },
  { id: "2", name: "Veggie Burger", description: "Plant-based patty" },
  { id: "3", name: "Chicken Sandwich", description: "Grilled chicken breast" },
];

describe("MenuItemSearchList", () => {
  describe("Search Functionality", () => {
    it("should render search input with placeholder", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={(item, query) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          }
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
          searchPlaceholder="Search menu items..."
        />
      );

      expect(
        screen.getByPlaceholderText("Search menu items...")
      ).toBeInTheDocument();
    });

    it("should filter items using filterFn", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={(item, query) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          }
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "veggie" } });

      expect(screen.getByText("Veggie Burger")).toBeInTheDocument();
      expect(screen.queryByText("Classic Burger")).not.toBeInTheDocument();
      expect(screen.queryByText("Chicken Sandwich")).not.toBeInTheDocument();
    });

    it("should filter by description when filterFn includes description", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={(item, query) =>
            item.name.toLowerCase().includes(query.toLowerCase()) ||
            (item.description?.toLowerCase().includes(query.toLowerCase()) ??
              false)
          }
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "grilled" } });

      expect(screen.getByText("Chicken Sandwich")).toBeInTheDocument();
      expect(screen.queryByText("Classic Burger")).not.toBeInTheDocument();
    });

    it("should be case insensitive", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={(item, query) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          }
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "CLASSIC" } });

      expect(screen.getByText("Classic Burger")).toBeInTheDocument();
    });

    it("should show emptySearchMessage when no matches", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={(item, query) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          }
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
          emptySearchMessage="No items found"
        />
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "xyz123" } });

      expect(screen.getByText("No items found")).toBeInTheDocument();
    });

    it("should clear filter when search is cleared", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={(item, query) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          }
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "veggie" } });
      expect(screen.getByText("Veggie Burger")).toBeInTheDocument();
      expect(screen.queryByText("Classic Burger")).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: "" } });
      expect(screen.getByText("Veggie Burger")).toBeInTheDocument();
      expect(screen.getByText("Classic Burger")).toBeInTheDocument();
    });
  });

  describe("List Rendering", () => {
    it("should render all items when no search query", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={(item, query) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          }
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      expect(screen.getByText("Classic Burger")).toBeInTheDocument();
      expect(screen.getByText("Veggie Burger")).toBeInTheDocument();
      expect(screen.getByText("Chicken Sandwich")).toBeInTheDocument();
    });

    it("should use getItemKey for React keys", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={() => true}
          renderItem={(item) => <div data-testid={item.id}>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      expect(screen.getByTestId("1")).toBeInTheDocument();
      expect(screen.getByTestId("2")).toBeInTheDocument();
      expect(screen.getByTestId("3")).toBeInTheDocument();
    });

    it("should call renderItem for each item", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={() => true}
          renderItem={(item) => (
            <div data-testid="item">
              <span>{item.name}</span>
              <span>{item.description}</span>
            </div>
          )}
          getItemKey={(item) => item.id}
        />
      );

      const items = screen.getAllByTestId("item");
      expect(items).toHaveLength(3);

      expect(screen.getByText("Classic Burger")).toBeInTheDocument();
      expect(screen.getByText("Juicy beef patty")).toBeInTheDocument();
    });
  });

  describe("States", () => {
    it("should show loading spinner when isLoading=true", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          isLoading={true}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      const svg = document.querySelector("svg.animate-spin");
      expect(svg).toBeInTheDocument();
      expect(screen.queryByText("Classic Burger")).not.toBeInTheDocument();
    });

    it("should show emptyMessage when items array is empty", () => {
      render(
        <MenuItemSearchList<TestItem>
          items={[]}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
          emptyMessage="No items available"
        />
      );

      expect(screen.getByText("No items available")).toBeInTheDocument();
    });

    it("should not show loading spinner when isLoading=false", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          isLoading={false}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      const spinner = document.querySelector("svg.animate-spin");
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe("Custom Props", () => {
    it("should apply maxHeight style", () => {
      const { container } = render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
          maxHeight="max-h-[600px]"
        />
      );

      const listContainer = container.querySelector(".max-h-\\[600px\\]");
      expect(listContainer).toBeInTheDocument();
    });

    it("should use default maxHeight when not provided", () => {
      const { container } = render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      const listContainer = container.querySelector(".max-h-\\[500px\\]");
      expect(listContainer).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
          className="custom-wrapper"
        />
      );

      const wrapper = container.querySelector(".custom-wrapper");
      expect(wrapper).toBeInTheDocument();
    });

    it("should apply custom listClassName", () => {
      const { container } = render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
          listClassName="custom-list"
        />
      );

      const list = container.querySelector(".custom-list");
      expect(list).toBeInTheDocument();
    });
  });

  describe("Default Messages", () => {
    it("should use default searchPlaceholder", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      expect(screen.getByPlaceholderText("Search items...")).toBeInTheDocument();
    });

    it("should use default emptyMessage", () => {
      render(
        <MenuItemSearchList<TestItem>
          items={[]}
          filterFn={() => true}
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      expect(screen.getByText("No items available")).toBeInTheDocument();
    });

    it("should use default emptySearchMessage", () => {
      render(
        <MenuItemSearchList
          items={mockItems}
          filterFn={(item, query) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          }
          renderItem={(item) => <div>{item.name}</div>}
          getItemKey={(item) => item.id}
        />
      );

      const searchInput = screen.getByPlaceholderText("Search items...");
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      expect(
        screen.getByText("No items match your search")
      ).toBeInTheDocument();
    });
  });
});
