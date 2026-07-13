---
description: How to verify changes in the CCF plugin — current state and expectations.
---

# Testing & verification

## Current state (honest)
- No `test` script in `package.json`, but the deterministic **`.mjs` hook libs DO have unit tests** run via the built-in `node --test` (no dependency): `hooks/lib/*.test.mjs` (e.g. `plan.test.mjs`, `context-usage.test.mjs`, `review-trace.test.mjs`, `freshness.test.mjs`). Run `node --test plugins/ccf/hooks/lib/*.test.mjs`. Template-shipped libs are tested too (real `.mjs`, not `.tmpl`): run `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` (e.g. `test-gate-core.test.mjs`). The dotted `.claude` segment must be spelled out — a `**` glob skips hidden dirs and would silently match nothing.
- Components (command/agent/template) are prompts; "correctness" is verified by reading + trying them in Claude Code, not by unit tests.

## Verification methods in use
- **Type-check**: `npm install` (once) then **`npx -p typescript tsc --noEmit`** (configured in `tsconfig.json`, `checkJs` + `strict`) — catches type errors in hooks/bin. Run before considering a hook change done. Verified state: `tsc` green (exit 0).
  - **Use `-p typescript`**: bare `npx tsc` resolves to an UNRELATED squat package (`typescript` is not in `devDependencies`, only `@types/node` is) and fails with "This is not the tsc command you are looking for". `npx -p typescript tsc` fetches the real compiler.
  - **Dependency note**: `tsconfig.json` sets `"types": ["node"]` so it needs `@types/node` (already in `devDependencies`). This is a **type-check-only devDependency**, NOT a runtime dependency — it doesn't violate the "hook no-dependency at runtime" invariant. Never add a runtime dependency.
- **Manual hook smoke test**: pipe simulated stdin JSON into a hook, check stdout/exit code. Examples:
  - `'{"prompt":"/ccf:plan","permission_mode":"default"}' | node plugins/ccf/hooks/plan-mode-guard.mjs` → expect exit 2 + a message on stderr.
  - `'{"source":"startup","cwd":"."}' | node plugins/ccf/hooks/session-start.mjs` → expect stdout JSON with `additionalContext`.
- **Local install test**: `claude plugin marketplace add D:/projects/ccf` + `install`, then try the `/ccf:*` commands.

## Expectations when changing a hook
- A hook MUST never crash on empty/malformed input (guaranteed via `io.mjs`); a change must not break this invariant.
- Significant branching logic goes in a **pure helper** in `hooks/lib/` with a `node --test` test (`*.test.mjs`, excluded from `tsc` via `tsconfig.exclude`) — keep the I/O in the hook, the decision logic pure and tested. Write the failing test first per the CCF workflow.

## Verification-first (CCF law)
For any behavior change: define how to verify BEFORE editing. For a prompt/command, "verify" is a concrete try-it scenario; for a hook, it's `tsc` + smoke input. Report actual results, don't claim "tested" when nothing was run.
