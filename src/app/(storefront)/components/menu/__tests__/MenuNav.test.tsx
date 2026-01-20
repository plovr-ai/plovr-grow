import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuNav } from "../MenuNav";

describe("MenuNav", () => {
  const mockMenus = [
    { id: "menu-1", name: "Main Menu" },
    { id: "menu-2", name: "Lunch Menu" },
    { id: "menu-3", name: "Dinner Menu" },
  ];

  const defaultProps = {
    menus: mockMenus,
    currentMenuId: "menu-1",
    onMenuSelect: vi.fn(),
  };

  describe("Conditional Rendering", () => {
    it("should not render when only one menu", () => {
      const { container } = render(
        <MenuNav
          menus={[{ id: "menu-1", name: "Single Menu" }]}
          currentMenuId="menu-1"
          onMenuSelect={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should not render when no menus", () => {
      const { container } = render(
        <MenuNav menus={[]} currentMenuId="" onMenuSelect={vi.fn()} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render when multiple menus exist", () => {
      render(<MenuNav {...defaultProps} />);

      expect(screen.getByText("Main Menu")).toBeInTheDocument();
      expect(screen.getByText("Lunch Menu")).toBeInTheDocument();
      expect(screen.getByText("Dinner Menu")).toBeInTheDocument();
    });
  });

  describe("Selection", () => {
    it("should apply selected style to current menu", () => {
      render(<MenuNav {...defaultProps} currentMenuId="menu-2" />);

      const menu1Button = screen.getByText("Main Menu");
      const menu2Button = screen.getByText("Lunch Menu");

      // Check for primary background on selected
      expect(menu2Button).toHaveClass("bg-theme-primary");
      expect(menu2Button).toHaveClass("text-theme-primary-foreground");

      // Check for gray background on unselected
      expect(menu1Button).toHaveClass("bg-gray-100");
      expect(menu1Button).toHaveClass("text-gray-700");
    });

    it("should call onMenuSelect when clicking a menu", () => {
      const onMenuSelect = vi.fn();
      render(<MenuNav {...defaultProps} onMenuSelect={onMenuSelect} />);

      const lunchButton = screen.getByText("Lunch Menu");
      fireEvent.click(lunchButton);

      expect(onMenuSelect).toHaveBeenCalledWith("menu-2");
    });

    it("should call onMenuSelect with correct menu id", () => {
      const onMenuSelect = vi.fn();
      render(<MenuNav {...defaultProps} onMenuSelect={onMenuSelect} />);

      fireEvent.click(screen.getByText("Main Menu"));
      expect(onMenuSelect).toHaveBeenCalledWith("menu-1");

      fireEvent.click(screen.getByText("Dinner Menu"));
      expect(onMenuSelect).toHaveBeenCalledWith("menu-3");
    });
  });

  describe("Rendering", () => {
    it("should render all menu buttons", () => {
      render(<MenuNav {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);
    });

    it("should display menu names", () => {
      render(<MenuNav {...defaultProps} />);

      mockMenus.forEach((menu) => {
        expect(screen.getByText(menu.name)).toBeInTheDocument();
      });
    });
  });
});
