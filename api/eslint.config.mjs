// @ts-check
import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import jestPlugin from "eslint-plugin-jest"
import globals from "globals"
import { defineConfig } from "eslint/config"

export default defineConfig(
  {
    ignores: [
      "dist/**",
      ".tmp/**",
      ".cache/**",
      ".strapi/**",
      "node_modules/**",
      "src/admin/**", // Strapi auto-generates this
      "types/generated/**", // Strapi auto-generates this
    ],
  },

  eslint.configs.recommended,

  {
    files: ["**/*.ts", "**/*.js"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-fallthrough": "error",
      "no-unreachable": "error",
      "prefer-template": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-throw-literal": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },

  {
    files: ["test/**/*.ts", "test/**/*.js", "**/*.test.ts", "**/*.test.js"],
    plugins: { jest: jestPlugin },
    languageOptions: {
      globals: { ...jestPlugin.environments.globals.globals },
    },
    rules: {
      ...jestPlugin.configs["flat/recommended"].rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  }
)
