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

## Origin: harness-refresh (tasks 090 to 095)

Requested 2026-10-19: look at recent harness repos, trending GitHub, the Claude Code changelog and `shanraisshan/claude-code-best-practice` for what would improve CCF. Planned with `/ccf:plan`: 3 research agents (changelog 2.1.284 to 2.1.303, the best-practice repo, trending harnesses), then 5 `ccf-codebase-analyzer` on haiku. The owner picked all four candidate groups and added two defects of `/ccf:cook` (worktrees left behind, waves that run one after another), then handed every remaining decision over ("tự quyết định best practice") before going to sleep.

Decisions taken without the owner, each with its reason:
- **Root cause of the sequential waves** (verified in code, not observed live): `slice-check.mjs` HOTSPOTS makes `README*`, `CHANGELOG*`, `CLAUDE.md`, `.claude/rules/*`, `hooks.json`, `plugin.json` and lockfiles hotspot classes, `certainEdge` adds an edge for every pair on one class, and `/ccf:plan` step 4 tells the planner to fold doc sync into each feature task, so nearly every pair gets an edge and N tasks become N waves of one. The fix is at planning time (task 092), not by loosening the edge: the preflight also blocks `actual-overlap` on a shared file, so a looser edge would only move the failure to the merge.
- **`UNRESOLVED` is an annotation, not a downgrade** (090): the refuter never downgrades a `FAIL:` (a latch pins the count), and no paid eval can measure a changed gate tonight (PENDING A6 is still open). The `FAIL:` keeps standing, carries the fact that would settle it, and `/ccf:updatespec` copies it into the `risk` row it already writes before `accepted`. `/ccf:check` stays read-only and `PENDING.md` keeps ONE writer.
- **The criteria freeze needs no stored hash** (091): at preflight time the main checkout's task file IS the frozen copy (a branch can only change its own), so the preflight compares the two. `existing-test-weakened` compares assertion-like lines removed against added across ALL changed test files of a branch, so moving a test is not flagged.
- **Only `.worktreeinclude` is generated** (094): docs confirm it and that it covers subagent worktrees. `worktree.symlinkDirectories` exists but the docs consulted give no value type, and a `node_modules` shared by parallel agents is a write hazard, so it is not generated. `onFailure: "block"` stays on `plan-mode-guard` only: the docs say it has no effect on `Stop`, and blocking `SessionStart` or an advisory prompt hook on a crash would punish the user for CCF's own bug.
- **Deferred, not rejected:** a PreToolUse guard for gate files, a PreCompact snapshot (new schemas never observed live; the owner forbade compact nudges), `` !`command` `` injection into skill bodies, delta-style specs.

## Task backlog — harness-refresh (waves: 090, 091, 092 and 093 in parallel, then 094, then 095)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 090 | Refuter `UNRESOLVED` verdict, carried into the `accepted` risk row | agent + check.md 6c + updatespec.md + latch test | repo suite | — | in-review |
| 091 | Preflight: `criteria-changed` and `existing-test-weakened` | lib + script + unit and git tests | hooks/lib suite + tsc | — | in-review |
| 092 | `plan-lint.mjs`: hotspot collision, criteria, files, depends | lib + script + plan skill step | hooks/lib suite + repo suite + tsc | — | in-review |
| 093 | `integrate-wave.mjs` cleans merged work after a stop, harness branches and stale registrations | script + lib + git tests | hooks/lib suite + tsc | — | in-review |
| 094 | `/ccf:cook` and `/ccf:init`: lint call, cleanup wording, `.worktreeinclude`, minimum build | cook.md + init.md + template + latch tests | repo suite + validate | 092, 093 | in-review |
| 095 | Compatibility audit 2.1.284 to 2.1.303, spec sync, version 0.25.0 | rules + README + CHANGELOG + versions | all suites + tsc + validate | 090, 091, 092, 093, 094 | in-review |
