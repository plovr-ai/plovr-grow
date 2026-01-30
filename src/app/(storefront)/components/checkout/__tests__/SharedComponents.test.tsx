import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorAlert } from "../ErrorAlert";
import { PaymentLoadingState } from "../PaymentLoadingState";
import { SubmitButton } from "../SubmitButton";
import { MerchantProvider } from "@/contexts";

// Mock MerchantProvider for SubmitButton (uses useFormatPrice)
const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <MerchantProvider
      config={{
        name: "Test Store",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companySlug: "test",
      }}
    >
      {ui}
    </MerchantProvider>
  );
};

describe("ErrorAlert", () => {
  it("should render nothing when message is null", () => {
    const { container } = render(<ErrorAlert message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render error message when provided", () => {
    render(<ErrorAlert message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    render(<ErrorAlert message="Error" className="mt-4" />);
    const alert = screen.getByText("Error").closest("div");
    expect(alert).toHaveClass("mt-4");
  });

  it("should have red styling", () => {
    render(<ErrorAlert message="Error" />);
    const alert = screen.getByText("Error").closest("div");
    expect(alert).toHaveClass("bg-red-50");
    expect(alert).toHaveClass("border-red-200");
  });
});

describe("PaymentLoadingState", () => {
  it("should render default loading message", () => {
    render(<PaymentLoadingState />);
    expect(screen.getByText("Loading payment form...")).toBeInTheDocument();
  });

  it("should render custom loading message", () => {
    render(<PaymentLoadingState message="Please wait..." />);
    expect(screen.getByText("Please wait...")).toBeInTheDocument();
  });

  it("should show spinner animation", () => {
    const { container } = render(<PaymentLoadingState />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(<PaymentLoadingState className="py-12" />);
    expect(container.firstChild).toHaveClass("py-12");
  });
});

describe("SubmitButton", () => {
  const defaultProps = {
    isSubmitting: false,
    disabled: false,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render button with label", () => {
    renderWithProvider(<SubmitButton {...defaultProps} label="Submit" />);
    expect(screen.getByRole("button")).toHaveTextContent("Submit");
  });

  it("should show amount when provided", () => {
    renderWithProvider(
      <SubmitButton {...defaultProps} label="Pay" amount={99.99} />
    );
    expect(screen.getByRole("button")).toHaveTextContent("Pay");
    expect(screen.getByRole("button")).toHaveTextContent("$99.99");
  });

  it("should show submitting state", () => {
    renderWithProvider(
      <SubmitButton
        {...defaultProps}
        isSubmitting={true}
        submittingLabel="Processing..."
      />
    );
    expect(screen.getByRole("button")).toHaveTextContent("Processing...");
  });

  it("should be disabled when disabled prop is true", () => {
    renderWithProvider(<SubmitButton {...defaultProps} disabled={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should call onClick when clicked", () => {
    const onClick = vi.fn();
    renderWithProvider(<SubmitButton {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should not call onClick when disabled", () => {
    const onClick = vi.fn();
    renderWithProvider(
      <SubmitButton {...defaultProps} onClick={onClick} disabled={true} />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("should render with primary variant (red)", () => {
    renderWithProvider(
      <SubmitButton {...defaultProps} variant="primary" label="Submit" />
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-red-600");
  });

  it("should render with theme variant", () => {
    renderWithProvider(
      <SubmitButton {...defaultProps} variant="theme" label="Submit" />
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-theme-primary");
  });

  it("should render as submit type when specified", () => {
    renderWithProvider(
      <SubmitButton {...defaultProps} type="submit" label="Submit" />
    );
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("should show spinner when submitting", () => {
    const { container } = renderWithProvider(
      <SubmitButton {...defaultProps} isSubmitting={true} />
    );
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});
