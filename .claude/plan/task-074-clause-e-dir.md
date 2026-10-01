# Task 074 — Clause E prints `--dir` in the prune-archive command

- **Vertical slice:** Stop hook clause E (`updatespec-nudge.mjs`) + its `io.test.mjs` case
- **Depends on:** 073
- **Spec refs:** `.claude/rules/hooks.md` (clause E); `.claude/rules/coding-conventions.md` (no comments in new code); `/ccf:check` WARN on task 073.
- **MCP to use:** none
- **Gate:** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node node_modules/typescript/bin/tsc --noEmit`.

## Goal (one sentence)
Clause E's printed command carries `--dir "<project root>"`, so it works from any cwd, not only from the project root.

## Acceptance criteria (verifiable)
- [ ] The clause E nudge contains `--dir` followed by the quoted absolute project root the hook read.
- [ ] Clauses A-D are unaffected.

## Test first (write before implementing; confirm RED)
- `plugins/ccf/hooks/lib/io.test.mjs`: the clause E case asserts `--dir`.

## Files to touch
- `plugins/ccf/hooks/updatespec-nudge.mjs`
- `plugins/ccf/hooks/lib/io.test.mjs`

## Open question
Clause D prints `archive-plan.mjs` the same way; decide at plan time whether 074 covers it too.
