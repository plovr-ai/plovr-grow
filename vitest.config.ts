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
      exclude: [
        // Repository implementations without unit tests — covered by integration tests
        "src/repositories/catering-order.repository.ts",
        "src/repositories/catering.repository.ts",
        "src/repositories/featured-item.repository.ts",
        "src/repositories/giftcard.repository.ts",
        "src/repositories/invoice.repository.ts",
        "src/repositories/loyalty-config.repository.ts",
        "src/repositories/loyalty-member.repository.ts",
        "src/repositories/menu-category-item.repository.ts",
        "src/repositories/menu.repository.ts",
        "src/repositories/otp-verification.repository.ts",
        "src/repositories/payment.repository.ts",
        "src/repositories/point-transaction.repository.ts",
        "src/repositories/sequence.repository.ts",
      ],
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
