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
    // 1. Primitives + useState setter in return
    {
      code: `
import { useState } from "react";
export function useCounter() {
  const [count, setCount] = useState(0);
  return { count, setCount };
}`,
    },
    // 2. All functions wrapped in useCallback
    {
      code: `
import { useCallback, useState } from "react";
export function useActions() {
  const [val, setVal] = useState(0);
  const increment = useCallback(() => setVal(v => v + 1), []);
  return { increment };
}`,
    },
    // 3. Values from useMemo
    {
      code: `
import { useMemo } from "react";
export function useComputed() {
  const data = useMemo(() => ({ a: 1 }), []);
  return { data };
}`,
    },
    // 4. Passthrough of another hook's result
    {
      code: `
export function useWrapper() {
  const result = useSomething();
  return { result };
}`,
    },
    // 5. useRef result
    {
      code: `
import { useRef } from "react";
export function useMyRef() {
  const ref = useRef(null);
  return { ref };
}`,
    },
    // 6. useReducer dispatch
    {
      code: `
import { useReducer } from "react";
export function useMyReducer() {
  const [state, dispatch] = useReducer(reducer, init);
  return { state, dispatch };
}`,
    },
    // 7. Internal (non-exported) hook with bare function
    {
      code: `
function useInternal() {
  const handler = () => {};
  return { handler };
}
export function usePublic() {
  const { handler } = useInternal();
  return { handler };
}`,
    },
    // 8. Primitive scalar return (not object)
    {
      code: `
export function useToggle() {
  return true;
}`,
    },
    // 9. Object destructuring from hook (useQuery)
    {
      code: `
export function useMyQuery() {
  const { data, refetch } = useQuery("key");
  return { data, refetch };
}`,
    },
    // 10. Inline useCallback in return object
    {
      code: `
import { useCallback } from "react";
export function useActions() {
  return { handler: useCallback(() => {}, []) };
}`,
    },
    // 11. useState [value, setter] destructure
    {
      code: `
import { useState } from "react";
export function useFlag() {
  const [flag, setFlag] = useState(false);
  return { flag, setFlag };
}`,
    },
  ],

  invalid: [
    // 12. Inline arrow function in return object
    {
      code: `
import { useState } from "react";
export function useCounter() {
  const [count, setCount] = useState(0);
  return { count, increment: () => setCount(c => c + 1) };
}`,
      output: `
import { useState, useCallback } from "react";
export function useCounter() {
  const [count, setCount] = useState(0);
  return { count, increment: useCallback(() => setCount(c => c + 1), [] /* TODO: add dependencies */) };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 13. Hoisted function declaration returned (usePagination pattern)
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
      output: `
import { useState, useCallback } from "react";
export function usePagination() {
  const [page, setPage] = useState(1);
  useCallback(function setNextPage() {
    setPage(p => p + 1);
  }, [] /* TODO: add dependencies */)
  return { page, setNextPage };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 14. Inline object literal in return object
    {
      code: `
export function useConfig() {
  return { config: { theme: "dark" } };
}`,
      output: `
import { useMemo } from "react";
export function useConfig() {
  return { config: useMemo(() => ({ theme: "dark" }), [] /* TODO: add dependencies */) };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 15. Inline array literal in return object
    {
      code: `
export function useItems() {
  return { items: [1, 2, 3] };
}`,
      output: `
import { useMemo } from "react";
export function useItems() {
  return { items: useMemo(() => [1, 2, 3], [] /* TODO: add dependencies */) };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 16. Intermediate variable that is bare function
    {
      code: `
export function useHandler() {
  const handler = () => {};
  return { handler };
}`,
      output: `
import { useCallback } from "react";
export function useHandler() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 17. Multi-hop intermediate variable (b = a, a = () => {})
    //     Fix wraps at the reference site (b = useCallback(a, ...))
    {
      code: `
export function useMultiHop() {
  const a = () => {};
  const b = a;
  return { b };
}`,
      output: `
import { useCallback } from "react";
export function useMultiHop() {
  const a = () => {};
  const b = useCallback(a, [] /* TODO: add dependencies */);
  return { b };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 18. Hook exported via `export { useBar }` specifier
    {
      code: `
function useBar() {
  const fn = () => {};
  return { fn };
}
export { useBar };`,
      output: `
import { useCallback } from "react";
function useBar() {
  const fn = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { fn };
}
export { useBar };`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 19. Default export hook
    {
      code: `
export default function useDefault() {
  const handler = () => {};
  return { handler };
}`,
      output: `
import { useCallback } from "react";
export default function useDefault() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 20. Arrow function hook (export const useX = () => ...)
    {
      code: `
export const useArrow = () => {
  const handler = () => {};
  return { handler };
};`,
      output: `
import { useCallback } from "react";
export const useArrow = () => {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
};`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 21. FunctionExpression in return
    {
      code: `
export function useFnExpr() {
  return { handler: function() {} };
}`,
      output: `
import { useCallback } from "react";
export function useFnExpr() {
  return { handler: useCallback(function() {}, [] /* TODO: add dependencies */) };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 22. Multiple errors in one hook
    //     Overlapping import fixes require two passes
    {
      code: `
export function useMulti() {
  const fn1 = () => {};
  const fn2 = () => {};
  return { fn1, fn2 };
}`,
      output: [
        `
import { useCallback } from "react";
export function useMulti() {
  const fn1 = useCallback(() => {}, [] /* TODO: add dependencies */);
  const fn2 = () => {};
  return { fn1, fn2 };
}`,
        `
import { useCallback } from "react";
export function useMulti() {
  const fn1 = useCallback(() => {}, [] /* TODO: add dependencies */);
  const fn2 = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { fn1, fn2 };
}`,
      ],
      errors: [
        { messageId: "unstableReturn" },
        { messageId: "unstableReturn" },
      ],
    },
    // 23. Shorthand property tracing to object-literal
    {
      code: `
export function useObjReturn() {
  const options = { a: 1 };
  return { options };
}`,
      output: `
import { useMemo } from "react";
export function useObjReturn() {
  const options = useMemo(() => ({ a: 1 }), [] /* TODO: add dependencies */);
  return { options };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 24. Return via intermediate object variable
    {
      code: `
export function useIntermediate() {
  const handler = () => {};
  const result = { handler };
  return result;
}`,
      output: `
import { useCallback } from "react";
export function useIntermediate() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  const result = { handler };
  return result;
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 25. Auto-fix: adds useCallback import when missing
    {
      code: `
import { useState } from "react";
export function useFoo() {
  const handler = () => {};
  return { handler };
}`,
      output: `
import { useState, useCallback } from "react";
export function useFoo() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 26. Auto-fix: doesn't duplicate existing useCallback import
    {
      code: `
import { useState, useCallback } from "react";
export function useFoo() {
  const handler = () => {};
  return { handler };
}`,
      output: `
import { useState, useCallback } from "react";
export function useFoo() {
  const handler = useCallback(() => {}, [] /* TODO: add dependencies */);
  return { handler };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
    // 27. Auto-fix: wraps object literal in useMemo with arrow factory + parens
    {
      code: `
import { useState } from "react";
export function useConfig() {
  const config = { theme: "dark" };
  return { config };
}`,
      output: `
import { useState, useMemo } from "react";
export function useConfig() {
  const config = useMemo(() => ({ theme: "dark" }), [] /* TODO: add dependencies */);
  return { config };
}`,
      errors: [{ messageId: "unstableReturn" }],
    },
  ],
});
