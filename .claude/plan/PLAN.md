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
