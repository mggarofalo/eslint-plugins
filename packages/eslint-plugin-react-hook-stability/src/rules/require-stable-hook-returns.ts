import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import type { VariableOriginKind, HookScope } from "../types.js";
import {
  isHookName,
  getFunctionName,
  isFunctionNode,
} from "../utils/ast-helpers.js";
import {
  processDeclarator,
  resolveExpressionKind,
} from "../utils/variable-tracker.js";
import { ensureReactImport } from "../utils/import-manager.js";

const UNSTABLE_KINDS: Set<VariableOriginKind> = new Set([
  "bare-function",
  "object-literal",
  "array-literal",
]);

const MESSAGE_MAP: Record<string, string> = {
  "bare-function": "useCallback",
  "object-literal": "useMemo",
  "array-literal": "useMemo",
};

const createRule = ESLintUtils.RuleCreator(
  () =>
    "https://github.com/mggarofalo/eslint-plugins/tree/main/packages/eslint-plugin-react-hook-stability#require-stable-hook-returns",
);

type MessageIds = "unstableReturn";

export const rule = createRule<[], MessageIds>({
  name: "require-stable-hook-returns",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require that exported custom hooks return stable references (wrapped in useCallback/useMemo)",
    },
    fixable: "code",
    schema: [],
    messages: {
      unstableReturn:
        'Hook "{{hookName}}" returns unstable {{kind}} "{{propName}}". Wrap it in {{wrapper}}.',
    },
  },
  defaultOptions: [],
  create(context) {
    const exportedHookNames = new Set<string>();
    const hookScopeStack: HookScope[] = [];
    const sourceCode = context.sourceCode;

    // We need to track function nodes that correspond to exported hooks so we
    // can push/pop scope. We collect them in Program then match in function visitors.
    const hookFunctionNodes = new Set<TSESTree.Node>();

    function currentScope(): HookScope | undefined {
      return hookScopeStack[hookScopeStack.length - 1];
    }

    /**
     * Pre-scan: collect exported hook names from export declarations.
     */
    function collectExportedHooks(program: TSESTree.Program): void {
      for (const node of program.body) {
        switch (node.type) {
          case AST_NODE_TYPES.ExportNamedDeclaration: {
            // export function useFoo() {}
            if (
              node.declaration?.type === AST_NODE_TYPES.FunctionDeclaration &&
              node.declaration.id &&
              isHookName(node.declaration.id.name)
            ) {
              exportedHookNames.add(node.declaration.id.name);
              hookFunctionNodes.add(node.declaration);
            }
            // export const useFoo = () => {} or export const useFoo = function() {}
            if (
              node.declaration?.type === AST_NODE_TYPES.VariableDeclaration
            ) {
              for (const decl of node.declaration.declarations) {
                if (
                  decl.id.type === AST_NODE_TYPES.Identifier &&
                  isHookName(decl.id.name) &&
                  decl.init &&
                  isFunctionNode(decl.init)
                ) {
                  exportedHookNames.add(decl.id.name);
                  hookFunctionNodes.add(decl.init);
                }
              }
            }
            // export { useFoo }
            for (const spec of node.specifiers) {
              if (
                spec.type === AST_NODE_TYPES.ExportSpecifier &&
                spec.local.type === AST_NODE_TYPES.Identifier &&
                isHookName(spec.local.name)
              ) {
                exportedHookNames.add(spec.local.name);
              }
            }
            break;
          }
          case AST_NODE_TYPES.ExportDefaultDeclaration: {
            // export default function useFoo() {}
            if (
              node.declaration.type === AST_NODE_TYPES.FunctionDeclaration &&
              node.declaration.id &&
              isHookName(node.declaration.id.name)
            ) {
              exportedHookNames.add(node.declaration.id.name);
              hookFunctionNodes.add(node.declaration);
            }
            // export default useFoo (identifier reference — resolved later)
            if (
              node.declaration.type === AST_NODE_TYPES.Identifier &&
              isHookName(node.declaration.name)
            ) {
              exportedHookNames.add(node.declaration.name);
            }
            break;
          }
        }
      }
    }

    /**
     * For `export { useFoo }` and `export default useFoo` patterns,
     * we need to find the actual function declarations/expressions in the program scope.
     */
    function resolveExportedIdentifiers(program: TSESTree.Program): void {
      for (const node of program.body) {
        // function useFoo() { ... } (top-level, referenced by export specifier)
        if (
          node.type === AST_NODE_TYPES.FunctionDeclaration &&
          node.id &&
          exportedHookNames.has(node.id.name) &&
          !hookFunctionNodes.has(node)
        ) {
          hookFunctionNodes.add(node);
        }
        // const useFoo = () => { ... } (top-level, referenced by export specifier)
        if (node.type === AST_NODE_TYPES.VariableDeclaration) {
          for (const decl of node.declarations) {
            if (
              decl.id.type === AST_NODE_TYPES.Identifier &&
              exportedHookNames.has(decl.id.name) &&
              decl.init &&
              isFunctionNode(decl.init) &&
              !hookFunctionNodes.has(decl.init)
            ) {
              hookFunctionNodes.add(decl.init);
            }
          }
        }
      }
    }

    function enterFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void {
      const scope = currentScope();

      // If we're inside a hook scope, increment nesting depth
      if (scope) {
        scope.nestedDepth++;
        return;
      }

      // Check if this function node is an exported hook
      if (hookFunctionNodes.has(node)) {
        const name = getFunctionName(node) ?? "anonymous";
        hookScopeStack.push({
          name,
          variables: new Map(),
          nestedDepth: 0,
        });
      }
    }

    function exitFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void {
      const scope = currentScope();
      if (!scope) return;

      if (scope.nestedDepth > 0) {
        scope.nestedDepth--;
        return;
      }

      // We're exiting the hook function itself
      if (hookFunctionNodes.has(node)) {
        hookScopeStack.pop();
      }
    }

    function analyzeReturnProperties(
      properties: TSESTree.ObjectLiteralElement[],
      scope: HookScope,
    ): void {
      for (const prop of properties) {
        // Skip spread elements — too dynamic
        if (prop.type === AST_NODE_TYPES.SpreadElement) continue;
        if (prop.type !== AST_NODE_TYPES.Property) continue;

        const propName =
          prop.key.type === AST_NODE_TYPES.Identifier
            ? prop.key.name
            : sourceCode.getText(prop.key);

        // For shorthand properties (e.g. { setPage }), the value is the identifier
        const valueNode = prop.value as TSESTree.Expression;
        const { kind, originNode } = resolveExpressionKind(
          valueNode,
          scope.variables,
        );

        if (!UNSTABLE_KINDS.has(kind)) continue;

        const wrapper = MESSAGE_MAP[kind];
        context.report({
          node: prop,
          messageId: "unstableReturn",
          data: {
            hookName: scope.name,
            kind: kind.replace("-", " "),
            propName,
            wrapper,
          },
          fix(fixer) {
            const fixes: ReturnType<typeof fixer.replaceText>[] = [];

            // Wrap the value
            const originText = sourceCode.getText(originNode);
            if (kind === "bare-function") {
              fixes.push(
                fixer.replaceText(
                  originNode,
                  `useCallback(${originText}, [] /* TODO: add dependencies */)`,
                ),
              );
              const importFix = ensureReactImport(
                "useCallback",
                sourceCode,
                fixer,
              );
              if (importFix) fixes.push(importFix);
            } else {
              // object-literal or array-literal
              const needsParens = kind === "object-literal";
              const inner = needsParens ? `(${originText})` : originText;
              fixes.push(
                fixer.replaceText(
                  originNode,
                  `useMemo(() => ${inner}, [] /* TODO: add dependencies */)`,
                ),
              );
              const importFix = ensureReactImport("useMemo", sourceCode, fixer);
              if (importFix) fixes.push(importFix);
            }

            return fixes;
          },
        });
      }
    }

    return {
      Program(node) {
        collectExportedHooks(node);
        resolveExportedIdentifiers(node);
      },

      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      "FunctionExpression:exit": exitFunction,
      "ArrowFunctionExpression:exit": exitFunction,

      VariableDeclarator(node) {
        const scope = currentScope();
        if (!scope || scope.nestedDepth > 0) return;
        processDeclarator(node, scope.variables);
      },

      // Handle hoisted function declarations inside hooks
      // (FunctionDeclaration inside hook body at depth 0 is a local function)
      "FunctionDeclaration[id]"(node: TSESTree.FunctionDeclaration) {
        // This fires before enterFunction increments depth, so check if
        // the parent scope (before push) has this as a nested function.
        // Actually, enterFunction runs first via the same selector. We
        // need to check the scope AFTER enterFunction has run.
        // At this point, if we're inside a hook, nestedDepth was just
        // incremented to 1 by enterFunction. So the current scope has
        // nestedDepth === 1, meaning this is a direct child function declaration.
        const scope = currentScope();
        if (!scope) return;
        if (scope.nestedDepth === 1 && node.id) {
          // This is a function declaration directly inside the hook body
          scope.variables.set(node.id.name, {
            kind: "bare-function",
            node,
          });
        }
      },

      ReturnStatement(node) {
        const scope = currentScope();
        if (!scope || scope.nestedDepth > 0) return;
        if (!node.argument) return;

        let returnObj: TSESTree.ObjectExpression | undefined;

        if (node.argument.type === AST_NODE_TYPES.ObjectExpression) {
          returnObj = node.argument;
        } else if (node.argument.type === AST_NODE_TYPES.Identifier) {
          // Trace through variables to find the object
          const origin = scope.variables.get(node.argument.name);
          if (
            origin &&
            origin.node.type === AST_NODE_TYPES.ObjectExpression
          ) {
            returnObj = origin.node;
          } else if (origin && origin.kind === "object-literal") {
            // The variable was classified as object-literal but the node might
            // be the init which is an ObjectExpression
            if (origin.node.type === AST_NODE_TYPES.ObjectExpression) {
              returnObj = origin.node;
            }
          }
        }

        if (returnObj) {
          analyzeReturnProperties(returnObj.properties, scope);
        }
      },
    };
  },
});
