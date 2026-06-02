# Implementation Plan — memory-protocol alignment (ccf-updatespec ↔ Claude Code Memory)

> **Execution rule: STRICTLY SEQUENTIAL.** Do exactly one task at a time, in order.
> These tasks are slices sequenced for serial execution (thinnest → richest). Each `Depends on` = the prior task in the queue (serial law), unless a real data dependency is noted.
> Do not start task N+1 until task N's **gate is GREEN** (implemented + tested + checked).
> The `in-progress`/`in-review` status is read by the session-start hook to re-load context after compact — keep status up to date.

## Origin — memory-protocol-align iteration (tasks 015–016)
Approved plan `hi-n-t-i-th-update-splendid-waffle.md`. User asked whether `/ccf:ccf-updatespec` matches the Memory mechanism from a blog post. It mostly does, but is missing/imprecise on **5 points** (all grounded this session via Context7 `/websites/code_claude` + the live system-prompt protocol): (1) MEMORY.md is a pure index capped at **first 200 lines or 25KB, whichever first** — curate if exceeded; (2) body cross-links use `[[name]]` (the `name:` slug), not `[[file-name]]`; (3) memory is point-in-time → describe intent not a code location + verify before asserting; (4) **Auto Memory** (`autoMemoryEnabled`, default on, v2.1.59+) interplay; (5) `feedback` is the strongest type — record wins AND losses, `Why` mandatory. Deliberately NOT adding the blog's unverified "stale after 2 days" / "module #11/22". Reviewed 2× by `ccf-spec-checker` (round 1: 2 ❌ + 3 ⚠️ → all resolved by preserving the per-line cap, grounding+citing the 3 facts, editing feedback in place, making grep the primary gate; round 2: APPROVE). Counts unchanged (content edit only). Memory: [[sync-hook-docs-both-places]].

## Task backlog — memory-protocol-align (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 015 | Align `ccf-updatespec.md` memory instructions (index cap + `[[name]]` + point-in-time + Auto-Memory note + feedback-strongest) | command prompt | grep (`[[file-name]]` gone, `200 lines`+`25KB`+`autoMemoryEnabled` present, `< ~200 chars` kept, feedback flagged) + `claude plugin validate` + re-read | — | done |
| 016 | Propagate the index-cap + feedback-strongest wording to template + 3 READMEs | template + 3 READMEs | language-neutral grep (`200`/`25KB`/`feedback`) consistent across 4 files + `ccf-updatespec.md` + `validate` + cross-lang re-read | 015 | done |

> Status: `todo` / `in-progress` / `in-review` / `done` / `blocked`. Lifecycle: `todo → in-progress → in-review → done` — `ccf-implementer` reaches `in-review`; only `/ccf:ccf-updatespec` writes `done` after `/ccf:ccf-check` + `/code-review` pass.
> Per-task detail in `task-015-*.md` / `task-016-*.md`. Each task runs in a FRESH session via `ccf-implementer`.
> **Artifact-count impact:** NONE — content edit to an existing command + its doc mirrors; no new command/agent/hook/rule. Counts stay **6 cmd / 6 agent / 5 hook / 1 skill**.

## Closed — memory-protocol-align iteration (tasks 015–016)
Both tasks `done` + `/ccf:ccf-check` (0 ❌, 0 drift, scope = 5 files + PLAN.md, counts 6/6/5/1) + `/code-review` xhigh (`[]` — no findings; a pure prose/markdown diff has no surface for the code-correctness angles). Aligned `/ccf:ccf-updatespec`'s memory instructions with Claude Code's real Memory mechanism on 5 grounded points: MEMORY.md is a pure index (first **200 lines or 25KB**, curate when near) while KEEPING the per-line `< ~200 chars` cap; cross-links use `[[name]]` (the `name:` slug); memory is point-in-time (intent-not-location + verify-before-asserting); Auto-Memory (`autoMemoryEnabled`, default on, v2.1.59+) interplay note; `feedback` elevated to the strongest type (wins+losses, mandatory `Why`). Propagated to `tooling.md.tmpl` + 3 READMEs. Grounded via Context7 `/websites/code_claude` + the live system-prompt protocol; deliberately excluded the blog's unverified "2-days-stale" / "module #11/22". Reviewed 2× by `ccf-spec-checker` (round 1: 2 ❌ + 3 ⚠️ → resolved; round 2: APPROVE). Gates green: `claude plugin validate` passed, `node --test` 89/89. Counts unchanged. Memory: [[ground-claude-facts-primary-not-blog]]. NOT committed (awaiting user).

## Origin — context-guard iteration (tasks 012–014)
Approved plan `hi-n-t-i-t-i-th-y-abundant-castle.md`. User: the compact warning is ineffective — over budget yet the model never shows the `/compact` guidance, because `context-nudge.mjs` (PostToolUse) warns only through `additionalContext` (model-facing, ignorable). Fix = replace it with `context-guard.mjs` on `UserPromptSubmit`: default WARN mode surfaces via `systemMessage`(user)+`additionalContext`(model); opt-in HARD-BLOCK mode (`--hard-block` arg) `exit 2`-blocks until `/compact` (escape: `/compact` prefix or `ccf:override`). Grounded in Context7 `/anthropics/claude-code` (systemMessage = universal field; exit 2 = only deterministic block). Reviewed 2× by `ccf-spec-checker` (4 issues → all resolved; 2 minor notes folded). Counts unchanged (replace, not add). Memory: [[ccf-enforce-with-hook-not-prompt]]. Test discipline: OFF (pure helpers still `node --test`'d per repo law).

## Task backlog — context-guard (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 012 | `context-guard.mjs` WARN mode replacing context-nudge (`decideGuardAction` + `emitPromptWarning`, drop `decideNudge`, swap hooks.json wiring) | hook + 2 lib + hooks.json + tsconfig + tests | `node --test` + `tsc` + over/under-threshold stdin smoke + `validate` accepts combined payload + real-session visibility check | — | done |
| 013 | HARD-BLOCK mode + escape hatch (`decideGuardAction` block branch + `--hard-block` argv + `isEscape` + exit 2) | hook + lib + tests | `node --test` (full decision-table) + `tsc` + 3-case stdin smoke (block / escape / no-flag) | 012 | done |
| 014 | Spec + docs sync (hooks.md, CLAUDE.md, READMEs, tsconfig) | spec + docs | `tsc` + `node --test` + `validate` + grep-clean (no `context-nudge`/`decideNudge`) | 013 | done |

> Status: `todo` / `in-progress` / `in-review` / `done` / `blocked`. Lifecycle: `todo → in-progress → in-review → done` — `ccf-implementer` reaches `in-review`; only `/ccf:ccf-updatespec` writes `done` after `/ccf:ccf-check` + `/code-review` pass.
> Per-task detail in `task-012..014-*.md`. Each task runs in a FRESH session via `ccf-implementer`.
> **Artifact-count impact:** NONE — context-nudge is REPLACED by context-guard (still 1 hooks.json entry net; the new one is an additional object in the existing UserPromptSubmit array, the PostToolUse array is removed). Counts stay **6 cmd / 6 agent / 5 hook / 1 skill**.

## Closed — context-guard iteration (tasks 012–014)
All 3 tasks `done` + `/ccf:ccf-check` (0 ❌, 0 drift — 89 lib tests pass, `tsc` exit 0, `claude plugin validate` passed) + `/code-review` low (`(none)` — no runtime bugs). Replaced the soft `PostToolUse` `context-nudge.mjs` (warned only via `additionalContext`, model-ignorable) with `context-guard.mjs` on `UserPromptSubmit`: WARN default surfaces via `emitPromptWarning` (combined `systemMessage`+`additionalContext`); opt-in HARD-BLOCK (`--hard-block` arg) `exit 2`-blocks until `/compact`, escape on `/compact` prefix or `ccf:override`. `decideNudge` + OS-temp dedup removed (per-prompt firing is rate-limited). Counts unchanged (6 cmd / 6 agent / **5 hook** / 1 skill). Memory: [[hook-user-visible-channel]]. **One gate item deferred to the user:** real-session visibility check (confirm `systemMessage` renders as a USER banner at UserPromptSubmit) — needs a live interactive session Claude can't drive. NOT committed (awaiting user).

---

## Origin — plan-status-sync iteration (closed, tasks 010–011)
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
