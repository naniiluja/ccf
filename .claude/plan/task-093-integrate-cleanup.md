# Task 093 — `integrate-wave.mjs` cleans merged work after a stop, harness branches and stale registrations

- **Vertical slice:** `scripts/integrate-wave.mjs` + `hooks/lib/worktree-wave.mjs` + real-git tests
- **Depends on:** —
- **Spec refs:** `.claude/rules/tooling.md` (`integrate-wave.mjs`); Claude Code docs `worktrees` (a subagent worktree that holds work stays on disk until a periodic sweep; the harness locks a worktree while its agent runs).
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs` and `npx -p typescript tsc --noEmit`
- **Touches UI:** no
- **Runtime evidence:** not run: git-backed tests only; the harness `worktree-agent-*` naming is taken from `cook.md` and was not observed live in this session

## Goal (one sentence)
After `integrate-wave.mjs --apply`, no worktree or branch whose work is already merged into HEAD is left behind, on a green run AND on a stopped one, and stale worktree registrations are pruned.

## Acceptance criteria (verifiable)
- [x] When a merge or test stage fails, branches already merged and green are removed (worktree, then `branch -d`) and reported under `removed`; the failed branch (`failed-<stage>`) and the unmerged ones (`not-merged`) are kept and listed under `kept` with that reason.
- [x] On every `--apply` outcome the script also deletes leftover `worktree-agent-*` branches that are fully merged into HEAD and checked out nowhere (`git branch -d`, never `-D`), reporting a refusal under `harnessKept`.
- [x] It runs `git worktree prune` at the end and reports `pruned: true`; a prunable registration from a deleted directory disappears.
- [x] A dry run (no `--apply`) removes nothing; the existing green-run behavior and JSON fields are unchanged.

## Test first (write before implementing)
Extend `worktree-wave-script.test.mjs`: red test after merge 2 of 3 keeps only the failed and unmerged branches; harness branch deleted; stale registration pruned; dry run untouched.

## Files to touch
- `plugins/ccf/scripts/integrate-wave.mjs`
- `plugins/ccf/hooks/lib/worktree-wave.mjs`
- `plugins/ccf/hooks/lib/worktree-wave.test.mjs`
- `plugins/ccf/hooks/lib/worktree-wave-script.test.mjs`

## Steps (thin end-to-end slice)
1. Write the failing tests
2. Implement the partial cleanup, the harness-branch sweep and the prune
3. Run the gate, mark the task `in-review` (NOT `done`)

## Notes / best-practice sources
User report 2026-10-19: worktrees pile up after cook. `cook.md:100` left the harness-branch sweep as prose for the model; a script does it deterministically.
