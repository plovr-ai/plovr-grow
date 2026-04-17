import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Global unused-vars: allow underscore-prefix convention
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },

  // Project-specific rules
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // 禁止 console，使用 pino logger
      "no-console": "warn",

      // 禁止显式 any
      "@typescript-eslint/no-explicit-any": "error",

      // 本项目使用原生 <img> + CDN 自带图片优化，关闭 next/image 约束
      "@next/next/no-img-element": "off",

      // 禁止 enum，使用 const + as const 或联合类型
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message:
            "Enums are not allowed. Use `const obj = { ... } as const` or union types instead.",
        },
      ],

      // 允许下划线前缀的未使用变量
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },

  // Enforce Repository pattern: Service 和 API Route 禁止直接导入 prisma 默认实例。
  // Named type-only imports (e.g. `import type { DbClient } from "@/lib/db"`)
  // remain allowed because `importNames: ["default"]` only restricts the
  // default export.
  //
  // The ignores list below contains services that are tracked as follow-up
  // work for issue #280 (order + square + stripe-connect have complex
  // transactions that need dedicated migration PRs). Remove entries as their
  // direct prisma usage is migrated to Repositories.
  {
    files: ["src/services/**/*.ts", "src/app/api/**/*.{ts,tsx}"],
    ignores: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.integration.test.ts",
      "src/**/*.integration.test.tsx",
      "src/**/__tests__/**",
      // Follow-up issues tracking migration of each deferred service:
      //   #288 — order.service.ts
      //   #289 — square*.service.ts (3 files)
      //   #290 — stripe-connect.service.ts
      // Remove the corresponding entry below when each migration PR lands.
      "src/services/order/order.service.ts",
      "src/services/square/square.service.ts",
      "src/services/square/square-order.service.ts",
      "src/services/square/square-webhook.service.ts",
      "src/services/stripe-connect/stripe-connect.service.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              importNames: ["default"],
              message:
                "Service 和 API Route 禁止直接导入 prisma；请通过 Repository 访问数据。如需事务编排，使用 runInTransaction from '@/lib/transaction'。",
            },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
