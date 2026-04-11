import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

// Mock next/image to render a plain <img> in tests. next/image normally
// rewrites `src` to `/_next/image?url=...`, which breaks tests that assert
// on the original URL. Rendering a plain img mirrors the pre-migration
// behavior and keeps existing assertions valid.
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    width,
    height,
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    unoptimized: _unoptimized,
    ...rest
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    unoptimized?: boolean;
    [key: string]: unknown;
  }) =>
    React.createElement("img", {
      src,
      alt,
      width,
      height,
      ...rest,
    }),
}));
