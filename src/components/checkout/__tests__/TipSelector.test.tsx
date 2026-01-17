import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TipSelector } from "../TipSelector";
import { MerchantProvider } from "@/contexts";
import type { TipConfig } from "@/types";
import type { ReactNode } from "react";

function createWrapper(tipConfig?: TipConfig) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider
        config={{
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
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
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
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper(percentageConfig) }
      );

      expect(screen.getByText(/\(\$4\.50\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(\$5\.40\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(\$6\.00\)/)).toBeInTheDocument();
    });

    it("should calculate tip correctly when option is clicked", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper(percentageConfig) }
      );

      fireEvent.click(screen.getByText(/15%/));
      expect(onChange).toHaveBeenCalledWith(4.5);
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
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
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
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
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

    it("should return fixed amount when option is clicked", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper(fixedConfig) }
      );

      fireEvent.click(screen.getByText("$2.00"));
      expect(onChange).toHaveBeenCalledWith(2);
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

    it("should show Custom button when allowCustom is true", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper(configWithCustom) }
      );

      expect(screen.getByText("Custom")).toBeInTheDocument();
    });

    it("should hide Custom button when allowCustom is false", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper(configWithoutCustom) }
      );

      expect(screen.queryByText("Custom")).not.toBeInTheDocument();
    });

    it("should show input when Custom is clicked", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper(configWithCustom) }
      );

      fireEvent.click(screen.getByText("Custom"));
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    it("should update value when custom amount is entered", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper(configWithCustom) }
      );

      fireEvent.click(screen.getByText("Custom"));
      const input = screen.getByPlaceholderText("0.00");
      fireEvent.change(input, { target: { value: "5.50" } });

      expect(onChange).toHaveBeenCalledWith(5.5);
    });
  });

  describe("backward compatibility", () => {
    it("should use default config when tipConfig is not provided", () => {
      const onChange = vi.fn();

      render(
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("None")).toBeInTheDocument();
      expect(screen.getByText(/15%/)).toBeInTheDocument();
      expect(screen.getByText(/18%/)).toBeInTheDocument();
      expect(screen.getByText(/20%/)).toBeInTheDocument();
      expect(screen.getByText("Custom")).toBeInTheDocument();
    });
  });

  describe("selection state", () => {
    it("should highlight the selected option", () => {
      const onChange = vi.fn();
      const config: TipConfig = {
        mode: "percentage",
        tiers: [0.15, 0.2],
        allowCustom: true,
      };

      render(
        <TipSelector subtotal={30} value={4.5} onChange={onChange} />,
        { wrapper: createWrapper(config) }
      );

      const selectedButton = screen.getByText(/15%/).closest("button");
      expect(selectedButton).toHaveClass("border-red-600");
    });

    it("should highlight None when value is 0", () => {
      const onChange = vi.fn();
      const config: TipConfig = {
        mode: "percentage",
        tiers: [0.15, 0.2],
        allowCustom: true,
      };

      render(
        <TipSelector subtotal={30} value={0} onChange={onChange} />,
        { wrapper: createWrapper(config) }
      );

      const noneButton = screen.getByText("None").closest("button");
      expect(noneButton).toHaveClass("border-red-600");
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
        <TipSelector subtotal={30} value={0} onChange={onChange} disabled />,
        { wrapper: createWrapper(config) }
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});
