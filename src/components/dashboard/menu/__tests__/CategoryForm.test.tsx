import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CategoryForm } from "../CategoryForm";
import type { DashboardCategory } from "@/services/menu/menu.types";

// Mock the server actions
vi.mock("@/app/(dashboard)/dashboard/(protected)/menu/actions", () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
}));

// Import mocked functions for assertions
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";

describe("CategoryForm", () => {
  const mockCategory: DashboardCategory = {
    id: "cat-1",
    name: "Appetizers",
    description: "Start your meal",
    imageUrl: null,
    sortOrder: 0,
    status: "active",
    menuItems: [],
  };

  const defaultProps = {
    menuId: "menu-1",
    category: null as DashboardCategory | null,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createCategoryAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (updateCategoryAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  });

  describe("Create Mode", () => {
    it("should render create form with correct title", () => {
      render(<CategoryForm {...defaultProps} />);

      expect(screen.getByText("Add Category")).toBeInTheDocument();
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    it("should have empty form fields", () => {
      render(<CategoryForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("");
    });

    it("should not show status field in create mode", () => {
      render(<CategoryForm {...defaultProps} />);

      expect(screen.queryByText("Status")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Active")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Hidden")).not.toBeInTheDocument();
    });

    it("should call createCategoryAction on submit", async () => {
      render(<CategoryForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Main Dishes" } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createCategoryAction).toHaveBeenCalledWith({
          menuId: "menu-1",
          name: "Main Dishes",
          description: undefined,
          imageUrl: undefined,
        });
      });
    });

    it("should close form after successful creation", async () => {
      const onClose = vi.fn();
      render(<CategoryForm {...defaultProps} onClose={onClose} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "New Category" } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe("Edit Mode", () => {
    it("should render edit form with correct title", () => {
      render(<CategoryForm {...defaultProps} category={mockCategory} />);

      expect(screen.getByText("Edit Category")).toBeInTheDocument();
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });

    it("should populate form with category data", () => {
      render(<CategoryForm {...defaultProps} category={mockCategory} />);

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("Appetizers");

      const descInput = screen.getByLabelText(/description/i) as HTMLInputElement;
      expect(descInput.value).toBe("Start your meal");
    });

    it("should not show status field in edit mode (only active status exists)", () => {
      render(<CategoryForm {...defaultProps} category={mockCategory} />);

      // Status field should not be displayed since there's only one status value
      expect(screen.queryByText("Status")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Active")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Hidden")).not.toBeInTheDocument();
    });

    it("should call updateCategoryAction on submit", async () => {
      render(<CategoryForm {...defaultProps} category={mockCategory} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Updated Appetizers" } });

      const submitButton = screen.getByText("Save Changes");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(updateCategoryAction).toHaveBeenCalledWith("cat-1", {
          name: "Updated Appetizers",
          description: "Start your meal",
          imageUrl: undefined,
        });
      });
    });
  });

  describe("Validation", () => {
    it("should show error when name is empty", () => {
      render(<CategoryForm {...defaultProps} />);

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      expect(screen.getByText("Name is required")).toBeInTheDocument();
      expect(createCategoryAction).not.toHaveBeenCalled();
    });

    it("should show error when name is whitespace only", () => {
      render(<CategoryForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "   " } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      expect(screen.getByText("Name is required")).toBeInTheDocument();
      expect(createCategoryAction).not.toHaveBeenCalled();
    });
  });

  describe("Cancel", () => {
    it("should call onClose when clicking Cancel", () => {
      const onClose = vi.fn();
      render(<CategoryForm {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking X button", () => {
      const onClose = vi.fn();
      render(<CategoryForm {...defaultProps} onClose={onClose} />);

      // Find the X button (it's in the header)
      const closeButtons = screen.getAllByRole("button");
      const xButton = closeButtons.find((btn) => btn.querySelector("svg"));
      fireEvent.click(xButton!);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should display error message when action fails", async () => {
      (createCategoryAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Category name already exists",
      });

      render(<CategoryForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Duplicate Name" } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Category name already exists")).toBeInTheDocument();
      });
    });

    it("should display fallback error message when action fails without error text", async () => {
      (createCategoryAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "",
      });

      render(<CategoryForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Test" } });

      const submitButton = screen.getByText("Create");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("An error occurred")).toBeInTheDocument();
      });
    });
  });
});
