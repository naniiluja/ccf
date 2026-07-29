---
description: How to verify changes in the CCF plugin — current state and expectations.
---

# Testing & verification

## Current state (honest)
- No `test` script in `package.json`, but the deterministic **`.mjs` hook libs DO have unit tests** run via the built-in `node --test` (no dependency): `hooks/lib/*.test.mjs` (e.g. `plan.test.mjs`, `context-usage.test.mjs`, `review-trace.test.mjs`, `freshness.test.mjs`, `implementer-verify.test.mjs`, `verify-chain.test.mjs`, `git-trace.test.mjs`, `explore-guide.test.mjs`, `output-style.test.mjs`, `verify-trace.test.mjs`, and — new this iteration — **`io.test.mjs`**). Run `node --test plugins/ccf/hooks/lib/*.test.mjs` — currently **190 pass, 0 fail** (up from 163 at the previous count; the increase is `io.test.mjs`'s cases plus the new gate/tradeoff cases added alongside the `hasSpecCheckerSpawn` rename, `stopHookActive` wiring, and `--dual-channel-stop`). Note: `agent-match.mjs` is a shared name-matching helper with no dedicated test file of its own — its behavior is exercised indirectly through `output-style.test.mjs` and `implementer-verify.test.mjs`, both of which call `shouldInject`/`isImplementer` (its only two callers).
- **This whole suite runs noticeably slower now (~114ms → ~570ms) purely because of `io.test.mjs`.** Every exported function in `io.mjs` calls `process.exit` itself, so none of them can be asserted in-process (that would kill the test runner mid-run) — `io.test.mjs` instead spawns `node` as a real child process per case (23 spawns) and reads back the child's actual stdout + exit code. That ~450ms of extra wall time is the INHERENT cost of testing through real process boundaries, not something to "optimize away" by deleting or thinning the file — before it existed, `io.mjs` had ZERO of the other 10 test files touching it.
- Template-shipped libs are tested too (real `.mjs`, not `.tmpl`): run `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` (e.g. `test-gate-core.test.mjs`). The dotted `.claude` segment must be spelled out — a `**` glob skips hidden dirs and would silently match nothing.
- Components (command/agent/template) are prompts; "correctness" is verified by reading + trying them in Claude Code, not by unit tests.

## Lesson: a stated invariant was actually false until a test caught it
`hooks.md` and this file both state "a hook MUST never crash on empty/malformed input" as an invariant guaranteed by `io.mjs#readStdinJson`. That invariant was REAL for empty/non-JSON input, but FALSE for one class of syntactically-valid JSON: the literal stdin text `"null"` parses successfully (`JSON.parse("null")` → `null`, a valid JSON value) yet is not an object — before this iteration, `readStdinJson` returned that bare `null` as-is, so any hook doing `input.prompt`/`input.cwd`/etc. on it threw a `TypeError` and crashed with exit code 1, the exact failure mode the invariant claims can't happen. No pre-existing test caught this because none of the 10 test files that existed before this iteration exercised `io.mjs` at all — it took writing `io.test.mjs` (the first test file to touch it) to expose the gap. Fixed by making `readStdinJson` fall back to `{}` for ANY parsed value that isn't a plain, non-array object (`null`, numbers, strings, arrays), not only for the empty/parse-error cases it already handled. **Takeaway**: an invariant with zero direct test coverage on the exact function that implements it is an assumption, not a guarantee — write the test for the thing the invariant is actually about, not just for its callers.

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
