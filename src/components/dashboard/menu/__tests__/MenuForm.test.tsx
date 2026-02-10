import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MenuForm } from "../MenuForm";
import type { MenuInfo } from "@/services/menu/menu.types";

// Mock the server actions
vi.mock("@/app/(dashboard)/dashboard/(protected)/menu/actions", () => ({
  createMenuAction: vi.fn(),
  updateMenuAction: vi.fn(),
  deleteMenuAction: vi.fn(),
}));

// Import mocked functions for assertions
import {
  createMenuAction,
  updateMenuAction,
  deleteMenuAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";

describe("MenuForm", () => {
  const mockMenu: MenuInfo = {
    id: "menu-1",
    name: "Main Menu",
    description: "The main menu",
    sortOrder: 0,
    status: "active",
  };

  const defaultProps = {
    menu: null as MenuInfo | null,
    onClose: vi.fn(),
    canDelete: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createMenuAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (updateMenuAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (deleteMenuAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  });

  describe("Create Mode", () => {
    it("should render create form with correct title", () => {
      render(<MenuForm {...defaultProps} />);

      expect(screen.getByText("Add Menu")).toBeInTheDocument();
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    it("should have empty form fields", () => {
      render(<MenuForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("");
    });

    it("should not show status field in create mode", () => {
      render(<MenuForm {...defaultProps} />);

      expect(screen.queryByText("Status")).not.toBeInTheDocument();
    });

    it("should not show delete button in create mode", () => {
      render(<MenuForm {...defaultProps} />);

      expect(screen.queryByText("Delete Menu")).not.toBeInTheDocument();
    });

    it("should call createMenuAction on submit", async () => {
      render(<MenuForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Lunch Menu" } });

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: "Available 11am-3pm" } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createMenuAction).toHaveBeenCalledWith({
          name: "Lunch Menu",
          description: "Available 11am-3pm",
        });
      });
    });

    it("should close form after successful creation", async () => {
      const onClose = vi.fn();
      render(<MenuForm {...defaultProps} onClose={onClose} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "New Menu" } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe("Edit Mode", () => {
    it("should render edit form with correct title", () => {
      render(<MenuForm {...defaultProps} menu={mockMenu} />);

      expect(screen.getByText("Edit Menu")).toBeInTheDocument();
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });

    it("should populate form with menu data", () => {
      render(<MenuForm {...defaultProps} menu={mockMenu} />);

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("Main Menu");

      const descInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
      expect(descInput.value).toBe("The main menu");
    });

    it("should not show status field in edit mode (only active status exists)", () => {
      render(<MenuForm {...defaultProps} menu={mockMenu} />);

      // Status field should not be displayed since there's only one status value
      expect(screen.queryByText("Status")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Active")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Hidden")).not.toBeInTheDocument();
    });

    it("should show delete button when canDelete is true", () => {
      render(<MenuForm {...defaultProps} menu={mockMenu} canDelete={true} />);

      expect(screen.getByText("Delete Menu")).toBeInTheDocument();
    });

    it("should not show delete button when canDelete is false", () => {
      render(<MenuForm {...defaultProps} menu={mockMenu} canDelete={false} />);

      expect(screen.queryByText("Delete Menu")).not.toBeInTheDocument();
    });

    it("should call updateMenuAction on submit", async () => {
      render(<MenuForm {...defaultProps} menu={mockMenu} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Updated Menu" } });

      const submitButton = screen.getByText("Save Changes");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(updateMenuAction).toHaveBeenCalledWith("menu-1", {
          name: "Updated Menu",
          description: "The main menu",
        });
      });
    });
  });

  describe("Validation", () => {
    it("should show error when name is empty", () => {
      render(<MenuForm {...defaultProps} />);

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      expect(screen.getByText("Name is required")).toBeInTheDocument();
      expect(createMenuAction).not.toHaveBeenCalled();
    });

    it("should show error when name is whitespace only", () => {
      render(<MenuForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "   " } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      expect(screen.getByText("Name is required")).toBeInTheDocument();
      expect(createMenuAction).not.toHaveBeenCalled();
    });
  });

  describe("Delete", () => {
    it("should call deleteMenuAction on delete with confirmation", async () => {
      render(<MenuForm {...defaultProps} menu={mockMenu} />);

      // Click "Delete Menu" button to open confirm dialog
      const deleteButton = screen.getByText("Delete Menu");
      fireEvent.click(deleteButton);

      // Confirm dialog should appear
      expect(screen.getByText("Are you sure you want to delete this menu? All categories and items in this menu will be hidden.")).toBeInTheDocument();

      // Click the "Delete" confirmation button
      const confirmButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(deleteMenuAction).toHaveBeenCalledWith("menu-1");
      });
    });

    it("should not delete when confirmation is cancelled", () => {
      render(<MenuForm {...defaultProps} menu={mockMenu} />);

      // Click "Delete Menu" button to open confirm dialog
      const deleteButton = screen.getByText("Delete Menu");
      fireEvent.click(deleteButton);

      // Click Cancel inside the confirm dialog (not the main form's Cancel)
      const dialog = screen.getByRole("dialog");
      const cancelButton = dialog.querySelector('button');
      const dialogButtons = dialog.querySelectorAll('button');
      // The Cancel button in the dialog footer (second to last button, after X close)
      const dialogCancelButton = Array.from(dialogButtons).find(
        (btn) => btn.textContent === "Cancel"
      );
      fireEvent.click(dialogCancelButton!);

      expect(deleteMenuAction).not.toHaveBeenCalled();
    });
  });

  describe("Cancel", () => {
    it("should call onClose when clicking Cancel", () => {
      const onClose = vi.fn();
      render(<MenuForm {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking X button", () => {
      const onClose = vi.fn();
      render(<MenuForm {...defaultProps} onClose={onClose} />);

      // Find the X button (it's in the header)
      const closeButtons = screen.getAllByRole("button");
      const xButton = closeButtons.find((btn) => btn.querySelector("svg"));
      fireEvent.click(xButton!);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should display error message when action fails", async () => {
      (createMenuAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Menu name already exists",
      });

      render(<MenuForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Duplicate Name" } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Menu name already exists")).toBeInTheDocument();
      });
    });
  });
});
