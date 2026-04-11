import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "src/**/*.integration.test.ts",
      "src/**/*.integration.test.tsx",
      "__tests__/**/*.integration.test.ts",
      "__tests__/**/*.integration.test.tsx",
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Integration tests share a single DB. Running test files in parallel
    // causes Prisma transactions to deadlock on row-level locks (P2034).
    // Serialize files so each one has the DB to itself.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@storefront": path.resolve(__dirname, "./src/app/(storefront)"),
    },
  },
});
