export type VariableOriginKind =
  | "stable-hook"
  | "state-setter"
  | "dispatch"
  | "ref"
  | "other-hook"
  | "primitive"
  | "bare-function"
  | "object-literal"
  | "array-literal"
  | "unknown";

export interface VariableOrigin {
  kind: VariableOriginKind;
  /** AST node where the value was defined (for auto-fix) */
  node: import("@typescript-eslint/utils").TSESTree.Node;
}

export interface HookScope {
  name: string;
  variables: Map<string, VariableOrigin>;
  nestedDepth: number;
}
