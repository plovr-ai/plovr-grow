import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

// Global mock for next-intl: returns the key by default.
// Individual test files can override specific namespaces by adding their own vi.mock("next-intl", ...).
vi.mock("next-intl", () => ({
  useTranslations: (_namespace?: string) => (key: string) => key,
  useLocale: () => "en",
  useFormatter: () => ({}),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));
