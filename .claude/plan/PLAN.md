# Implementation Plan — CCF (multi-iteration backlog; lead iteration at top)

> **Execution rule: VERTICAL SLICES, RUN IN WAVES.** `/ccf:cook` runs tasks with no link between them (no `Depends on`, no shared file, no shared hotspot) at the same time, each in its own worktree (`scripts/plan-waves.mjs` computes the split).
> `Depends on` lists only REAL dependencies, not queue order. A task starts only after every task it depends on has a **GREEN gate** and is merged; each wave's merged result is tested before the next wave starts.
> The `in-progress`/`in-review` status is read by the session-start hook to re-load context after compact — keep status up to date.

> **Scope of this file: the CURRENT iteration only.** Closed iterations and their postmortems live in
> `.claude/plan/ARCHIVE.md`; their task files live in `.claude/plan/archive/`. Keep it that way — a
> closed row left here is counted as live work by `lib/plan.mjs` (`findActiveTask` / `findNonDoneTasks`)
> and by the Stop nudge. When an iteration closes, move its `## Origin` / backlog / `## Closed`
> sections into `ARCHIVE.md` verbatim and `git mv` its task files into `archive/`.
> **Premortem note:** `ccf-spec-checker` and `/ccf:plan` step 6 anchor failure modes to real past
> iterations, so they must read `ARCHIVE.md` as well as this file.
---

## Origin: fincon-feedback (tasks 081 to 086)

Planned 2026-10-02 with `/ccf:plan` (5 `ccf-codebase-analyzer` on haiku, `grill-me` interview, Context7 `code.claude.com/docs/en/memory` + `/en/hooks`), approved by the user in full. The fincon project exposed five gaps: a reviewer cannot `FAIL:` a reproduced bug no rule mentions; `done` conflates "really finished" with "owner accepts closing despite residual risk"; work waiting on a human has no structured home; the spec bloats as narrative mixes into rules; a UI slice can pass the gate with nobody running it; evals are not tied to a release. Kept: clean-context reviewer, mandatory grounding, the refuter never deletes or downgrades a `FAIL:`. Test design discipline is on (`discipline: on` in every task). The paid `claude plugin eval` runs in no gate; it is recorded as an `action` row in `.claude/plan/PENDING.md`. Cleaning this repo's own spec is deferred to the next iteration.

Grounding: `@import` paths resolve relative to the importing file, accept absolute and `@~/`, recurse at most four hops, are skipped inside code spans and fenced blocks, are not imported when double-quoted, and need `\ ` for spaces (so `CLAUDE.md`'s "max depth 5" is drift, fixed by 082/084/086). A hook's `additionalContext` is cut at 10,000 characters (only a 2,000-character preview survives), so the PENDING reminder caps itself at 5 rows plus "and N more in .claude/plan/PENDING.md".

## Task backlog — fincon-feedback (waves: 081, 082, 085 in parallel, then 084, then 083, then 086)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 081 | FAIL by reproduction | spec-checker agent + check.md + finding-verify lib + repo latch + eval case 09 | lib + repo suite + tsc + validate | — | todo |
| 082 | `accepted` status + PENDING.md + session-start reminder | plan lib + session-start hook + templates + init/updatespec + seed PENDING.md | lib + repo suite + tsc + validate + session-start smoke | — | todo |
| 085 | eval-changelog script + CHANGELOG.md + version latch | lib + script + CHANGELOG + repo latch | 3 suites + tsc + preview smoke | — | todo |
| 084 | spec-budget script + rule/narrative split | lib + script + updatespec.md + spec-writer agent | 3 suites + tsc + validate + spec-budget smoke | — | todo |
| 083 | Runtime evidence field in the gate | lib + preflight + templates + plan skill + cook/check/updatespec + repo latches | 3 suites + tsc + validate | 082 | todo |
| 086 | Spec, docs and count sync | CLAUDE.md + rules + READMEs | 3 suites + tsc + validate + `wc -lc CLAUDE.md` + spec-budget | 081, 082, 083, 084, 085 | todo |

---

## Origin: lifecycle-cleanup (tasks 070 to 072)

Requested 2026-10-01: closed task files and project memory accumulate with no cleanup. Planned with `/ccf:plan` (5 analyzers on haiku, interview, Context7 grounding on code.claude.com/docs/en/memory). Decisions: keep the task files of the newest 10 archived iterations (by position in ARCHIVE.md), prune older ones, keep orphans (task-001 to task-009 map to no iteration) and report them; ARCHIVE.md + git history stay the permanent record. Memory gets a consolidation pass in `/ccf:updatespec` only when `memory-audit.mjs` opens the gate (more than 20 `feedback` files, or MEMORY.md at 150+ lines or 20KB+), with one preview + one `AskUserQuestion` before anything is merged or dropped. Test design discipline is on. Task ids 067 to 069 are reserved for the Jev backtest work on PR #8.

> **Jev classification of memories: IN task 071 (user decision 2026-10-01, reversing the planning-time deferral).** Opt-in by `--jev` on `memory-audit.mjs` AND `TYPESAFE_API_KEY`; asked only when the gate is open; adds an advisory `jev` column (label + score, highest of three keep/merge/drop answers, tie-break toward the least destructive) to the preview table only. The model's proposal and the single `AskUserQuestion` confirmation stay the only path to a change. Missing key, API error, timeout or a state over 80KB falls back silently to the flow without Jev (status in the JSON, no column). The user consented to sending `user`-type memories to api.typesafe.ai for this; step 5b still states it in one sentence before each `--jev` run. Accuracy caveat kept on record: about 68% on this repo's harness backtest, so the label is a hint, never a reason to drop.

## Task backlog — lifecycle-cleanup (waves: 070 and 071 in parallel, then 072)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 070 | prune-archive script + Stop clause E | lib archive + script + updatespec-nudge + tests | lib suite + tsc + preview smoke (25 prune / 9 orphans) | — | in-review |
| 071 | memory-audit script + gated consolidation step + opt-in Jev column | lib memory-audit + script (askJev) + updatespec.md step 5 + tests (fake Jev server) | lib suite + tsc + validate + smoke on real memory dir | — | in-review |
| 072 | Lifecycle spec, docs and repo sync | rules + CLAUDE.md + READMEs + preambles + prune of this repo | all suites + tsc + validate + ccf-budget | 070, 071 | in-review |
| 073 | prune-archive exit code + relative `--dir` (also archive-plan) | 2 scripts + process tests + tooling.md | lib suite + repo suite + tsc + relative-dir smoke | 070 | done |
| 074 | Clause E prints `--dir` in the prune-archive command | updatespec-nudge + io test | lib suite + tsc | 073 | in-review |
