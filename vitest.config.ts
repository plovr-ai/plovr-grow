import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.integration.test.ts",
      "**/*.integration.test.tsx",
      ".worktrees/**",
    ],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 97,
        branches: 94,
        functions: 97,
        statements: 97,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@storefront": path.resolve(__dirname, "./src/app/(storefront)"),
    },
  },
});
