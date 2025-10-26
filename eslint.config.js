import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // Base ESLint recommended rules for all files
  eslint.configs.recommended,

  // TypeScript configuration with type-checking
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.spec.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript rules - errors for real bugs
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // TypeScript rules - warnings for gradual improvement
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // TypeScript rules - disabled
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      // General rules
      "no-console": "off", // CLI app needs console
      "no-mixed-spaces-and-tabs": "off", // Handled by Prettier
    },
  },

  // Basic linting for JavaScript files (no type-checking)
  {
    files: ["**/*.js"],
    extends: [eslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Ignore patterns
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
);
