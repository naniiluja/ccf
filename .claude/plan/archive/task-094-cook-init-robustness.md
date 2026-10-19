# Task 094 — `/ccf:cook` and `/ccf:init`: lint call, cleanup wording, `.worktreeinclude`, minimum build

- **Vertical slice:** `cook.md` steps 2, 3, 4d + `init.md` + a `.worktreeinclude` template + latch tests
- **Depends on:** 092, 093
- **Spec refs:** Claude Code docs `worktrees` (`.worktreeinclude` uses `.gitignore` syntax and applies to subagent worktrees); changelog 2.1.302 (worktree isolation with git 2.56 or newer); `.claude/rules/components.md` (command rules).
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** `node --test .claude/tests/*.test.mjs`, `claude plugin validate plugins/ccf`
- **Touches UI:** no
- **Runtime evidence:** not run: prompt and template changes; `/ccf:cook` was not run live in this session

## Goal (one sentence)
`/ccf:cook` refuses to start a run whose plan would serialise into one-task waves without telling the owner why, leaves nothing merged behind, and a new project's worktrees receive its gitignored `.env` files.

## Acceptance criteria (verifiable)
- [x] `cook.md` step 2 runs `plan-lint.mjs` before `plan-waves.mjs`, shows each `hotspot-collision`, and asks (`AskUserQuestion`, already allowed) whether to continue serially or stop to merge the sync into one final task; the answer is never defaulted.
- [x] `cook.md` step 3 states the minimum Claude Code build for worktree agents (2.1.302) and step 4d replaces the prose branch sweep with the `removed`, `kept` and `pruned` fields of `integrate-wave.mjs`, and reports `git worktree list` leftovers on a STOP.
- [x] `init.md` instantiates `templates/root/.worktreeinclude.tmpl` as `.worktreeinclude` (kept when it already exists), and the template lists `.env` and `.env.local` with a comment that only gitignored files are copied.
- [x] `parallel-cook.test.mjs` pins the lint step, the cleanup fields and the `init.md` mapping; `run_in_background: false` count stays as pinned.

## Test first (write before implementing)
Assertions in `.claude/tests/parallel-cook.test.mjs` for the three prompt changes, seen RED.

## Files to touch
- `plugins/ccf/commands/cook.md`
- `plugins/ccf/commands/init.md`
- `plugins/ccf/templates/root/.worktreeinclude.tmpl`
- `.claude/tests/parallel-cook.test.mjs`

## Steps (thin end-to-end slice)
1. Write the failing latch assertions
2. Edit `cook.md`, `init.md`, add the template
3. Run the gate, mark the task `in-review` (NOT `done`)

## Notes / best-practice sources
Docs `code.claude.com/docs/en/worktrees` (fetched 2026-10-19). `worktree.symlinkDirectories` is NOT generated (no value type in the docs consulted); `onFailure` stays on `plan-mode-guard` only (the docs: no effect on `Stop`).
