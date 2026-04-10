import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeContext";
import { DEFAULT_THEME, THEME_PRESETS } from "@/types/theme";

function ThemeConsumer() {
  const { theme } = useTheme();
  return (
    <div>
      <span data-testid="primary-base">{theme.primary.base}</span>
      {theme.accent && <span data-testid="accent-base">{theme.accent.base}</span>}
    </div>
  );
}

describe("ThemeContext", () => {
  describe("ThemeProvider", () => {
    it("should use DEFAULT_THEME when no theme or preset is provided", () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );
      expect(screen.getByTestId("primary-base")).toHaveTextContent(DEFAULT_THEME.primary.base);
    });

    it("should use custom theme when theme prop is provided", () => {
      const customTheme = {
        primary: {
          base: "120 50% 50%",
          hover: "120 50% 40%",
          light: "120 50% 95%",
          foreground: "0 0% 100%",
        },
      };
      render(
        <ThemeProvider theme={customTheme}>
          <ThemeConsumer />
        </ThemeProvider>
      );
      expect(screen.getByTestId("primary-base")).toHaveTextContent("120 50% 50%");
    });

    it("should use preset theme when preset prop is provided", () => {
      render(
        <ThemeProvider preset="blue">
          <ThemeConsumer />
        </ThemeProvider>
      );
      expect(screen.getByTestId("primary-base")).toHaveTextContent(THEME_PRESETS.blue.primary.base);
    });

    it("should prefer theme prop over preset prop", () => {
      const customTheme = {
        primary: {
          base: "999 99% 99%",
          hover: "999 99% 90%",
          light: "999 99% 99%",
          foreground: "0 0% 100%",
        },
      };
      render(
        <ThemeProvider theme={customTheme} preset="blue">
          <ThemeConsumer />
        </ThemeProvider>
      );
      expect(screen.getByTestId("primary-base")).toHaveTextContent("999 99% 99%");
    });

    it("should fall back to DEFAULT_THEME for invalid preset", () => {
      render(
        <ThemeProvider preset={"invalid" as never}>
          <ThemeConsumer />
        </ThemeProvider>
      );
      expect(screen.getByTestId("primary-base")).toHaveTextContent(DEFAULT_THEME.primary.base);
    });

    it("should set CSS variables on wrapper div", () => {
      const { container } = render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );
      const wrapper = container.querySelector(".contents");
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveStyle({ "--theme-primary": DEFAULT_THEME.primary.base });
    });

    it("should include accent CSS variables when accent is defined", () => {
      const themeWithAccent = {
        primary: {
          base: "0 84% 60%",
          hover: "0 84% 54%",
          light: "0 86% 97%",
          foreground: "0 0% 100%",
        },
        accent: {
          base: "45 100% 50%",
          hover: "45 100% 40%",
          light: "45 100% 95%",
          foreground: "0 0% 0%",
        },
      };
      const { container } = render(
        <ThemeProvider theme={themeWithAccent}>
          <ThemeConsumer />
        </ThemeProvider>
      );
      const wrapper = container.querySelector(".contents");
      expect(wrapper).toHaveStyle({ "--theme-accent": "45 100% 50%" });
    });
  });

  describe("useTheme", () => {
    it("should throw error when used outside ThemeProvider", () => {
      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<ThemeConsumer />)).toThrow(
        "useTheme must be used within ThemeProvider"
      );
      consoleSpy.mockRestore();
    });
  });
});
