import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: ["node_modules/", "dist/", "coverage/"],
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021
      },
      sourceType: "module"
    },
    plugins: {
      import: importPlugin
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".mjs", ".cjs"]
        }
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "import/no-unresolved": "error",
      "import/extensions": ["error", "always"],
      "no-unused-vars": ["warn", { vars: "all", args: "none" }],
      "no-undef": "error"
    }
  }
];