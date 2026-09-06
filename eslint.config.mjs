// @ts-check
import eslint from "@eslint/js"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"
import astroPlugin from "eslint-plugin-astro"
import globals from "globals"
import noInlineSvg from "./eslint-rules/no-inline-svg.js"
import noBannedOpacity from "./eslint-rules/no-banned-opacity.js"

/** @type {import("eslint").Linter.RulesRecord} */
const strictRules = {
  "no-var": "error",
  "prefer-const": "error",
  eqeqeq: ["error", "always", { null: "ignore" }],
  "no-console": ["warn", { allow: ["warn", "error"] }],
  "no-fallthrough": "error",
  "no-unreachable": "error",
  "prefer-template": "error",
  "no-throw-literal": "error",
  "no-await-in-loop": "error",
}

/** @type {import("eslint").Linter.RulesRecord} */
const tsRules = {
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "inline-type-imports" },
  ],
  "@typescript-eslint/no-non-null-assertion": "warn",
}

export default defineConfig(
  {
    ignores: ["dist/**", ".astro/**", "node_modules/**"],
  },

  // Base JS rules for all files
  eslint.configs.recommended,

  // TypeScript rules for .ts/.tsx files
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
      },
    },
    plugins: {
      // @ts-ignore
      local: { rules: { "no-banned-opacity": noBannedOpacity } },
    },
    rules: {
      ...strictRules,
      ...tsRules,
      "local/no-banned-opacity": "error",
    },
  },

  astroPlugin.configs["flat/recommended"],
  astroPlugin.configs["flat/jsx-a11y-recommended"],
  {
    files: ["**/*.astro"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      // @ts-ignore
      local: { rules: { "no-inline-svg": noInlineSvg, "no-banned-opacity": noBannedOpacity } },
    },
    rules: {
      "local/no-inline-svg": ["error", { allowedDir: "src/components/icons" }],
      "local/no-banned-opacity": "error",
      ...strictRules,
      "astro/no-set-html-directive": "error",
      "astro/no-set-text-directive": "error",
      "astro/no-unused-css-selector": "warn",
      "astro/prefer-class-list-directive": "error",
      "astro/prefer-object-class-list": "error",
      "astro/sort-attributes": "error",
      "astro/no-exports-from-components": "error",
    },
  },

  // Node globals for config files at root (astro.config.mjs, etc.)
  {
    files: ["*.mjs", "*.js", "*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
    },
  }
)
