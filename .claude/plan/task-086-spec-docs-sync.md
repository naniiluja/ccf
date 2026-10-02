# Task 086 — Spec, docs and count sync

- **Vertical slice:** `CLAUDE.md` + `.claude/rules/*` + READMEs
- **Depends on:** 081, 082, 083, 084, 085
- **Spec refs:** `CLAUDE.md` core invariants; `.claude/rules/git-workflow.md` (README vs spec drift); `.claude/rules/prompt-standard.md` (`ccf-budget` label written LAST); memory `grep-criterion-needs-every-hit-file`.
- **MCP to use:** none
- **discipline:** on
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"`, `node /home/hatch/coder/ccf/node_modules/typescript/bin/tsc --noEmit`, `claude plugin validate plugins/ccf`, `wc -lc CLAUDE.md`, `node plugins/ccf/scripts/spec-budget.mjs --dir .` (before and after).

## Goal (one sentence)
Every spec and doc describes the five new behaviors with counts that match the real files, `CLAUDE.md` is back under 12KB, and the paid-context label is re-measured last.

## Acceptance criteria (verifiable)
- [ ] Script count is 11 everywhere it is stated (`CLAUDE.md`, `architecture.md`, `tooling.md`, `README.md`, `README.vi.md`, `README.zh-CN.md`, `plugins/ccf/README.md`), and the two new scripts (`spec-budget.mjs`, `eval-changelog.mjs`) get a "when to use / how to call" entry in `tooling.md` and a row in `plugins/ccf/README.md`'s script table.
- [ ] `grep -rn "max depth 5" --include=*.md . | grep -v "^./.claude/plan/"` returns nothing; `CLAUDE.md` says four hops.
- [ ] `hooks.md` documents `accepted` in `CLOSED_STATUS_RE` and the session-start PENDING reminder; `architecture.md`/`components.md`/`testing.md` mention the new statuses, the runtime-evidence preflight problem, the `changelog.test.mjs` latch as needed.
- [ ] `prompt-standard.md` states the new `FAIL:` rule (rule quote OR `repro:`) as one verifiable sentence; its `ccf-budget` label is updated LAST to the measured paid total and `context-budget.test.mjs` is green.
- [ ] `CLAUDE.md` `## Current plan` names the fincon-feedback iteration; `wc -lc CLAUDE.md` shows < 200 lines AND < 12,288 bytes.
- [ ] New rules are one verifiable sentence each; narrative goes to `.claude/plan/ARCHIVE.md`-bound notes, not into the rules.
- [ ] The report prints `spec-budget.mjs` total before → after.

## Test first (write before implementing)
- Run the count greps and `spec-budget.mjs` first and record the before figures; the existing `context-budget.test.mjs` is the latch for the label.

## Files to touch
- `CLAUDE.md`
- `.claude/rules/architecture.md`
- `.claude/rules/hooks.md`
- `.claude/rules/tooling.md`
- `.claude/rules/testing.md`
- `.claude/rules/components.md`
- `.claude/rules/prompt-standard.md`
- `README.md`
- `README.vi.md`
- `README.zh-CN.md`
- `plugins/ccf/README.md`

## Steps
1. Measure before. 2. Edit. 3. Re-measure, update the `ccf-budget` label last, run the gate; GREEN → `in-review`. 4. `/ccf:check` → `/ccf:updatespec`.
