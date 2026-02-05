import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrderViewTabs } from "../OrderViewTabs";

describe("OrderViewTabs", () => {
  describe("Rendering", () => {
    it("should render calendar and list tabs", () => {
      render(<OrderViewTabs activeView="calendar" onViewChange={vi.fn()} />);

      expect(screen.getByText("Calendar")).toBeInTheDocument();
      expect(screen.getByText("List")).toBeInTheDocument();
    });

    it("should highlight calendar tab when active", () => {
      render(<OrderViewTabs activeView="calendar" onViewChange={vi.fn()} />);

      const calendarButton = screen.getByText("Calendar").closest("button");
      const listButton = screen.getByText("List").closest("button");

      expect(calendarButton).toHaveClass("bg-white");
      expect(listButton).not.toHaveClass("bg-white");
    });

    it("should highlight list tab when active", () => {
      render(<OrderViewTabs activeView="list" onViewChange={vi.fn()} />);

      const calendarButton = screen.getByText("Calendar").closest("button");
      const listButton = screen.getByText("List").closest("button");

      expect(listButton).toHaveClass("bg-white");
      expect(calendarButton).not.toHaveClass("bg-white");
    });
  });

  describe("Interactions", () => {
    it("should call onViewChange with 'calendar' when calendar tab clicked", () => {
      const onViewChange = vi.fn();
      render(<OrderViewTabs activeView="list" onViewChange={onViewChange} />);

      fireEvent.click(screen.getByText("Calendar"));

      expect(onViewChange).toHaveBeenCalledWith("calendar");
    });

    it("should call onViewChange with 'list' when list tab clicked", () => {
      const onViewChange = vi.fn();
      render(<OrderViewTabs activeView="calendar" onViewChange={onViewChange} />);

      fireEvent.click(screen.getByText("List"));

      expect(onViewChange).toHaveBeenCalledWith("list");
    });

    it("should still call onViewChange when clicking already active tab", () => {
      const onViewChange = vi.fn();
      render(<OrderViewTabs activeView="calendar" onViewChange={onViewChange} />);

      fireEvent.click(screen.getByText("Calendar"));

      expect(onViewChange).toHaveBeenCalledWith("calendar");
    });
  });
});
