// ==================== Theme Types ====================

/**
 * Color configuration for a single color with its variants
 * Uses HSL format for easy manipulation (e.g., "0 84% 60%")
 */
export interface ColorConfig {
  /** Base color value in HSL format without hsl() wrapper */
  base: string;
  /** Hover/darker variant */
  hover: string;
  /** Light variant for backgrounds (badges, tags) */
  light: string;
  /** Foreground color when used on base background */
  foreground: string;
}

/**
 * Complete theme configuration for a merchant
 */
export interface ThemeConfig {
  /** Primary brand color - used for CTAs, buttons, links */
  primary: ColorConfig;
  /** Secondary/accent color - optional, for highlights */
  accent?: ColorConfig;
}

/**
 * Default theme (red) - used when merchant has no custom config
 */
export const DEFAULT_THEME: ThemeConfig = {
  primary: {
    base: "0 84% 60%", // red-600 equivalent
    hover: "0 84% 54%", // red-700 equivalent
    light: "0 86% 97%", // red-50 equivalent
    foreground: "0 0% 100%", // white
  },
};

/**
 * Preset themes for quick merchant selection
 */
export const THEME_PRESETS = {
  red: DEFAULT_THEME,
  blue: {
    primary: {
      base: "221 83% 53%", // blue-600
      hover: "224 76% 48%", // blue-700
      light: "214 100% 97%", // blue-50
      foreground: "0 0% 100%",
    },
  },
  green: {
    primary: {
      base: "142 71% 45%", // green-600
      hover: "142 77% 36%", // green-700
      light: "138 76% 97%", // green-50
      foreground: "0 0% 100%",
    },
  },
  orange: {
    primary: {
      base: "25 95% 53%", // orange-500
      hover: "21 90% 48%", // orange-600
      light: "34 100% 96%", // orange-50
      foreground: "0 0% 100%",
    },
  },
  purple: {
    primary: {
      base: "262 83% 58%", // purple-600
      hover: "263 70% 50%", // purple-700
      light: "270 100% 98%", // purple-50
      foreground: "0 0% 100%",
    },
  },
} as const;

export type ThemePresetName = keyof typeof THEME_PRESETS;
