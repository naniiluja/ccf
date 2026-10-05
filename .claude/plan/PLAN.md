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

## Origin: waves-tab (task 088)

Requested 2026-10-05: when the `/ccf:cook` wave map shows in Rem's dock, pressing it should jump to a new tab, still on the screen with Rem. Planned with `/ccf:plan` (5 `ccf-codebase-analyzer` on haiku, `grill-me` interview, engine typings of Claude Code 2.1.289 as grounding). Decisions: the wave rows above Rem stay and become pressable; the new tab is a second pane `waves` holding the full, taller wave map (no Rem, no board); its design was delegated to Rem. The engine draws the tab strip itself once two panes are open, so the plugin draws no back button. The Waves pane opens only on a press, never on its own.

## Task backlog — waves-tab
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 088 | Press a wave row to open a Waves tab | lib ui-model + ccf-ui rows + register.tsx pane `waves` + mod tests + version sync | ui libs + mod tests + validate + repo suite | — | in-review |
