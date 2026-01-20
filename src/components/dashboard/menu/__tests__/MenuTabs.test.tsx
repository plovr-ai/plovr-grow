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
  });

  describe("Selection", () => {
    it("should apply selected style to current menu", () => {
      render(<MenuTabs {...defaultProps} selectedMenuId="menu-2" />);

      const menu1Button = screen.getByText("Main Menu");
      const menu2Button = screen.getByText("Lunch Menu");

      // Check class names for selected state
      expect(menu2Button).toHaveClass("border-primary");
      expect(menu1Button).toHaveClass("border-transparent");
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

  describe("Empty State", () => {
    it("should render only add button when no menus", () => {
      render(<MenuTabs {...defaultProps} menus={[]} />);

      expect(screen.getByText("Add Menu")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /main menu/i })).not.toBeInTheDocument();
    });
  });
});
