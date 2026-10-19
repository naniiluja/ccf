# Task 091 — Preflight: `criteria-changed` and `existing-test-weakened`

- **Vertical slice:** pure lib helpers + `scripts/worktree-preflight.mjs` wiring + unit and real-git tests
- **Depends on:** —
- **Spec refs:** `.claude/rules/tooling.md` (`worktree-preflight.mjs`); `.claude/rules/testing.md` (a latch never seen RED proves nothing); `.claude/rules/coding-conventions.md` (no comments in new code).
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs` and `npx -p typescript tsc --noEmit`
- **Touches UI:** no
- **Runtime evidence:** worktree-preflight.test.mjs + worktree-preflight-script.test.mjs 30/30 on real git repos, tsc exit 0

## Goal (one sentence)
A wave whose branch rewrote its own acceptance criteria, or deleted more assertions than it added in test files, is blocked before it merges.

## Acceptance criteria (verifiable)
- [x] `criteria-changed` is reported when a branch that edited, emptied or deleted its own task file has an `## Acceptance criteria` section that differs from the main checkout's after normalising list markers, checkbox state and whitespace; ticking a box is not a change, and a branch that never touched its task file is not blamed for criteria edited on main after it forked.
- [x] `existing-test-weakened` is reported when, summed over every changed test file of a branch, assertion-like lines removed exceed those added (with both counts in the problem); moving a test file is not flagged. Assertion-like covers JS/TS, Python (`assert`, `self.assert*`), Rust, Go, JUnit, xUnit and XCTest forms; a regex `.test(name)` call is not one.
- [x] Both are blocking problems (`ready: false`), pure and defensive on garbage input, and exercised in unit tests and against a real temporary git repository.

## Test first (write before implementing)
Unit tests in `worktree-preflight.test.mjs` and git-backed cases in `worktree-preflight-script.test.mjs`; seen RED (import error and 3 failing script cases) before the implementation.

## Files to touch
- `plugins/ccf/hooks/lib/worktree-preflight.mjs`
- `plugins/ccf/hooks/lib/worktree-preflight.test.mjs`
- `plugins/ccf/hooks/lib/worktree-preflight-script.test.mjs`
- `plugins/ccf/scripts/worktree-preflight.mjs`

## Steps (thin end-to-end slice)
1. Write the failing tests
2. Implement `normalizedCriteria`, `criteriaChanged`, `assertionBalance`, wire the two problems and the test diff
3. Run the gate, mark the task `in-review` (NOT `done`)

## Notes / best-practice sources
Idea from Consort (arXiv 2609.09671): a frozen spec and "an agent may not edit tests to force a pass". The main checkout's task file already is the frozen copy at preflight time, so no hash is stored.
Known limit (round 4 `WARN:`, accepted): `criteria-changed` compares the branch's criteria with the main checkout's current copy, not with the merge-base copy, so a branch that touched its task file (for example only `Runtime evidence`) is blocked if main's criteria changed after the fork. Rare during a wave (`/ccf:cook` commits only `PLAN.md` then), and the block is recoverable by rebasing the task file.
