"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  type ThemeConfig,
  type ThemePresetName,
  DEFAULT_THEME,
  THEME_PRESETS,
} from "@/types/theme";

interface ThemeContextValue {
  theme: ThemeConfig;
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Custom theme configuration */
  theme?: ThemeConfig;
  /** Use a preset theme by name */
  preset?: ThemePresetName;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, theme, preset }: ThemeProviderProps) {
  const resolvedTheme = useMemo<ThemeConfig>(() => {
    if (theme) return theme;
    if (preset && THEME_PRESETS[preset]) return THEME_PRESETS[preset];
    return DEFAULT_THEME;
  }, [theme, preset]);

  // Generate inline style for CSS variables
  const cssVariables = useMemo(
    () =>
      ({
        "--theme-primary": resolvedTheme.primary.base,
        "--theme-primary-hover": resolvedTheme.primary.hover,
        "--theme-primary-light": resolvedTheme.primary.light,
        "--theme-primary-foreground": resolvedTheme.primary.foreground,
        ...(resolvedTheme.accent && {
          "--theme-accent": resolvedTheme.accent.base,
          "--theme-accent-hover": resolvedTheme.accent.hover,
          "--theme-accent-light": resolvedTheme.accent.light,
          "--theme-accent-foreground": resolvedTheme.accent.foreground,
        }),
      }) as React.CSSProperties,
    [resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={{ theme: resolvedTheme }}>
      <div style={cssVariables} className="contents">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
