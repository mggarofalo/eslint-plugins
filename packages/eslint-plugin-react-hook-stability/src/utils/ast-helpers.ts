import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";

/** Returns true if name matches the React hook naming convention (use + uppercase letter). */
export function isHookName(name: string): boolean {
  return /^use[A-Z]/.test(name);
}

/** Extract callee name from a CallExpression, e.g. `useMemo(...)` → "useMemo". */
export function getCalleeName(
  node: TSESTree.CallExpression,
): string | undefined {
  if (node.callee.type === AST_NODE_TYPES.Identifier) {
    return node.callee.name;
  }
  // e.g. React.useMemo(...)
  if (
    node.callee.type === AST_NODE_TYPES.MemberExpression &&
    node.callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return node.callee.property.name;
  }
  return undefined;
}

/**
 * Get the function name for a function-like node.
 * Handles FunctionDeclaration, named FunctionExpression, and variable-assigned arrows/functions.
 */
export function getFunctionName(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): string | undefined {
  if (
    node.type === AST_NODE_TYPES.FunctionDeclaration &&
    node.id
  ) {
    return node.id.name;
  }
  if (
    node.type === AST_NODE_TYPES.FunctionExpression &&
    node.id
  ) {
    return node.id.name;
  }
  // Check parent: const useFoo = () => { ... }
  if (
    node.parent?.type === AST_NODE_TYPES.VariableDeclarator &&
    node.parent.id.type === AST_NODE_TYPES.Identifier
  ) {
    return node.parent.id.name;
  }
  return undefined;
}

/** Returns true if the node is a function-like (arrow, expression, declaration). */
export function isFunctionNode(
  node: TSESTree.Node,
): node is
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionExpression
  | TSESTree.FunctionDeclaration {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration
  );
}
