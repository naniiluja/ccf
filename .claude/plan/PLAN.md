# Implementation Plan — CCF best-practice integration

> **Execution rule: STRICTLY SEQUENTIAL.** Do exactly one task at a time, in order.
> These 4 tasks are INDEPENDENT slices sequenced for serial execution (thinnest → richest) — not a true dependency chain. Each `Depends on` = the prior task in the queue (serial law), not a logical dependency.
> Do not start task N+1 until task N's **gate is GREEN** (implemented + tested + checked).
> The `in-progress` status is read by the session-start hook to re-load context after compact — keep status up to date.

## Origin
Derived from the approved plan `b-n-c-th-xem-keen-gosling.md` (compare repo `shanraisshan/claude-code-best-practice` ↔ CCF, grounded in Claude Code docs, reviewed twice by `ccf-spec-checker`). Rejected: `<important if>` tags (not real Claude Code syntax), Agent Teams/auto-permission/cross-model (violate sequential/review-first), PostToolUse auto-format (violates no-dependency), `InstructionsLoaded` hook (YAGNI), spec-checker opus→sonnet (drift).

## Task backlog (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 001 | Prompt-hygiene fixes (ccf-fix branching MUST + ccf-plan refactor≠feature) | command prompts | read-confirm 2 files, no spec drift | — | done |
| 002 | Path-scoped `paths:` — docs/wording delta (glob table + spec-writer/ccf-init sync) | rules + agent + command | `claude plugin validate` green, 3 places consistent | 001 | done |
| 003 | Verify-work Stop nudge (pure helper + test + updatespec-nudge compose) | hook + lib | `node --test` + `tsc` + smoke green | 002 | done |
| 004 | `settings.json` template + `attribution` (ccf-init + ccf-updatespec + git-workflow) | template + 2 commands + rule | valid JSON + `validate` green, 2 commands consistent | 003 | done |

> Status: `todo` / `in-progress` / `done` / `blocked`.
> Per-task detail in `task-NNN-*.md`. Each task runs in a FRESH session via `ccf-implementer`.
> Plugin structure unchanged (5 cmd / 6 agent / 5 hook / 1 skill) → README/MEMORY counts stay as-is.

## Closed
All 4 tasks done + `/ccf:ccf-check` (0 violations) + `/code-review` (4 findings fixed: PowerShell/`pwsh` in SHELL_TOOL_NAMES, MultiEdit shape tolerance via `editedAnyCodeFile`, hooks.md + README verify-work clause sync). Gates green: 70 unit tests, `tsc` exit 0, `claude plugin validate` passed.
