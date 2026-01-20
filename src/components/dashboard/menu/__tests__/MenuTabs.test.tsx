import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuTabs } from "../MenuTabs";
import type { MenuInfo } from "@/services/menu/menu.types";

describe("MenuTabs", () => {
  const mockMenus: MenuInfo[] = [
    {
      id: "menu-1",
      name: "Main Menu",
      description: null,
      sortOrder: 0,
      status: "active",
    },
    {
      id: "menu-2",
      name: "Lunch Menu",
      description: "Available 11am-3pm",
      sortOrder: 1,
      status: "active",
    },
    {
      id: "menu-3",
      name: "Hidden Menu",
      description: null,
      sortOrder: 2,
      status: "inactive",
    },
  ];

  const defaultProps = {
    menus: mockMenus,
    selectedMenuId: "menu-1",
    onSelectMenu: vi.fn(),
    onAddMenu: vi.fn(),
    onEditMenu: vi.fn(),
    onReorderMenus: vi.fn(),
  };

  describe("Rendering", () => {
    it("should render all menu tabs", () => {
      render(<MenuTabs {...defaultProps} />);

      expect(screen.getByText("Main Menu")).toBeInTheDocument();
      expect(screen.getByText("Lunch Menu")).toBeInTheDocument();
      expect(screen.getByText("Hidden Menu")).toBeInTheDocument();
    });

    it("should show (hidden) label for inactive menus", () => {
      render(<MenuTabs {...defaultProps} />);

      expect(screen.getByText("(hidden)")).toBeInTheDocument();
    });

    it("should render add menu button", () => {
      render(<MenuTabs {...defaultProps} />);

      expect(screen.getByText("Add Menu")).toBeInTheDocument();
    });

    it("should render drag handles for each menu tab", () => {
      const { container } = render(<MenuTabs {...defaultProps} />);

      // Each menu tab should have a drag handle (GripVertical icon)
      const dragHandles = container.querySelectorAll(".cursor-grab");
      expect(dragHandles).toHaveLength(3);
    });
  });

  describe("Selection", () => {
    it("should apply selected style to current menu", () => {
      const { container } = render(
        <MenuTabs {...defaultProps} selectedMenuId="menu-2" />
      );

      // Find the sortable containers (parent divs of the menu tabs)
      const sortableItems = container.querySelectorAll(".group");

      // First menu should have transparent border (not selected)
      expect(sortableItems[0]).toHaveClass("border-transparent");
      // Second menu should have primary border (selected)
      expect(sortableItems[1]).toHaveClass("border-primary");
    });

    it("should call onSelectMenu when clicking a menu tab", () => {
      const onSelectMenu = vi.fn();
      render(<MenuTabs {...defaultProps} onSelectMenu={onSelectMenu} />);

      const menu2Button = screen.getByText("Lunch Menu");
      fireEvent.click(menu2Button);

      expect(onSelectMenu).toHaveBeenCalledWith("menu-2");
    });
  });

  describe("Add Menu", () => {
    it("should call onAddMenu when clicking add button", () => {
      const onAddMenu = vi.fn();
      render(<MenuTabs {...defaultProps} onAddMenu={onAddMenu} />);

      const addButton = screen.getByText("Add Menu").closest("button");
      fireEvent.click(addButton!);

      expect(onAddMenu).toHaveBeenCalled();
    });
  });

  describe("Edit Menu", () => {
    it("should call onEditMenu when double-clicking a menu tab", () => {
      const onEditMenu = vi.fn();
      render(<MenuTabs {...defaultProps} onEditMenu={onEditMenu} />);

      const menu1Button = screen.getByText("Main Menu");
      fireEvent.doubleClick(menu1Button);

      expect(onEditMenu).toHaveBeenCalledWith(mockMenus[0]);
    });
  });

  describe("Drag and Drop", () => {
    it("should have onReorderMenus callback", () => {
      const onReorderMenus = vi.fn();
      render(<MenuTabs {...defaultProps} onReorderMenus={onReorderMenus} />);

      // The callback should be passed (component renders without error)
      expect(screen.getByText("Main Menu")).toBeInTheDocument();
    });

    it("should render drag handles with cursor-grab class", () => {
      const { container } = render(<MenuTabs {...defaultProps} />);

      const dragHandles = container.querySelectorAll(".cursor-grab");
      expect(dragHandles).toHaveLength(3);

      // Verify they have touch-none for better mobile support
      dragHandles.forEach((handle) => {
        expect(handle).toHaveClass("touch-none");
      });
    });

    it("should have drag handles initially hidden (opacity-0)", () => {
      const { container } = render(<MenuTabs {...defaultProps} />);

      const dragHandles = container.querySelectorAll(".cursor-grab");
      dragHandles.forEach((handle) => {
        expect(handle).toHaveClass("opacity-0");
        expect(handle).toHaveClass("group-hover:opacity-100");
      });
    });

    it("should not trigger onSelectMenu when clicking drag handle", () => {
      const onSelectMenu = vi.fn();
      const { container } = render(
        <MenuTabs {...defaultProps} onSelectMenu={onSelectMenu} />
      );

      const dragHandles = container.querySelectorAll(".cursor-grab");
      fireEvent.click(dragHandles[0]);

      // Should not call onSelectMenu because we stop propagation
      expect(onSelectMenu).not.toHaveBeenCalled();
    });

    it("should wrap menus in sortable context", () => {
      const { container } = render(<MenuTabs {...defaultProps} />);

      // Each menu tab should be draggable (wrapped in sortable div)
      const sortableTabs = container.querySelectorAll(".group");
      expect(sortableTabs).toHaveLength(3);
    });
  });

  describe("Empty State", () => {
    it("should render only add button when no menus", () => {
      render(<MenuTabs {...defaultProps} menus={[]} />);

      expect(screen.getByText("Add Menu")).toBeInTheDocument();
      expect(screen.queryByText("Main Menu")).not.toBeInTheDocument();
    });
  });
});
