# Implementation Plan — Đồng bộ PLAN.md task status (in-review + Stop-hook nudge)

> **Execution rule: STRICTLY SEQUENTIAL.** Do exactly one task at a time, in order.
> These tasks are slices sequenced for serial execution (thinnest → richest). Each `Depends on` = the prior task in the queue (serial law), unless a real data dependency is noted.
> Do not start task N+1 until task N's **gate is GREEN** (implemented + tested + checked).
> The `in-progress`/`in-review` status is read by the session-start hook to re-load context after compact — keep status up to date.

## Origin
Approved plan `t-i-mu-n-t-ch-h-p-buzzing-hejlsberg.md`. User found a real process gap: code committed/pushed but the PLAN.md task is still not `done`, and `done` was being set TOO EARLY (by ccf-implementer, before /ccf-check + /code-review — the v0.3.0 session found 4 bugs post-`done`). Fix = (1) add an `in-review` status; `done` set ONLY by `/ccf:ccf-updatespec` after a clean review; (2) a 3rd advisory clause in the existing Stop hook that nudges when the session committed but PLAN.md has tasks not `done`. Reviewed 3× by `ccf-spec-checker` (3 ❌ + 3 ⚠️ → all resolved). Memory: [[plan-status-sync-on-commit]].

## Task backlog (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 010 | `in-review` status: rename `findInProgressTask`→`findActiveTask` (+widen for in-review) + prompt lifecycle (done only after review) + templates + repo legend | hook lib + agent + 3 commands + templates + rule | `node --test plan.test.mjs` + `tsc` + grep-consistency + session-start reload smoke | — | done |
| 011 | Stop-hook clause C: nudge committed-this-session + tasks not done (`findNonDoneTasks` in plan.mjs + new `git-trace.mjs` `committedThisSession` + tests + doc sync) | hook + 2 lib + test + docs | `node --test` (both helpers) + `tsc` + 4-case stdin smoke + `validate` green | 010 | done |

> Status: `todo` / `in-progress` / `in-review` / `done` / `blocked`. Lifecycle: `todo → in-progress → in-review → done` — `ccf-implementer` reaches `in-review`; only `/ccf:ccf-updatespec` writes `done` after `/ccf:ccf-check` + `/code-review` pass.
> Per-task detail in `task-NNN-*.md`. Each task runs in a FRESH session via `ccf-implementer`.
> **Artifact-count impact:** NONE — no new command/agent/HOOK ENTRY (`git-trace.mjs` is a lib, not a hooks.json entry; clause C composes into the existing `updatespec-nudge.mjs`). Counts stay **6 cmd / 6 agent / 5 hook / 1 skill**. NOTE: task 010 adds the `in-review` value to this file's own status legend (dogfood) — lines 6 + 20.

## Closed — plan-status-sync iteration (tasks 010–011)
Both tasks `done` + `/ccf:ccf-check` (8/8 dimensions pass, 0 ❌) + `/code-review` high (0 correctness bugs — clean first pass; only a documented duplicate-transcript-read note added). `in-review` status shipped: `ccf-implementer` reaches `in-review`, only `/ccf:ccf-updatespec` writes `done` after check+review pass (this very close is the first dogfood of that lifecycle). Stop-hook clause C nudges when the session committed but PLAN.md has non-done tasks (`committedThisSession` role-gated in `git-trace.mjs`, `findNonDoneTasks` in `plan.mjs`). Gates green: 88 lib unit tests, `tsc` exit 0, `claude plugin validate` passed, 4-case stdin smoke verified. Counts unchanged (6 cmd / 6 agent / 5 hook / 1 skill). NOT committed (awaiting user).

## Closed — test-discipline iteration (tasks 005–009, v0.3.0)
All 5 tasks `done` + `/ccf:ccf-check` (1 ❌ count-drift fixed: CLAUDE.md/architecture.md/plugin-README/MEMORY 5→6 commands) + `/code-review` high (4 CONFIRMED + 1 PLAUSIBLE fixed): ccf-init now instantiates the hook lib verbatim + strips `.tmpl`; test-gate transcript scan role-gated (no false block on user prose); `FAIL_SIGNAL` no longer matches "0 failed" (extracted to tested `isFailureText`). Gates green: 70 repo + 8 template unit tests, `tsc` exit 0, `claude plugin validate` passed, 5-case hook smoke (block/allow/loop-guard) verified. `discipline: on` free-text marker kept (LLM-semantic + gate-names-matrix fallback; structured field = YAGNI). NOT committed (awaiting user).

## Closed — previous iteration (best-practice integration, v0.2.0)
4 tasks (001 prompt-hygiene, 002 path-scoped rules docs, 003 verify-work Stop nudge, 004 settings.json/attribution) all done + `/ccf:ccf-check` (0 violations) + `/code-review` (4 findings fixed: PowerShell/`pwsh` in SHELL_TOOL_NAMES, MultiEdit shape tolerance via `editedAnyCodeFile`, hooks.md + README verify-work clause sync). Gates green: 70 unit tests, `tsc` exit 0, `claude plugin validate` passed. Detail: `task-001..004-*.md`.
