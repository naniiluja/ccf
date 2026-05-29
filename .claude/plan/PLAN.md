# Implementation Plan — CCF test-discipline (Toyota-style) opt-in

> **Execution rule: STRICTLY SEQUENTIAL.** Do exactly one task at a time, in order.
> These tasks are slices sequenced for serial execution (thinnest → richest). Each `Depends on` = the prior task in the queue (serial law), unless a real data dependency is noted.
> Do not start task N+1 until task N's **gate is GREEN** (implemented + tested + checked).
> The `in-progress` status is read by the session-start hook to re-load context after compact — keep status up to date.

## Origin
Approved plan `t-i-mu-n-t-ch-h-p-buzzing-hejlsberg.md`. User wants a Toyota-style test discipline (per-function contract-level input matrix = EP+BVA+Decision Table; integration; e2e — Test Pyramid) injected into the workflow CCF GENERATES for target projects. **Opt-in** at `/ccf-plan`/`/ccf-init`; **mandatory once chosen** (writes the matrix tests + a Stop-hook `exit 2` test gate in the target project). Reviewed twice by `ccf-spec-checker` (2 ❌ + 4 ⚠️ → all resolved). Stance: apply the matrix at the **contract level**, not on internal helpers (avoid brittle/ice-cream-cone tests — Fowler/Kent C. Dodds). Grounded in `code.claude.com/docs` (verifiable-check, failing-test-first, Stop-hook gate, 8-block valve) + ISTQB glossary.

## Task backlog (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 005 | Expand `testing.md.tmpl` — opt-in matrix discipline (EP/BVA/decision-table, contract-level, pyramid) + 4 placeholders | template | read-confirm; placeholders `{{UPPER_SNAKE}}`; opt-in OFF leaks nothing; tension stated | 004 (done) | done |
| 006 | `grill-me` init probe (discipline + enforcement sub-questions) + `ccf-init` explicit fold step | skill + command | dispatch consistent; explicit fill step; grill-me stays write-less | 005 | done |
| 007 | New `/ccf-test` command (6th) + sync README/PLAN/tooling + cross-refs | command + README + PLAN + rule | `claude plugin validate` green; frontmatter matches sibling; count 5→6 synced everywhere | 006 | done |
| 008 | Stop-hook test-gate **template** for target projects (opt-in via hooks.json.tmpl presence) + real core lib + `node --test` + tsconfig | template hook .mjs/.tmpl + core lib + test | `node --test` (templates glob) + `tsc` + smoke (exit 0/2) + `validate` green | 007 | done |
| 009 | Wire opt-in into `ccf-plan` (after step 5, before review-gate) + discipline awareness in `ccf-implementer`/`ccf-spec-checker` | 2 commands + 1 agent + 1 agent | try-it 3 scenarios; cross-refs consistent; ship-fast unaffected; plan-review-gate intact | 008 | done |

> Status: `todo` / `in-progress` / `done` / `blocked`.
> Per-task detail in `task-NNN-*.md`. Each task runs in a FRESH session via `ccf-implementer`.
> **Artifact-count impact:** task 007 added 1 command → **5 cmd → 6 cmd** (synced: README heading/row/typical-flow + this note + tooling.md self-checks + ccf-plan/ccf-check closing cross-refs). Agents/hooks/skills of the CCF repo unchanged (the test-gate hook is a TEMPLATE shipped to target projects, NOT a CCF-repo hook). The count is now **6 cmd / 6 agent / 5 hook / 1 skill**.

## Closed — test-discipline iteration (tasks 005–009)
All 5 tasks `done` + `/ccf:ccf-check` (1 ❌ count-drift fixed: CLAUDE.md/architecture.md/plugin-README/MEMORY 5→6 commands) + `/code-review` high (4 CONFIRMED + 1 PLAUSIBLE fixed): ccf-init now instantiates the hook lib verbatim + strips `.tmpl`; test-gate transcript scan role-gated (no false block on user prose); `FAIL_SIGNAL` no longer matches "0 failed" (extracted to tested `isFailureText`). Gates green: 70 repo + 8 template unit tests, `tsc` exit 0, `claude plugin validate` passed, 5-case hook smoke (block/allow/loop-guard) verified. `discipline: on` free-text marker kept (LLM-semantic + gate-names-matrix fallback; structured field = YAGNI). NOT committed (awaiting user).

## Closed — previous iteration (best-practice integration, v0.2.0)
4 tasks (001 prompt-hygiene, 002 path-scoped rules docs, 003 verify-work Stop nudge, 004 settings.json/attribution) all done + `/ccf:ccf-check` (0 violations) + `/code-review` (4 findings fixed: PowerShell/`pwsh` in SHELL_TOOL_NAMES, MultiEdit shape tolerance via `editedAnyCodeFile`, hooks.md + README verify-work clause sync). Gates green: 70 unit tests, `tsc` exit 0, `claude plugin validate` passed. Detail: `task-001..004-*.md`.
