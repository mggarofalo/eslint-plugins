import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import type { VariableOrigin, VariableOriginKind } from "../types.js";
import { getCalleeName, isHookName } from "./ast-helpers.js";

/**
 * Classify the origin of an init expression in a variable declarator.
 */
export function classifyInit(
  init: TSESTree.Expression | null | undefined,
  variables: Map<string, VariableOrigin>,
): VariableOriginKind {
  if (!init) return "unknown";

  switch (init.type) {
    case AST_NODE_TYPES.Literal:
      return "primitive";

    case AST_NODE_TYPES.TemplateLiteral:
      return "primitive";

    case AST_NODE_TYPES.ArrowFunctionExpression:
    case AST_NODE_TYPES.FunctionExpression:
      return "bare-function";

    case AST_NODE_TYPES.ObjectExpression:
      return "object-literal";

    case AST_NODE_TYPES.ArrayExpression:
      return "array-literal";

    case AST_NODE_TYPES.CallExpression: {
      const callee = getCalleeName(init);
      if (!callee) return "unknown";
      if (callee === "useCallback" || callee === "useMemo") return "stable-hook";
      if (callee === "useRef") return "ref";
      if (isHookName(callee)) return "other-hook";
      return "unknown";
    }

    case AST_NODE_TYPES.Identifier: {
      // Trace through variables
      const origin = variables.get(init.name);
      return origin ? origin.kind : "unknown";
    }

    default:
      return "unknown";
  }
}

/**
 * Process a VariableDeclarator and record all bindings into the variables map.
 * Handles:
 *   const x = expr
 *   const [a, b] = useHook()
 *   const { a, b } = useHook()
 */
export function processDeclarator(
  declarator: TSESTree.VariableDeclarator,
  variables: Map<string, VariableOrigin>,
): void {
  const { id, init } = declarator;

  if (id.type === AST_NODE_TYPES.Identifier) {
    const kind = classifyInit(init, variables);
    variables.set(id.name, { kind, node: init ?? id });
    return;
  }

  // Array destructuring: const [state, setState] = useState()
  if (id.type === AST_NODE_TYPES.ArrayPattern && init) {
    const callee =
      init.type === AST_NODE_TYPES.CallExpression
        ? getCalleeName(init)
        : undefined;

    for (let i = 0; i < id.elements.length; i++) {
      const el = id.elements[i];
      if (!el || el.type !== AST_NODE_TYPES.Identifier) continue;

      let kind: VariableOriginKind;
      if (callee === "useState" && i === 1) {
        kind = "state-setter";
      } else if (callee === "useReducer" && i === 1) {
        kind = "dispatch";
      } else if (callee && isHookName(callee)) {
        kind = "other-hook";
      } else {
        kind = "unknown";
      }
      variables.set(el.name, { kind, node: el });
    }
    return;
  }

  // Object destructuring: const { data, refetch } = useQuery()
  if (id.type === AST_NODE_TYPES.ObjectPattern && init) {
    const callee =
      init.type === AST_NODE_TYPES.CallExpression
        ? getCalleeName(init)
        : undefined;

    for (const prop of id.properties) {
      if (
        prop.type === AST_NODE_TYPES.Property &&
        prop.value.type === AST_NODE_TYPES.Identifier
      ) {
        const kind: VariableOriginKind =
          callee && isHookName(callee) ? "other-hook" : "unknown";
        variables.set(prop.value.name, { kind, node: prop.value });
      }
    }
    return;
  }
}

/**
 * Resolve the stability kind for a return-object property value.
 * Handles inline expressions and identifier lookups.
 */
export function resolveExpressionKind(
  node: TSESTree.Expression,
  variables: Map<string, VariableOrigin>,
): { kind: VariableOriginKind; originNode: TSESTree.Node } {
  switch (node.type) {
    case AST_NODE_TYPES.ArrowFunctionExpression:
    case AST_NODE_TYPES.FunctionExpression:
      return { kind: "bare-function", originNode: node };

    case AST_NODE_TYPES.ObjectExpression:
      return { kind: "object-literal", originNode: node };

    case AST_NODE_TYPES.ArrayExpression:
      return { kind: "array-literal", originNode: node };

    case AST_NODE_TYPES.Literal:
    case AST_NODE_TYPES.TemplateLiteral:
      return { kind: "primitive", originNode: node };

    case AST_NODE_TYPES.CallExpression: {
      const callee = getCalleeName(node);
      if (callee === "useCallback" || callee === "useMemo")
        return { kind: "stable-hook", originNode: node };
      if (callee === "useRef") return { kind: "ref", originNode: node };
      if (callee && isHookName(callee))
        return { kind: "other-hook", originNode: node };
      return { kind: "unknown", originNode: node };
    }

    case AST_NODE_TYPES.Identifier: {
      const origin = variables.get(node.name);
      if (origin) return { kind: origin.kind, originNode: origin.node };
      return { kind: "unknown", originNode: node };
    }

    default:
      return { kind: "unknown", originNode: node };
  }
}
