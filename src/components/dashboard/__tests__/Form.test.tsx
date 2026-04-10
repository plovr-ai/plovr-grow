import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import {
  FormField,
  TextField,
  TextareaField,
  PriceField,
  SelectField,
  RadioGroupField,
  CheckboxField,
} from "../Form";

// Helper wrapper with DashboardContext (needed for PriceField which uses useDashboardCurrencySymbol)
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider
      value={{
        tenantId: "tenant-1",
        company: {
          id: "company-1",
          name: "Test Company",
          slug: "test-company",
          logoUrl: null,
        },
        merchants: [],
        currency: "USD",
        locale: "en-US",
        subscription: null,
        onboarding: { status: "not_started" as const, data: null },
      }}
    >
      {children}
    </DashboardProvider>
  );
}

// ============================================================================
// FormField Tests
// ============================================================================

describe("FormField", () => {
  describe("horizontal layout (default)", () => {
    it("renders label and children in grid layout", () => {
      render(
        <FormField id="test" label="Test Label">
          <input data-testid="child-input" />
        </FormField>
      );

      expect(screen.getByText("Test Label")).toBeInTheDocument();
      expect(screen.getByTestId("child-input")).toBeInTheDocument();
    });

    it("renders required indicator when required is true", () => {
      render(
        <FormField id="test" label="Test Label" required>
          <input />
        </FormField>
      );

      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("renders error message when error is provided", () => {
      render(
        <FormField id="test" label="Test Label" error="This field is required">
          <input />
        </FormField>
      );

      expect(screen.getByText("This field is required")).toBeInTheDocument();
    });

    it("does not render error message when error is undefined", () => {
      render(
        <FormField id="test" label="Test Label">
          <input />
        </FormField>
      );

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it("applies custom labelWidth", () => {
      const { container } = render(
        <FormField id="test" label="Test Label" labelWidth={150}>
          <input />
        </FormField>
      );

      const gridElement = container.firstChild as HTMLElement;
      expect(gridElement.style.gridTemplateColumns).toBe("150px 1fr");
    });

    it("uses items-start when alignTop is true", () => {
      const { container } = render(
        <FormField id="test" label="Test Label" alignTop>
          <textarea />
        </FormField>
      );

      const gridElement = container.firstChild as HTMLElement;
      expect(gridElement.className).toContain("items-start");
    });
  });

  describe("vertical layout", () => {
    it("renders label above children", () => {
      const { container } = render(
        <FormField id="test" label="Test Label" layout="vertical">
          <input data-testid="child-input" />
        </FormField>
      );

      expect(screen.getByText("Test Label")).toBeInTheDocument();
      expect(screen.getByTestId("child-input")).toBeInTheDocument();
      expect(container.firstChild).toHaveClass("space-y-2");
    });
  });

  describe("no label", () => {
    it("renders without label structure when label is empty", () => {
      const { container } = render(
        <FormField id="test" label="">
          <input data-testid="child-input" />
        </FormField>
      );

      expect(screen.queryByRole("label")).not.toBeInTheDocument();
      expect(screen.getByTestId("child-input")).toBeInTheDocument();
      // Should not have grid layout
      expect(container.firstChild).not.toHaveClass("grid");
    });

    it("renders error message when label is empty and error is provided", () => {
      render(
        <FormField id="test" label="" error="Something went wrong">
          <input data-testid="child-input" />
        </FormField>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("vertical layout", () => {
    it("renders required indicator and error in vertical layout", () => {
      render(
        <FormField id="test" label="Field" layout="vertical" required error="Required field">
          <input data-testid="child-input" />
        </FormField>
      );

      expect(screen.getByText("*")).toBeInTheDocument();
      expect(screen.getByText("Required field")).toBeInTheDocument();
    });
  });
});

// ============================================================================
// TextField Tests
// ============================================================================

describe("TextField", () => {
  it("renders input with label", () => {
    render(
      <TextField
        id="name"
        label="Name"
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("calls onChange with input value", () => {
    const handleChange = vi.fn();
    render(
      <TextField
        id="name"
        label="Name"
        value=""
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "test value" },
    });

    expect(handleChange).toHaveBeenCalledWith("test value");
  });

  it("renders with correct input type", () => {
    render(
      <TextField
        id="email"
        label="Email"
        type="email"
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });

  it("renders password input", () => {
    render(
      <TextField
        id="password"
        label="Password"
        type="password"
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("renders number input with step and min", () => {
    render(
      <TextField
        id="quantity"
        label="Quantity"
        type="number"
        step="1"
        min={0}
        value=""
        onChange={() => {}}
      />
    );

    const input = screen.getByLabelText("Quantity");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("step", "1");
    expect(input).toHaveAttribute("min", "0");
  });

  it("renders placeholder", () => {
    render(
      <TextField
        id="name"
        label="Name"
        value=""
        onChange={() => {}}
        placeholder="Enter your name"
      />
    );

    expect(screen.getByPlaceholderText("Enter your name")).toBeInTheDocument();
  });

  it("renders as disabled", () => {
    render(
      <TextField
        id="name"
        label="Name"
        value=""
        onChange={() => {}}
        disabled
      />
    );

    expect(screen.getByLabelText("Name")).toBeDisabled();
  });

  it("shows error message", () => {
    render(
      <TextField
        id="name"
        label="Name"
        value=""
        onChange={() => {}}
        error="Name is required"
      />
    );

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("shows required indicator", () => {
    render(
      <TextField
        id="name"
        label="Name"
        value=""
        onChange={() => {}}
        required
      />
    );

    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows helper text when no error", () => {
    render(
      <TextField
        id="password"
        label="Password"
        value=""
        onChange={() => {}}
        helperText="Must be at least 8 characters"
      />
    );

    expect(screen.getByText("Must be at least 8 characters")).toBeInTheDocument();
  });

  it("hides helper text when error is shown", () => {
    render(
      <TextField
        id="password"
        label="Password"
        value=""
        onChange={() => {}}
        helperText="Must be at least 8 characters"
        error="Password is too short"
      />
    );

    expect(screen.queryByText("Must be at least 8 characters")).not.toBeInTheDocument();
    expect(screen.getByText("Password is too short")).toBeInTheDocument();
  });
});

// ============================================================================
// TextareaField Tests
// ============================================================================

describe("TextareaField", () => {
  it("renders textarea with label", () => {
    render(
      <TextareaField
        id="description"
        label="Description"
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Description").tagName).toBe("TEXTAREA");
  });

  it("calls onChange with textarea value", () => {
    const handleChange = vi.fn();
    render(
      <TextareaField
        id="description"
        label="Description"
        value=""
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "test description" },
    });

    expect(handleChange).toHaveBeenCalledWith("test description");
  });

  it("renders with custom rows", () => {
    render(
      <TextareaField
        id="description"
        label="Description"
        value=""
        onChange={() => {}}
        rows={5}
      />
    );

    expect(screen.getByLabelText("Description")).toHaveAttribute("rows", "5");
  });

  it("renders as disabled", () => {
    render(
      <TextareaField
        id="description"
        label="Description"
        value=""
        onChange={() => {}}
        disabled
      />
    );

    expect(screen.getByLabelText("Description")).toBeDisabled();
  });
});

// ============================================================================
// PriceField Tests
// ============================================================================

describe("PriceField", () => {
  it("renders input with currency symbol", () => {
    render(
      <Wrapper>
        <PriceField
          id="price"
          label="Price"
          value=""
          onChange={() => {}}
        />
      </Wrapper>
    );

    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByLabelText("Price")).toBeInTheDocument();
  });

  it("renders number input with step and min", () => {
    render(
      <Wrapper>
        <PriceField
          id="price"
          label="Price"
          value=""
          onChange={() => {}}
        />
      </Wrapper>
    );

    const input = screen.getByLabelText("Price");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("step", "0.01");
    expect(input).toHaveAttribute("min", "0");
  });

  it("calls onChange with input value", () => {
    const handleChange = vi.fn();
    render(
      <Wrapper>
        <PriceField
          id="price"
          label="Price"
          value=""
          onChange={handleChange}
        />
      </Wrapper>
    );

    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "9.99" },
    });

    expect(handleChange).toHaveBeenCalledWith("9.99");
  });

  it("renders as disabled", () => {
    render(
      <Wrapper>
        <PriceField
          id="price"
          label="Price"
          value=""
          onChange={() => {}}
          disabled
        />
      </Wrapper>
    );

    expect(screen.getByLabelText("Price")).toBeDisabled();
  });

  it("shows error message", () => {
    render(
      <Wrapper>
        <PriceField
          id="price"
          label="Price"
          value=""
          onChange={() => {}}
          error="Price is required"
        />
      </Wrapper>
    );

    expect(screen.getByText("Price is required")).toBeInTheDocument();
  });
});

// ============================================================================
// SelectField Tests
// ============================================================================

describe("SelectField", () => {
  const options = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
  ];

  it("renders select with label", () => {
    render(
      <SelectField
        id="category"
        label="Category"
        value=""
        onChange={() => {}}
        options={options}
      />
    );

    expect(screen.getByLabelText("Category")).toBeInTheDocument();
  });

  it("renders all options", () => {
    render(
      <SelectField
        id="category"
        label="Category"
        value=""
        onChange={() => {}}
        options={options}
      />
    );

    expect(screen.getByRole("option", { name: "Option 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Option 2" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Option 3" })).toBeInTheDocument();
  });

  it("calls onChange with selected value", () => {
    const handleChange = vi.fn();
    render(
      <SelectField
        id="category"
        label="Category"
        value="option1"
        onChange={handleChange}
        options={options}
      />
    );

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "option2" },
    });

    expect(handleChange).toHaveBeenCalledWith("option2");
  });

  it("renders as disabled", () => {
    render(
      <SelectField
        id="category"
        label="Category"
        value=""
        onChange={() => {}}
        options={options}
        disabled
      />
    );

    expect(screen.getByLabelText("Category")).toBeDisabled();
  });

  it("shows error message", () => {
    render(
      <SelectField
        id="category"
        label="Category"
        value=""
        onChange={() => {}}
        options={options}
        error="Please select a category"
      />
    );

    expect(screen.getByText("Please select a category")).toBeInTheDocument();
  });

  it("shows helper text when no error", () => {
    render(
      <SelectField
        id="category"
        label="Category"
        value=""
        onChange={() => {}}
        options={options}
        helperText="Select a category for this item"
      />
    );

    expect(screen.getByText("Select a category for this item")).toBeInTheDocument();
  });

  it("hides helper text when error is shown", () => {
    render(
      <SelectField
        id="category"
        label="Category"
        value=""
        onChange={() => {}}
        options={options}
        helperText="Select a category for this item"
        error="Category is required"
      />
    );

    expect(screen.queryByText("Select a category for this item")).not.toBeInTheDocument();
    expect(screen.getByText("Category is required")).toBeInTheDocument();
  });

  it("works with readonly options array", () => {
    const readonlyOptions = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ] as const;

    render(
      <SelectField
        id="test"
        label="Test"
        value=""
        onChange={() => {}}
        options={readonlyOptions}
      />
    );

    expect(screen.getByRole("option", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "B" })).toBeInTheDocument();
  });
});

// ============================================================================
// RadioGroupField Tests
// ============================================================================

describe("RadioGroupField", () => {
  const options = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  it("renders radio buttons with label", () => {
    render(
      <RadioGroupField
        id="status"
        name="status"
        label="Status"
        value=""
        onChange={() => {}}
        options={options}
      />
    );

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Active")).toBeInTheDocument();
    expect(screen.getByLabelText("Inactive")).toBeInTheDocument();
  });

  it("selects the correct radio button", () => {
    render(
      <RadioGroupField
        id="status"
        name="status"
        label="Status"
        value="active"
        onChange={() => {}}
        options={options}
      />
    );

    expect(screen.getByLabelText("Active")).toBeChecked();
    expect(screen.getByLabelText("Inactive")).not.toBeChecked();
  });

  it("calls onChange with selected value", () => {
    const handleChange = vi.fn();
    render(
      <RadioGroupField
        id="status"
        name="status"
        label="Status"
        value="active"
        onChange={handleChange}
        options={options}
      />
    );

    fireEvent.click(screen.getByLabelText("Inactive"));

    expect(handleChange).toHaveBeenCalledWith("inactive");
  });

  it("renders all radio buttons as disabled", () => {
    render(
      <RadioGroupField
        id="status"
        name="status"
        label="Status"
        value=""
        onChange={() => {}}
        options={options}
        disabled
      />
    );

    expect(screen.getByLabelText("Active")).toBeDisabled();
    expect(screen.getByLabelText("Inactive")).toBeDisabled();
  });

  it("shows error message", () => {
    render(
      <RadioGroupField
        id="status"
        name="status"
        label="Status"
        value=""
        onChange={() => {}}
        options={options}
        error="Please select a status"
      />
    );

    expect(screen.getByText("Please select a status")).toBeInTheDocument();
  });
});

// ============================================================================
// CheckboxField Tests
// ============================================================================

describe("CheckboxField", () => {
  it("renders checkbox with label", () => {
    render(
      <CheckboxField
        id="terms"
        label="Terms"
        checked={false}
        onChange={() => {}}
        checkboxLabel="I agree to the terms"
      />
    );

    expect(screen.getByText("Terms")).toBeInTheDocument();
    expect(screen.getByLabelText("I agree to the terms")).toBeInTheDocument();
  });

  it("renders as checked", () => {
    render(
      <CheckboxField
        id="terms"
        label="Terms"
        checked={true}
        onChange={() => {}}
        checkboxLabel="I agree"
      />
    );

    expect(screen.getByLabelText("I agree")).toBeChecked();
  });

  it("renders as unchecked", () => {
    render(
      <CheckboxField
        id="terms"
        label="Terms"
        checked={false}
        onChange={() => {}}
        checkboxLabel="I agree"
      />
    );

    expect(screen.getByLabelText("I agree")).not.toBeChecked();
  });

  it("calls onChange with new checked state", () => {
    const handleChange = vi.fn();
    render(
      <CheckboxField
        id="terms"
        label="Terms"
        checked={false}
        onChange={handleChange}
        checkboxLabel="I agree"
      />
    );

    fireEvent.click(screen.getByLabelText("I agree"));

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("renders as disabled", () => {
    render(
      <CheckboxField
        id="terms"
        label="Terms"
        checked={false}
        onChange={() => {}}
        checkboxLabel="I agree"
        disabled
      />
    );

    expect(screen.getByLabelText("I agree")).toBeDisabled();
  });

  it("shows error message", () => {
    render(
      <CheckboxField
        id="terms"
        label="Terms"
        checked={false}
        onChange={() => {}}
        checkboxLabel="I agree"
        error="You must agree to the terms"
      />
    );

    expect(screen.getByText("You must agree to the terms")).toBeInTheDocument();
  });

  it("renders without checkboxLabel", () => {
    render(
      <CheckboxField
        id="terms"
        label="Terms"
        checked={false}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
