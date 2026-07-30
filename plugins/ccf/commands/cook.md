---
description: Execute the entire todo/in-progress backlog sequentially via ccf-implementer, then batch-verify (review + code-review in parallel, simplify, re-gate, updatespec).
argument-hint: "[optional: task range]"
allowed-tools: Read, Glob, Grep, Task, Skill, TaskCreate, TaskUpdate, TaskList
model: opus
---

You are running CCF `/ccf:cook`. You are the **backlog orchestrator**: after `/ccf:plan` has produced a sequential task queue, `/ccf:cook` drives it end to end — one implementer slice at a time, then a batch-verify pass — without the user re-invoking each step by hand.

**Mutually exclusive with `auto-verify.mjs --auto-verify`:** `/ccf:cook` drives the verify chain itself. Do NOT enable `--auto-verify` in the same workflow — see step 7.

## 1. Read the backlog
Read `.claude/plan/PLAN.md` + the relevant `.claude/plan/task-NNN-*.md` files. `PLAN.md` holds the CURRENT iteration; closed iterations live in `.claude/plan/ARCHIVE.md` and are never eligible. Select the `todo`/`in-progress` tasks in dependency order (respect `Depends on`; a task with an open predecessor is not eligible yet). If `$ARGUMENTS` names a task range, restrict to it — otherwise take the full eligible backlog. State the ordered task list to the user before starting.

### 1b. Mirror the queue into the session task list
Call **`TaskList`** first (an earlier run may have left entries — reuse or clean them rather than duplicating), then **`TaskCreate`** one entry per selected task, in execution order. Use `addBlockedBy` via `TaskUpdate` to encode each `Depends on` edge, so the sequential law is visible in the list and not only in this prompt.

This is the one place in CCF where a backlog run genuinely warrants it: the official trigger criteria are a task needing three or more distinct steps, a user-supplied list of multiple items, non-trivial work that benefits from progress tracking, and an explicit user request — a `/ccf:cook` run matches all four at once.

Two constraints, both load-bearing:
- **The session task list is EPHEMERAL and is NOT the plan.** It exists for the current coding session only. `.claude/plan/PLAN.md` remains the single source of truth for status across sessions, and `TaskUpdate` NEVER substitutes for writing the `PLAN.md` status column. Two different lifecycles: the session list runs `pending → in_progress → completed`, while `PLAN.md` runs `todo → in-progress → in-review → done`. A slice that finishes reaches `completed` in the session list but only `in-review` in `PLAN.md` — mapping `completed` onto `done` would forge a gate that only `/ccf:updatespec` may write.
- **`TaskCreate`/`TaskUpdate`/`TaskList` are NOT the `Task` spawn tool** despite the shared prefix. `Task` spawns a subagent; these three manage a checklist. If the harness does not expose them (they are unavailable when `CLAUDE_CODE_ENABLE_TASKS=0` restores the legacy `TodoWrite`), just skip this sub-step and say so — the backlog still runs from `PLAN.md`. Never fall back to `TodoWrite`: it has been disabled by default since Claude Code v2.1.142.

## 2. Sequential implement loop (one slice at a time — CCF law, unchanged)
**Since Claude Code v2.1.198, a Task spawn that omits `run_in_background` defaults to running in the background** — that silently breaks the sequential law (the next step could fire before the implementer finishes). There is no agent-frontmatter lever to force synchronous execution (`background: true` only forces backgrounding; a documented `false` value does not exist), so the only lever is the CALL SITE: every `Task` spawn below MUST pass `run_in_background: false` explicitly.
For EACH task, in order:
0. `TaskUpdate` this task's session entry to `in_progress` **before** spawning, so the list reflects reality rather than being back-filled afterwards.
1. Spawn `ccf-implementer` via **Task** with `run_in_background: false`, passing the task file path, with a **model override read from that task file's `Model:` line** (an alias such as `sonnet`/`opus`/`haiku` — do NOT hardcode a dated model ID like `claude-sonnet-5`; use the alias so it tracks whatever the alias resolves to). If the task file carries no `Model:` line, ask the user ONCE for the whole run which model to use for every task in this backlog, then apply that same choice to each spawn. If `AskUserQuestion` is unavailable (non-interactive), fall back to the `ccf-implementer` frontmatter default (`sonnet`) and say explicitly that the default was used.
2. Wait for it to finish. Read its report: which test/tsc command it ran and the actual result.
3. **Check the slice gate** (the test/tsc/validate command the task file names, per its report):
   - **GREEN** → `TaskUpdate` the session entry to `completed`, write `in-review` (never `done`) into the `PLAN.md` status column, then move to the next task.
   - **RED** → **STOP immediately.** Tell the user which task failed and why. Do NOT spawn the next implementer, do NOT proceed to batch-verify. **Leave the session entry `in_progress`** — a red gate is unfinished work, and marking it `completed` would erase the only signal that the run stopped here. The sequential law is absolute: never run two `ccf-implementer` spawns in parallel, and never advance past a red gate.
4. Recommend `/compact` between slices if the transcript is getting large (see step 8).

## 3. Batch-verify phase (after ALL slices are implemented)
Once every selected task is `in-review`, run TWO READ-ONLY checks **in parallel** (they don't touch files, so this is safe unlike the writer loop above):
- **(a) Spec/code review** — spawn `ccf-spec-checker` via Task with `run_in_background: false` (this is the CCF-spawned side, capped at **≤3 agents** per the sequential-work-unit convention — one reviewer is normally enough here, so this cap is rarely binding).
- **(b) `/code-review`** — invoke via the **Skill tool** (it is a bundled Skill, not a SlashCommand — see step 6). Its internal fan-out is tuned by **effort** (low/high/ultra), not a numeric agent cap — this is NOT the same "≤3" cap as (a); it's a different mechanism entirely.

Gather both results. If EITHER reports a ❌/correctness finding → **STOP here**, report to the user, do NOT proceed to `/simplify` or `/ccf:updatespec`.

**If the project opted into the test discipline** (`.claude/rules/testing.md` has the "Test design discipline" block / `Matrix required: yes`): `ccf-implementer` already designed + wrote the contract-level EP/BVA/decision-table matrix tests for each slice during step 2 (that is part of the implementer's failing-test-first flow, not a separate command). After the read-only pair comes back clean, RUN the project's test command to confirm those matrix tests actually pass before `/simplify`. This keeps `/ccf:cook`'s chain aligned with `auto-verify.mjs`/`buildVerifyReason`, which also runs the matrix tests when the discipline is on. When the discipline is OFF, skip this (no matrix forced).

## 4. `/simplify` (runs alone, after the read-only pair finishes)
`/simplify` **WRITES files** (cleanup: helper reuse, simplification, efficiency, abstraction — a fixed 4-parallel-agent fan-out, not numerically cappable). Invoke it via the **Skill tool** only AFTER both (a) and (b) from step 3 have finished, to avoid a race between a read-only reviewer diffing the tree and `/simplify` rewriting it.

## 5. Re-gate after `/simplify`, then `/ccf:updatespec`
`/simplify` can change code, so re-run the **deterministic** gates only (this is NOT a fresh correctness review — that already happened in step 3; re-gating here just confirms `/simplify`'s edits didn't break anything mechanical):
- `npx -p typescript tsc --noEmit`
- `node --test plugins/ccf/hooks/lib/*.test.mjs` (+ any template libs the task touched)
- `claude plugin validate plugins/ccf`

**Only if** step 3's review + code-review came back clean (no ❌) **AND** this re-gate is green → invoke `/ccf:updatespec` (via Skill/SlashCommand if exposed, else instruct the user to run it) to mark the tasks `done`. **Any ❌ or red gate anywhere → STOP, report to the user, do NOT mark anything `done`.**

## 6. Fallback when Skill/SlashCommand isn't exposed
Not every harness exposes the Skill tool or a SlashCommand tool for invoking `/code-review`, `/simplify`, or `/ccf:updatespec` (this varies by environment — do not assume). If a call fails or the tool isn't available: **tell the user explicitly** which step could not be auto-invoked, and instruct them to run it by hand, in the same order (`/ccf:check` → `/code-review` → run the project's test command if the test discipline is on → `/simplify` → re-gate → `/ccf:updatespec`) — the same manual sequence `auto-verify.mjs` documents as its own fallback.

## 7. Relationship with `auto-verify.mjs`
`/ccf:cook` and the opt-in `auto-verify.mjs` Stop hook both drive the SAME verify chain — do not run both in the same workflow:
- If you use `/ccf:cook`, do NOT also enable `--auto-verify` in `hooks.json` — they would double-drive the chain.
- When `/ccf:cook` DID successfully spawn `ccf-spec-checker` via Task (step 3a), `auto-verify.mjs`'s own `checkAlreadyRan`/`hasSpecCheckerSpawn` guard will see that the review was SPAWNED in the transcript (not necessarily finished — see the function's own note) and auto-suppress a redundant drive at Stop — so leaving `--auto-verify` on is harmless (merely redundant) in that case.
- In the **manual-fallback** branch (step 6 — no Task spawn happened because Skill/SlashCommand wasn't available), that guard does NOT fire (there is no `ccf-spec-checker` transcript entry to detect), so `auto-verify.mjs` re-driving the chain at Stop is CORRECT and harmless — it picks up exactly the work `/ccf:cook` couldn't finish itself.

## 8. Context management
Suggest `/compact` between implement slices (step 2) once the transcript grows large — a long sequential backlog accumulates context fast. Recommend running `/ccf:cook` over a **small backlog** per invocation (a handful of tasks, not an entire multi-iteration plan) so a single session stays within a manageable context budget and a RED gate stops the loop early rather than deep into a long queue.

**OPTIONAL secondary stop condition:** if the official `/goal` command is available (OPTIONAL, may be absent on an older Claude Code build), the user MAY set a condition such as `/goal all selected tasks are in-review` to keep the session working autonomously across the implement loop. This is a SECONDARY convenience only — it does NOT replace the sequential law's stop-on-red-gate (step 2.3): a RED gate still STOPS the loop immediately regardless of any `/goal` condition.

## Notes
- The **"≤3 agents" cap** applies ONLY to CCF-spawned work via Task (i.e. `ccf-spec-checker` in step 3a). Built-in `/code-review` and `/simplify` fan out INTERNALLY — `/code-review`'s depth is tuned by `effort`, and `/simplify` is fixed at 4 parallel agents — neither is numerically cappable from the outside; do not conflate the two mechanisms.
- Never spawn two `ccf-implementer` agents in parallel, and never spawn a writer (`ccf-implementer` or `/simplify`) at the same time as anything else that touches files.
