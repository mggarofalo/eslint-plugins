import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import type { RuleFixer, RuleFix } from "@typescript-eslint/utils/ts-eslint";

/**
 * Ensure that `specifierName` (e.g. "useCallback") is imported from "react".
 * Returns a fix that either adds it to an existing import or creates a new one.
 */
export function ensureReactImport(
  specifierName: string,
  sourceCode: {
    ast: TSESTree.Program;
    getText(node: TSESTree.Node): string;
  },
  fixer: RuleFixer,
): RuleFix | null {
  // Find existing `import { ... } from 'react'`
  for (const node of sourceCode.ast.body) {
    if (
      node.type === AST_NODE_TYPES.ImportDeclaration &&
      node.source.value === "react"
    ) {
      // Check if already imported
      const alreadyImported = node.specifiers.some(
        (s) =>
          s.type === AST_NODE_TYPES.ImportSpecifier &&
          s.imported.type === AST_NODE_TYPES.Identifier &&
          s.imported.name === specifierName,
      );
      if (alreadyImported) return null;

      // Find the last named specifier and add after it
      const namedSpecifiers = node.specifiers.filter(
        (s): s is TSESTree.ImportSpecifier =>
          s.type === AST_NODE_TYPES.ImportSpecifier,
      );
      if (namedSpecifiers.length > 0) {
        const last = namedSpecifiers[namedSpecifiers.length - 1];
        return fixer.insertTextAfter(last, `, ${specifierName}`);
      }

      // Has default import but no named specifiers: `import React from 'react'`
      const defaultSpecifier = node.specifiers.find(
        (s) => s.type === AST_NODE_TYPES.ImportDefaultSpecifier,
      );
      if (defaultSpecifier) {
        return fixer.insertTextAfter(
          defaultSpecifier,
          `, { ${specifierName} }`,
        );
      }

      return null;
    }
  }

  // No react import at all — insert at top of file
  return fixer.insertTextBefore(
    sourceCode.ast.body[0],
    `import { ${specifierName} } from "react";\n`,
  );
}
