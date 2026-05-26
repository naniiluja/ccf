---
description: How to verify changes in the CCF plugin — current state and expectations.
---

# Testing & verification

## Current state (honest)
- The project has NO test framework / automated tests yet. `package.json` has no `test` script.
- The only deterministic part is the **`.mjs` hooks** — that's the most test-worthy thing if tests are added later.
- Components (command/agent/template) are prompts; "correctness" is verified by reading + trying them in Claude Code, not by unit tests.

## Verification methods in use
- **Type-check**: `npm install` (once) then `npx tsc --noEmit` (configured in `tsconfig.json`, `checkJs` + `strict`) — catches type errors in hooks/bin. Run before considering a hook change done. Verified state: `tsc` green (exit 0).
  - **Dependency note**: `tsconfig.json` sets `"types": ["node"]` so it needs `@types/node` (already in `devDependencies`). This is a **type-check-only devDependency**, NOT a runtime dependency — it doesn't violate the "hook no-dependency at runtime" invariant. Never add a runtime dependency.
- **Manual hook smoke test**: pipe simulated stdin JSON into a hook, check stdout/exit code. Examples:
  - `'{"prompt":"/ccf:ccf-plan","permission_mode":"default"}' | node plugins/ccf/hooks/plan-mode-guard.mjs` → expect exit 2 + a message on stderr.
  - `'{"source":"startup","cwd":"."}' | node plugins/ccf/hooks/session-start.mjs` → expect stdout JSON with `additionalContext`.
- **Local install test**: `claude plugin marketplace add D:/projects/ccf` + `install`, then try the `/ccf:*` commands.

## Expectations when changing a hook
- A hook MUST never crash on empty/malformed input (guaranteed via `io.mjs`); a change must not break this invariant.
- If you add significant branching logic to a hook, consider a pure-Node test runner (e.g. `node --test`, built-in, adds no dependency — fits the no-dep rule). Write the failing test first per the CCF workflow.

## Verification-first (CCF law)
For any behavior change: define how to verify BEFORE editing. For a prompt/command, "verify" is a concrete try-it scenario; for a hook, it's `tsc` + smoke input. Report actual results, don't claim "tested" when nothing was run.
