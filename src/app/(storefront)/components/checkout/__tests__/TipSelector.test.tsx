import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TipSelector } from "../TipSelector";
import { MerchantProvider } from "@/contexts";
import type { TipConfig } from "@/types";
import type { TipInput } from "@/lib/pricing";
import type { ReactNode } from "react";

function createWrapper(tipConfig?: TipConfig) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider
        config={{
          name: "Test Restaurant",
          logoUrl: null,
          currency: "USD",
          locale: "en-US",
          tipConfig,
        }}
      >
        {children}
      </MerchantProvider>
    );
  };
}

describe("TipSelector", () => {
  describe("percentage mode", () => {
    const percentageConfig: TipConfig = {
      mode: "percentage",
      tiers: [0.15, 0.18, 0.2],
      allowCustom: true,
    };

    it("should display percentage labels", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(percentageConfig) }
      );

      expect(screen.getByText("None")).toBeInTheDocument();
      expect(screen.getByText(/15%/)).toBeInTheDocument();
      expect(screen.getByText(/18%/)).toBeInTheDocument();
      expect(screen.getByText(/20%/)).toBeInTheDocument();
    });

    it("should display calculated amounts in parentheses", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(percentageConfig) }
      );

      expect(screen.getByText(/\(\$4\.50\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(\$5\.40\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(\$6\.00\)/)).toBeInTheDocument();
    });

    it("should call onChange with percentage TipInput when option is clicked", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(percentageConfig) }
      );

      fireEvent.click(screen.getByText(/15%/));
      expect(onChange).toHaveBeenCalledWith({ type: "percentage", percentage: 0.15 });
    });
  });

  describe("fixed mode", () => {
    const fixedConfig: TipConfig = {
      mode: "fixed",
      tiers: [1, 2, 3],
      allowCustom: true,
    };

    it("should display fixed amount labels", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(fixedConfig) }
      );

      expect(screen.getByText("None")).toBeInTheDocument();
      expect(screen.getByText("$1.00")).toBeInTheDocument();
      expect(screen.getByText("$2.00")).toBeInTheDocument();
      expect(screen.getByText("$3.00")).toBeInTheDocument();
    });

    it("should not display amounts in parentheses for fixed mode", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(fixedConfig) }
      );

      const buttons = screen.getAllByRole("button");
      const fixedButtons = buttons.filter((btn) =>
        btn.textContent?.includes("$1.00") ||
        btn.textContent?.includes("$2.00") ||
        btn.textContent?.includes("$3.00")
      );

      fixedButtons.forEach((btn) => {
        expect(btn.textContent).not.toMatch(/\(/);
      });
    });

    it("should call onChange with fixed TipInput when option is clicked", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(fixedConfig) }
      );

      fireEvent.click(screen.getByText("$2.00"));
      expect(onChange).toHaveBeenCalledWith({ type: "fixed", amount: 2 });
    });
  });

  describe("custom tip", () => {
    const configWithCustom: TipConfig = {
      mode: "percentage",
      tiers: [0.15, 0.2],
      allowCustom: true,
    };

    const configWithoutCustom: TipConfig = {
      mode: "percentage",
      tiers: [0.15, 0.2],
      allowCustom: false,
    };

    it("should show custom input when allowCustom is true", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(configWithCustom) }
      );

      expect(screen.getByPlaceholderText("Custom")).toBeInTheDocument();
    });

    it("should hide custom input when allowCustom is false", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(configWithoutCustom) }
      );

      expect(screen.queryByPlaceholderText("Custom")).not.toBeInTheDocument();
    });

    it("should call onChange with fixed TipInput when custom amount is entered", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(configWithCustom) }
      );

      const input = screen.getByPlaceholderText("Custom");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "5.50" } });

      expect(onChange).toHaveBeenCalledWith({ type: "fixed", amount: 5.5 });
    });

    it("should call onChange with null when custom input is cleared", () => {
      const onChange = vi.fn();
      const value: TipInput = { type: "fixed", amount: 5 };

      render(
        <TipSelector subtotal={30} value={value} onChange={onChange} />,
        { wrapper: createWrapper(configWithCustom) }
      );

      const input = screen.getByPlaceholderText("Custom");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe("backward compatibility", () => {
    it("should use default config when tipConfig is not provided", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("None")).toBeInTheDocument();
      expect(screen.getByText(/15%/)).toBeInTheDocument();
      expect(screen.getByText(/18%/)).toBeInTheDocument();
      expect(screen.getByText(/20%/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Custom")).toBeInTheDocument();
    });
  });

  describe("selection state", () => {
    it("should highlight the selected percentage option", () => {
      const onChange = vi.fn();
      const config: TipConfig = {
        mode: "percentage",
        tiers: [0.15, 0.2],
        allowCustom: true,
      };
      const value: TipInput = { type: "percentage", percentage: 0.15 };

      render(
        <TipSelector subtotal={30} value={value} onChange={onChange} />,
        { wrapper: createWrapper(config) }
      );

      const selectedButton = screen.getByText(/15%/).closest("button");
      expect(selectedButton).toHaveClass("border-theme-primary");
    });

    it("should highlight None when value is null", () => {
      const onChange = vi.fn();
      const config: TipConfig = {
        mode: "percentage",
        tiers: [0.15, 0.2],
        allowCustom: true,
      };

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} />,
        { wrapper: createWrapper(config) }
      );

      const noneButton = screen.getByText("None").closest("button");
      expect(noneButton).toHaveClass("border-theme-primary");
    });
  });

  describe("disabled state", () => {
    it("should disable all buttons when disabled prop is true", () => {
      const onChange = vi.fn();
      const config: TipConfig = {
        mode: "percentage",
        tiers: [0.15],
        allowCustom: true,
      };

      render(
        <TipSelector subtotal={30} value={null} onChange={onChange} disabled />,
        { wrapper: createWrapper(config) }
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});
