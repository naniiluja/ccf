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
- **Test first:** `archive.test.mjs` `GUIDANCE_PATTERNS` gained the retention sentence ("task files of the newest 10 iterations") and the recovery command; RED before the template edit (2 failing: the preamble latch and the single-iteration retirement), GREEN after (34/34).
- **Edits:** `updatespec.md` step 6 ("Archive, never delete" → retention rule + `prune-archive.mjs` preview/`--apply` + recovery); `hooks.md` clause E (four → five clauses); `tooling.md` entries for both scripts; `architecture.md` 6 → 8 scripts, three commands now call scripts; `components.md` `AskUserQuestion` note (updatespec.md now asks in step 5b); `CLAUDE.md` 6 → 8 scripts + clause E/retention; READMEs; ARCHIVE.md, PLAN.md and `PLAN.md.tmpl` preambles.
- **Root READMEs** (`README.md`, `.vi`, `.zh-CN`) carry no script table since the 36f122d rewrite, so each got one short "Scripts" bullet naming the count (8) and both new scripts.
- **Drift, left on purpose:** `plugins/ccf/README.md` lists a `jev-backtest.mjs` row from unmerged PR #8 while no such file exists on this branch; the header count says 8 (the real files), so the table shows 9 rows until PR #8 merges and the count becomes 9.
- **Prune (deviation by main-session instruction):** preview only on this repo — 25 files to prune, 9 orphans (task-001 to task-009), `git status --porcelain` identical before and after. `--apply` NOT run here; the main session runs it after the user confirms.
- **Budget (measured last):** `CLAUDE.md` 59 lines / 12,210 bytes (base 12,072; a first draft hit 12,415 and failed the < 12,288 latch, so the script list and clause E line were cut back). Paid total 104,931 (was 103,078), label updated in `prompt-standard.md`.
- **Gate:** see the reply to the main session for the exact runs (all suites, tsc, `claude plugin validate`).
