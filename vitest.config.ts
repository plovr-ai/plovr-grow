import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts", ".worktrees/**"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 99,
        branches: 99,
        functions: 99,
        statements: 99,
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
