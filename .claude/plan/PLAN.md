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

## Origin: lifecycle-cleanup (tasks 070 to 072)

Requested 2026-10-01: closed task files and project memory accumulate with no cleanup. Planned with `/ccf:plan` (5 analyzers on haiku, interview, Context7 grounding on code.claude.com/docs/en/memory). Decisions: keep the task files of the newest 10 archived iterations (by position in ARCHIVE.md), prune older ones, keep orphans (task-001 to task-009 map to no iteration) and report them; ARCHIVE.md + git history stay the permanent record. Memory gets a consolidation pass in `/ccf:updatespec` only when `memory-audit.mjs` opens the gate (more than 20 `feedback` files, or MEMORY.md at 150+ lines or 20KB+), with one preview + one `AskUserQuestion` before anything is merged or dropped. Test design discipline is on. Task ids 067 to 069 are reserved for the Jev backtest work on PR #8.

> **Jev classification of memories: IN task 071 (user decision 2026-10-01, reversing the planning-time deferral).** Opt-in by `--jev` on `memory-audit.mjs` AND `TYPESAFE_API_KEY`; asked only when the gate is open; adds an advisory `jev` column (label + score, highest of three keep/merge/drop answers, tie-break toward the least destructive) to the preview table only. The model's proposal and the single `AskUserQuestion` confirmation stay the only path to a change. Missing key, API error, timeout or a state over 80KB falls back silently to the flow without Jev (status in the JSON, no column). The user consented to sending `user`-type memories to api.typesafe.ai for this; step 5b still states it in one sentence before each `--jev` run. Accuracy caveat kept on record: about 68% on this repo's harness backtest, so the label is a hint, never a reason to drop.

## Task backlog — lifecycle-cleanup (waves: 070 and 071 in parallel, then 072)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 070 | prune-archive script + Stop clause E | lib archive + script + updatespec-nudge + tests | lib suite + tsc + preview smoke (25 prune / 9 orphans) | — | in-review |
| 071 | memory-audit script + gated consolidation step + opt-in Jev column | lib memory-audit + script (askJev) + updatespec.md step 5 + tests (fake Jev server) | lib suite + tsc + validate + smoke on real memory dir | — | in-review |
| 072 | Lifecycle spec, docs and repo sync | rules + CLAUDE.md + READMEs + preambles + prune of this repo | all suites + tsc + validate + ccf-budget | 070, 071 | in-review |
