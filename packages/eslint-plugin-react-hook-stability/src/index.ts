import { rule } from "./rules/require-stable-hook-returns.js";
import type { TSESLint } from "@typescript-eslint/utils";

const plugin = {
  meta: {
    name: "@mggarofalo/eslint-plugin-react-hook-stability",
    version: "0.1.0",
  },
  rules: {
    "require-stable-hook-returns": rule,
  },
} satisfies TSESLint.FlatConfig.Plugin;

const configs = {
  recommended: {
    plugins: {
      "react-hook-stability": plugin,
    },
    rules: {
      "react-hook-stability/require-stable-hook-returns": "warn" as const,
    },
  },
};

export default { ...plugin, configs };
