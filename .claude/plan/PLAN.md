# Implementation Plan — CCF (multi-iteration backlog; lead iteration at top)

> **Execution rule: STRICTLY SEQUENTIAL.** Do exactly one task at a time, in order.
> These tasks are slices sequenced for serial execution (thinnest → richest). Each `Depends on` = the prior task in the queue (serial law), unless a real data dependency is noted.
> Do not start task N+1 until task N's **gate is GREEN** (implemented + tested + checked).
> The `in-progress`/`in-review` status is read by the session-start hook to re-load context after compact — keep status up to date.

> **Scope of this file: the CURRENT iteration only.** Closed iterations and their postmortems live in
> `.claude/plan/ARCHIVE.md`; their task files live in `.claude/plan/archive/`. Keep it that way — a
> closed row left here is counted as live work by `lib/plan.mjs` (`findActiveTask` / `findNonDoneTasks`)
> and by the Stop nudge. When an iteration closes, move its `## Origin` / backlog / `## Closed`
> sections into `ARCHIVE.md` verbatim and `git mv` its task files into `archive/`.
> **Premortem note:** `ccf-spec-checker` and `/ccf:plan` step 6 anchor failure modes to real past
> iterations, so they must read `ARCHIVE.md` as well as this file.
