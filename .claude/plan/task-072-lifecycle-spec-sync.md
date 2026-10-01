# Task 072 — lifecycle spec, docs and repo sync

- **Vertical slice:** spec (`CLAUDE.md`, `.claude/rules/*`) + prompt (`updatespec.md` step 6) + README tables + plan preambles (ARCHIVE.md, PLAN.md, `PLAN.md.tmpl`) + the actual prune on this repo
- **Depends on:** 070, 071
- **Spec refs:** `CLAUDE.md` core invariants (< 200 lines AND < 12KB; paid-context budget re-measured as the LAST step); `.claude/rules/git-workflow.md` (README vs spec sync, no commit unless asked); `.claude/rules/testing.md` (context-budget check); approved plan `lifecycle-cleanup`.
- **MCP to use:** none
- **Gate:** all suites green: `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs` (the `ccf-budget` label must match the new measurement), `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` (the `PLAN.md.tmpl` preamble latch in `archive.test.mjs` too), `tsc` exit 0, `claude plugin validate plugins/ccf` passed. **discipline: on**: this task is docs-only except the template preamble, whose existing latch test must stay green and must be seen covering the new text.

## Goal (one sentence)
Every spec, prompt and README describes the new lifecycle consistently (8 scripts, clause E, memory gate, retention instead of "never delete"), and this repo's own 25 stale task files are pruned after the user confirms.

## Acceptance criteria (verifiable)
- [ ] `updatespec.md` step 6: "Archive, never delete" is replaced by the retention rule (keep task files of the newest 10 iterations; ARCHIVE.md + git history are permanent) and the `prune-archive.mjs` preview/apply call.
- [ ] `.claude/rules/hooks.md`: `updatespec-nudge` lists clause E in one terse sentence (the file is already the largest per-session cost).
- [ ] `.claude/rules/tooling.md`: entries for `prune-archive.mjs` and `memory-audit.mjs` ("use when / how to call"); the `memory-audit.mjs` entry names `--jev`, that it sends memory text (including `user` memories) to api.typesafe.ai, the 80KB cap and that the column is advisory only, next to the other Jev scripts.
- [ ] `architecture.md` and `CLAUDE.md`: script count 6 → 8, with both new scripts named; `components.md`: the note saying `updatespec.md` deliberately has no `AskUserQuestion` is rewritten to the new reality.
- [ ] `plugins/ccf/README.md`, `README.md`, `README.vi.md`, `README.zh-CN.md`: script tables/counts include the two new scripts. The `jev-backtest` row (from unmerged PR #8) is left alone and its drift is noted in Results, not deleted.
- [ ] `ARCHIVE.md` preamble and `templates/root/.claude/plan/PLAN.md.tmpl`: the retention rule plus recovery (`git log --diff-filter=D --name-only -- .claude/plan/archive/`, then `git show <sha>^:<path>`).
- [ ] `PLAN.md` preamble: the stale "STRICTLY SEQUENTIAL" block is rewritten to the wave model (`Depends on` + `/ccf:cook` waves).
- [ ] `wc -lc CLAUDE.md .claude/rules/*.md` re-measured LAST and the `ccf-budget` label in `.claude/rules/prompt-standard.md` updated; `CLAUDE.md` stays < 200 lines AND < 12KB.
- [ ] On this repo: `prune-archive.mjs` preview shows 25 files + 9 orphans; `--apply` runs only after the user confirms; deletions staged, nothing committed.

## Test first
- Before editing the template preamble, add/extend the `PLAN.md.tmpl` preamble assertion in `archive.test.mjs` to require the retention sentence, and confirm it is RED.

## Files to touch
- `plugins/ccf/commands/updatespec.md` — step 6
- `.claude/rules/hooks.md`, `.claude/rules/tooling.md`, `.claude/rules/architecture.md`, `.claude/rules/components.md`, `.claude/rules/prompt-standard.md` (budget label only)
- `CLAUDE.md`
- `README.md`, `README.vi.md`, `README.zh-CN.md`, `plugins/ccf/README.md`
- `.claude/plan/ARCHIVE.md` (preamble only), `.claude/plan/PLAN.md` (preamble only)
- `plugins/ccf/templates/root/.claude/plan/PLAN.md.tmpl`
- `plugins/ccf/hooks/lib/archive.test.mjs` — template preamble latch
- `.claude/plan/archive/task-0*.md` — 25 deletions via `prune-archive.mjs --apply` (after confirmation)

## Steps
1. Extend the template latch test, confirm RED.
2. Edit prompts, rules, READMEs and preambles.
3. Run the preview, ask the user, then `--apply`.
4. Re-measure the budget LAST, update the label, run every gate; record actual results, mark `in-review`.
5. `/ccf:check` → `/ccf:updatespec`.

## Results
(fill in during implementation)
