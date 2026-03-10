import { RuleTester } from "@typescript-eslint/rule-tester";
import { rule } from "../../src/rules/require-stable-hook-returns.js";
import { describe, it, afterAll } from "vitest";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("require-stable-hook-returns", rule, {
  valid: [
    // 1. Primitive scalar return (not object/array)
    {
      code: `
export function useToggle() {
  return true;
}`,
    },
    // 2. Internal (non-exported) hook — not checked
    {
      code: `
function useInternal() {
  const handler = () => {};
  return { handler };
}`,
    },
    // 3. Return useMemo-wrapped array via identifier
    {
      code: `
import { useMemo } from "react";
export function useItems() {
  const items = useMemo(() => [1, 2, 3], []);
  return items;
}`,
    },
    // 4. Return useMemo-wrapped object via identifier
    {
      code: `
import { useMemo } from "react";
export function useConfig() {
  const config = useMemo(() => ({ a: 1 }), []);
  return config;
}`,
    },
    // 5. Return inline useMemo call
    {
      code: `
import { useMemo } from "react";
export function useConfig() {
  return useMemo(() => ({ a: 1, b: 2 }), []);
}`,
    },
    // 6. Return another hook's result via identifier
    {
      code: `
export function useWrapper() {
  const result = useSomething();
  return result;
}`,
    },
  ],

  invalid: [
    // === Bare object returns (unstableObjectReturn only — all props stable) ===

    // 7. Primitives + useState setter — wrapper is unstable
    {
      code: `
import { useState } from "react";
export function useCounter() {
  const [count, setCount] = useState(0);
  return { count, setCount };
}`,
      output: `
import { useState, useMemo } from "react";
export function useCounter() {
  const [count, setCount] = useState(0);
  return useMemo(() => ({ count, setCount }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 8. All functions wrapped in useCallback — wrapper still unstable
    {
      code: `
import { useCallback, useState } from "react";
export function useActions() {
  const [val, setVal] = useState(0);
  const increment = useCallback(() => setVal(v => v + 1), []);
  return { increment };
}`,
      output: `
import { useCallback, useState, useMemo } from "react";
export function useActions() {
  const [val, setVal] = useState(0);
  const increment = useCallback(() => setVal(v => v + 1), []);
  return useMemo(() => ({ increment }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 9. Values from useMemo — wrapper still unstable
    {
      code: `
import { useMemo } from "react";
export function useComputed() {
  const data = useMemo(() => ({ a: 1 }), []);
  return { data };
}`,
      output: `
import { useMemo } from "react";
export function useComputed() {
  const data = useMemo(() => ({ a: 1 }), []);
  return useMemo(() => ({ data }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 10. Passthrough of another hook's result in object wrapper
    {
      code: `
export function useWrapper() {
  const result = useSomething();
  return { result };
}`,
      output: `
import { useMemo } from "react";
export function useWrapper() {
  const result = useSomething();
  return useMemo(() => ({ result }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 11. useRef result — wrapper unstable
    {
      code: `
import { useRef } from "react";
export function useMyRef() {
  const ref = useRef(null);
  return { ref };
}`,
      output: `
import { useRef, useMemo } from "react";
export function useMyRef() {
  const ref = useRef(null);
  return useMemo(() => ({ ref }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 12. useReducer dispatch — wrapper unstable
    {
      code: `
import { useReducer } from "react";
export function useMyReducer() {
  const [state, dispatch] = useReducer(reducer, init);
  return { state, dispatch };
}`,
      output: `
import { useReducer, useMemo } from "react";
export function useMyReducer() {
  const [state, dispatch] = useReducer(reducer, init);
  return useMemo(() => ({ state, dispatch }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 13. Object destructuring from hook (useQuery) — wrapper unstable
    {
      code: `
export function useMyQuery() {
  const { data, refetch } = useQuery("key");
  return { data, refetch };
}`,
      output: `
import { useMemo } from "react";
export function useMyQuery() {
  const { data, refetch } = useQuery("key");
  return useMemo(() => ({ data, refetch }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 14. Inline useCallback in return object — wrapper unstable
    {
      code: `
import { useCallback } from "react";
export function useActions() {
  return { handler: useCallback(() => {}, []) };
}`,
      output: `
import { useCallback, useMemo } from "react";
export function useActions() {
  return useMemo(() => ({ handler: useCallback(() => {}, []) }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 15. useState [value, setter] destructure — wrapper unstable
    {
      code: `
import { useState } from "react";
export function useFlag() {
  const [flag, setFlag] = useState(false);
  return { flag, setFlag };
}`,
      output: `
import { useState, useMemo } from "react";
export function useFlag() {
  const [flag, setFlag] = useState(false);
  return useMemo(() => ({ flag, setFlag }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },

    // === Object returns with unstable properties (unstableObjectReturn + unstableReturn) ===
    // NOTE: ESLint applies fixes sorted by composite range [start, end].
    // When both fixes include import modifications, they share the same start
    // position. The property fix has a shorter end → applies first. The object
    // wrapper fix applies in a subsequent pass.

    // 16. Inline arrow function in return object — property fix first, wrapper second
    {
      code: `
import { useState } from "react";
export function useCounter() {
  const [count, setCount] = useState(0);
  return { count, increment: () => setCount(c => c + 1) };
}`,
      output: [
        // Pass 1: property fix (useCallback on inline arrow)
        `
import { useState, useCallback } from "react";
export function useCounter() {
  const [count, setCount] = useState(0);
  return { count, increment: useCallback(() => setCount(c => c + 1), [] /* TODO: add dependencies */) };
}`,
        // Pass 2: wrapper fix (useMemo on object)
        `
import { useState, useCallback, useMemo } from "react";
export function useCounter() {
  const [count, setCount] = useState(0);
  return useMemo(() => ({ count, increment: useCallback(() => setCount(c => c + 1), [] /* TODO: add dependencies */) }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 17. Hoisted function declaration — property fix first, wrapper second
    {
      code: `
import { useState } from "react";
export function usePagination() {
  const [page, setPage] = useState(1);
  function setNextPage() {
    setPage(p => p + 1);
  }
  return { page, setNextPage };
}`,
      output: [
        // Pass 1: property fix (useCallback on function declaration)
        `
import { useState, useCallback } from "react";
export function usePagination() {
  const [page, setPage] = useState(1);
  useCallback(function setNextPage() {
    setPage(p => p + 1);
  }, [] /* TODO: add dependencies */)
  return { page, setNextPage };
}`,
        // Pass 2: wrapper fix (useMemo on return object)
        `
import { useState, useCallback, useMemo } from "react";
export function usePagination() {
  const [page, setPage] = useState(1);
  useCallback(function setNextPage() {
    setPage(p => p + 1);
  }, [] /* TODO: add dependencies */)
  return useMemo(() => ({ page, setNextPage }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 18. Inline object literal as property — property fix first, wrapper second
    {
      code: `
export function useConfig() {
  return { config: { theme: "dark" } };
}`,
      output: [
        // Pass 1: property fix (useMemo on inner object)
        `
import { useMemo } from "react";
export function useConfig() {
  return { config: useMemo(() => ({ theme: "dark" }), [] /* TODO: add dependencies */) };
}`,
        // Pass 2: wrapper fix (useMemo on outer object)
        `
import { useMemo } from "react";
export function useConfig() {
  return useMemo(() => ({ config: useMemo(() => ({ theme: "dark" }), [] /* TODO: add dependencies */) }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 19. Inline array literal as property — property fix first, wrapper second
    {
      code: `
export function useItems() {
  return { items: [1, 2, 3] };
}`,
      output: [
        // Pass 1: property fix (useMemo on inner array)
        `
import { useMemo } from "react";
export function useItems() {
  return { items: useMemo(() => [1, 2, 3], [] /* TODO: add dependencies */) };
}`,
        // Pass 2: wrapper fix (useMemo on outer object)
        `
import { useMemo } from "react";
export function useItems() {
  return useMemo(() => ({ items: useMemo(() => [1, 2, 3], [] /* TODO: add dependencies */) }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 20. Intermediate variable bare function — property fix first, wrapper second
    {
      code: `
export function useHandler() {
  const handler = () => {};
  return { handler };
}`,
      output: [
        // Pass 1: property fix (useCallback on handler variable)
        `
import { useCallback } from "react";
export function useHandler() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
}`,
        // Pass 2: wrapper fix (useMemo on return object)
        `
import { useCallback, useMemo } from "react";
export function useHandler() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return useMemo(() => ({ handler }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 21. Multi-hop intermediate variable — property fix first, wrapper second
    {
      code: `
export function useMultiHop() {
  const a = () => {};
  const b = a;
  return { b };
}`,
      output: [
        // Pass 1: property fix (useCallback wraps b's init)
        `
import { useCallback } from "react";
export function useMultiHop() {
  const a = () => {};
  const b = useCallback(a, [] /* TODO: add dependencies */);
  return { b };
}`,
        // Pass 2: wrapper fix (useMemo on return object)
        `
import { useCallback, useMemo } from "react";
export function useMultiHop() {
  const a = () => {};
  const b = useCallback(a, [] /* TODO: add dependencies */);
  return useMemo(() => ({ b }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 22. Hook exported via `export { useBar }` specifier — property fix first, wrapper second
    {
      code: `
function useBar() {
  const fn = () => {};
  return { fn };
}
export { useBar };`,
      output: [
        // Pass 1: property fix (useCallback on fn)
        `
import { useCallback } from "react";
function useBar() {
  const fn = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { fn };
}
export { useBar };`,
        // Pass 2: wrapper fix (useMemo on return object)
        `
import { useCallback, useMemo } from "react";
function useBar() {
  const fn = useCallback(() => {}, [] /* TODO: add dependencies */);
  return useMemo(() => ({ fn }), [] /* TODO: add dependencies */);
}
export { useBar };`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 23. Default export hook — property fix first, wrapper second
    {
      code: `
export default function useDefault() {
  const handler = () => {};
  return { handler };
}`,
      output: [
        // Pass 1: property fix (useCallback on handler)
        `
import { useCallback } from "react";
export default function useDefault() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
}`,
        // Pass 2: wrapper fix (useMemo on return object)
        `
import { useCallback, useMemo } from "react";
export default function useDefault() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return useMemo(() => ({ handler }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 24. Arrow function hook — property fix first, wrapper second
    {
      code: `
export const useArrow = () => {
  const handler = () => {};
  return { handler };
};`,
      output: [
        // Pass 1: property fix (useCallback on handler)
        `
import { useCallback } from "react";
export const useArrow = () => {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
};`,
        // Pass 2: wrapper fix (useMemo on return object)
        `
import { useCallback, useMemo } from "react";
export const useArrow = () => {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return useMemo(() => ({ handler }), [] /* TODO: add dependencies */);
};`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 25. FunctionExpression in return — property fix first, wrapper second
    {
      code: `
export function useFnExpr() {
  return { handler: function() {} };
}`,
      output: [
        // Pass 1: property fix (useCallback on inline function)
        `
import { useCallback } from "react";
export function useFnExpr() {
  return { handler: useCallback(function() {}, [] /* TODO: add dependencies */) };
}`,
        // Pass 2: wrapper fix (useMemo on object)
        `
import { useCallback, useMemo } from "react";
export function useFnExpr() {
  return useMemo(() => ({ handler: useCallback(function() {}, [] /* TODO: add dependencies */) }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 26. Multiple unstable properties + wrapper
    // Pass 1: fn1 fix applies (shortest range). fn2 + wrapper overlap → skipped.
    // Pass 2: wrapper fix applies (starts at import, before fn2). fn2 overlaps → skipped.
    // After wrapping, return is useMemo(...) call — rule stops firing. fn2 never fixed.
    {
      code: `
export function useMulti() {
  const fn1 = () => {};
  const fn2 = () => {};
  return { fn1, fn2 };
}`,
      output: [
        // Pass 1: fn1 wrapped in useCallback
        `
import { useCallback } from "react";
export function useMulti() {
  const fn1 = useCallback(() => {}, [] /* TODO: add dependencies */);
  const fn2 = () => {};
  return { fn1, fn2 };
}`,
        // Pass 2: wrapper applies (fn2 stays unwrapped — its range overlaps with wrapper's composite range)
        `
import { useCallback, useMemo } from "react";
export function useMulti() {
  const fn1 = useCallback(() => {}, [] /* TODO: add dependencies */);
  const fn2 = () => {};
  return useMemo(() => ({ fn1, fn2 }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 27. Shorthand property tracing to object-literal — property fix first, wrapper second
    {
      code: `
export function useObjReturn() {
  const options = { a: 1 };
  return { options };
}`,
      output: [
        // Pass 1: property fix (useMemo on options variable init)
        `
import { useMemo } from "react";
export function useObjReturn() {
  const options = useMemo(() => ({ a: 1 }), [] /* TODO: add dependencies */);
  return { options };
}`,
        // Pass 2: wrapper fix (useMemo on return object — options now stable-hook)
        `
import { useMemo } from "react";
export function useObjReturn() {
  const options = useMemo(() => ({ a: 1 }), [] /* TODO: add dependencies */);
  return useMemo(() => ({ options }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 28. Return via intermediate object variable — property fix first, wrapper second
    {
      code: `
export function useIntermediate() {
  const handler = () => {};
  const result = { handler };
  return result;
}`,
      output: [
        // Pass 1: property fix (useCallback on handler)
        `
import { useCallback } from "react";
export function useIntermediate() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  const result = { handler };
  return result;
}`,
        // Pass 2: wrapper fix (useMemo on result's origin object literal)
        `
import { useCallback, useMemo } from "react";
export function useIntermediate() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  const result = useMemo(() => ({ handler }), [] /* TODO: add dependencies */);
  return result;
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 29. Auto-fix: adds imports when missing — property fix first, wrapper second
    {
      code: `
import { useState } from "react";
export function useFoo() {
  const handler = () => {};
  return { handler };
}`,
      output: [
        // Pass 1: property fix (useCallback on handler + import useCallback)
        `
import { useState, useCallback } from "react";
export function useFoo() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
}`,
        // Pass 2: wrapper fix (useMemo on return + import useMemo)
        `
import { useState, useCallback, useMemo } from "react";
export function useFoo() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return useMemo(() => ({ handler }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 30. useCallback already imported — wrapper fix applies first because property
    // fix has no import modification, making its range contained within the wrapper's
    // composite range. Handler is never fixed (return becomes useMemo call → rule stops).
    {
      code: `
import { useState, useCallback } from "react";
export function useFoo() {
  const handler = () => {};
  return { handler };
}`,
      output: `
import { useState, useCallback, useMemo } from "react";
export function useFoo() {
  const handler = () => {};
  return useMemo(() => ({ handler }), [] /* TODO: add dependencies */);
}`,
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 31. Auto-fix: wraps object literal property in useMemo — property fix first, wrapper second
    {
      code: `
import { useState } from "react";
export function useConfig() {
  const config = { theme: "dark" };
  return { config };
}`,
      output: [
        // Pass 1: property fix (useMemo on config variable init)
        `
import { useState, useMemo } from "react";
export function useConfig() {
  const config = useMemo(() => ({ theme: "dark" }), [] /* TODO: add dependencies */);
  return { config };
}`,
        // Pass 2: wrapper fix (config now stable-hook, only wrapper fires)
        `
import { useState, useMemo } from "react";
export function useConfig() {
  const config = useMemo(() => ({ theme: "dark" }), [] /* TODO: add dependencies */);
  return useMemo(() => ({ config }), [] /* TODO: add dependencies */);
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },

    // === Bare array returns (Bug 1) ===

    // 32. Inline empty array return
    {
      code: `
export function useBreadcrumbs() {
  return [];
}`,
      output: `
import { useMemo } from "react";
export function useBreadcrumbs() {
  return useMemo(() => [], [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableArrayReturn" }],
    },
    // 33. Inline array return with elements
    {
      code: `
import { useState } from "react";
export function useValues() {
  const [a, setA] = useState(1);
  return [a, setA];
}`,
      output: `
import { useState, useMemo } from "react";
export function useValues() {
  const [a, setA] = useState(1);
  return useMemo(() => [a, setA], [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableArrayReturn" }],
    },
    // 34. Identifier tracing to array-literal
    {
      code: `
export function useCrumbs() {
  const crumbs = [{ label: "Home", path: "/" }];
  return crumbs;
}`,
      output: `
import { useMemo } from "react";
export function useCrumbs() {
  const crumbs = useMemo(() => [{ label: "Home", path: "/" }], [] /* TODO: add dependencies */);
  return crumbs;
}`,
      errors: [{ messageId: "unstableArrayReturn" }],
    },
    // 35. Real-world useBreadcrumbs with early return
    {
      code: `
export function useBreadcrumbs() {
  const pathname = "/about";
  if (pathname === "/") return [];
  const crumbs = [{ label: "Home", path: "/" }];
  return crumbs;
}`,
      output: [
        `
import { useMemo } from "react";
export function useBreadcrumbs() {
  const pathname = "/about";
  if (pathname === "/") return useMemo(() => [], [] /* TODO: add dependencies */);
  const crumbs = [{ label: "Home", path: "/" }];
  return crumbs;
}`,
        `
import { useMemo } from "react";
export function useBreadcrumbs() {
  const pathname = "/about";
  if (pathname === "/") return useMemo(() => [], [] /* TODO: add dependencies */);
  const crumbs = useMemo(() => [{ label: "Home", path: "/" }], [] /* TODO: add dependencies */);
  return crumbs;
}`,
      ],
      errors: [
        { messageId: "unstableArrayReturn" },
        { messageId: "unstableArrayReturn" },
      ],
    },

    // === Bare object wrapper only (Bug 2 — all props stable) ===

    // 36. Real-world useServerSort pattern
    {
      code: `
import { useCallback } from "react";
export function useServerSort() {
  const sortBy = "name";
  const sortDirection = "asc";
  const toggleSort = useCallback(() => {}, []);
  return { sortBy, sortDirection, toggleSort };
}`,
      output: `
import { useCallback, useMemo } from "react";
export function useServerSort() {
  const sortBy = "name";
  const sortDirection = "asc";
  const toggleSort = useCallback(() => {}, []);
  return useMemo(() => ({ sortBy, sortDirection, toggleSort }), [] /* TODO: add dependencies */);
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },

    // === Identifier tracing to object-literal (Bug 3) ===

    // 37. Identifier tracing to object-literal with all-stable props
    {
      code: `
import { useState } from "react";
export function useObjIdent() {
  const [val, setVal] = useState(0);
  const obj = { val, setVal };
  return obj;
}`,
      output: `
import { useState, useMemo } from "react";
export function useObjIdent() {
  const [val, setVal] = useState(0);
  const obj = useMemo(() => ({ val, setVal }), [] /* TODO: add dependencies */);
  return obj;
}`,
      errors: [{ messageId: "unstableObjectReturn" }],
    },
    // 38. Identifier tracing to object-literal with unstable properties
    {
      code: `
export function useObjWithUnstable() {
  const handler = () => {};
  const obj = { handler };
  return obj;
}`,
      output: [
        `
import { useCallback } from "react";
export function useObjWithUnstable() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  const obj = { handler };
  return obj;
}`,
        `
import { useCallback, useMemo } from "react";
export function useObjWithUnstable() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  const obj = useMemo(() => ({ handler }), [] /* TODO: add dependencies */);
  return obj;
}`,
      ],
      errors: [
        { messageId: "unstableObjectReturn" },
        { messageId: "unstableReturn" },
      ],
    },
  ],
});
