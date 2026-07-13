---
description: Execute the entire todo/in-progress backlog sequentially via ccf-implementer, then batch-verify (review + code-review in parallel, simplify, re-gate, updatespec).
argument-hint: "[optional: task range]"
allowed-tools: Read, Glob, Grep, Task, Skill
model: opus
---

You are running CCF `/cook`. You are the **backlog orchestrator**: after `/ccf:ccf-plan` has produced a sequential task queue, `/cook` drives it end to end — one implementer slice at a time, then a batch-verify pass — without the user re-invoking each step by hand.

**Mutually exclusive with `auto-verify.mjs --auto-verify`:** `/cook` drives the verify chain itself. Do NOT enable `--auto-verify` in the same workflow — see step 7.

## 1. Read the backlog
Read `.claude/plan/PLAN.md` + the relevant `.claude/plan/task-NNN-*.md` files. Select the `todo`/`in-progress` tasks in dependency order (respect `Depends on`; a task with an open predecessor is not eligible yet). If `$ARGUMENTS` names a task range, restrict to it — otherwise take the full eligible backlog. State the ordered task list to the user before starting.

## 2. Sequential implement loop (one slice at a time — CCF law, unchanged)
For EACH task, in order:
1. Spawn `ccf-implementer` via **Task**, passing the task file path, with a **model override to the `sonnet` alias** (Sonnet 5 on the Anthropic API — do NOT hardcode a dated model ID like `claude-sonnet-5`; use the alias so it tracks whatever `sonnet` resolves to).
2. Wait for it to finish. Read its report: which test/tsc command it ran and the actual result.
3. **Check the slice gate** (the test/tsc/validate command the task file names, per its report):
   - **GREEN** → mark progress, move to the next task.
   - **RED** → **STOP immediately.** Tell the user which task failed and why. Do NOT spawn the next implementer, do NOT proceed to batch-verify. The sequential law is absolute: never run two `ccf-implementer` spawns in parallel, and never advance past a red gate.
4. Recommend `/compact` between slices if the transcript is getting large (see step 8).

## 3. Batch-verify phase (after ALL slices are implemented)
Once every selected task is `in-review`, run TWO READ-ONLY checks **in parallel** (they don't touch files, so this is safe unlike the writer loop above):
- **(a) Spec/code review** — spawn `ccf-spec-checker` via Task (this is the CCF-spawned side, capped at **≤3 agents** per the sequential-work-unit convention — one reviewer is normally enough here, so this cap is rarely binding).
- **(b) `/code-review`** — invoke via the **Skill tool** (it is a bundled Skill, not a SlashCommand — see step 6). Its internal fan-out is tuned by **effort** (low/high/ultra), not a numeric agent cap — this is NOT the same "≤3" cap as (a); it's a different mechanism entirely.

Gather both results. If EITHER reports a ❌/correctness finding → **STOP here**, report to the user, do NOT proceed to `/simplify` or `/ccf:ccf-updatespec`.

**If the project opted into the test discipline** (`.claude/rules/testing.md` has the "Test design discipline" block / `Matrix required: yes`): after the read-only pair comes back clean, run `/ccf:ccf-test [slice]` (via the Skill tool) for each slice's public signature to design + run the contract-level matrix BEFORE `/simplify`. `/ccf:ccf-test` WRITES tests, so it is a writer — run it sequentially (never in the read-only pair). This keeps `/cook`'s chain aligned with `auto-verify.mjs`/`buildVerifyReason`, which also inserts `/ccf:ccf-test` when the discipline is on. When the discipline is OFF, skip this (no matrix forced).

## 4. `/simplify` (runs alone, after the read-only pair finishes)
`/simplify` **WRITES files** (cleanup: helper reuse, simplification, efficiency, abstraction — a fixed 4-parallel-agent fan-out, not numerically cappable). Invoke it via the **Skill tool** only AFTER both (a) and (b) from step 3 have finished, to avoid a race between a read-only reviewer diffing the tree and `/simplify` rewriting it.

## 5. Re-gate after `/simplify`, then `/ccf:ccf-updatespec`
`/simplify` can change code, so re-run the **deterministic** gates only (this is NOT a fresh correctness review — that already happened in step 3; re-gating here just confirms `/simplify`'s edits didn't break anything mechanical):
- `npx -p typescript tsc --noEmit`
- `node --test plugins/ccf/hooks/lib/*.test.mjs` (+ any template libs the task touched)
- `claude plugin validate plugins/ccf`

**Only if** step 3's review + code-review came back clean (no ❌) **AND** this re-gate is green → invoke `/ccf:ccf-updatespec` (via Skill/SlashCommand if exposed, else instruct the user to run it) to mark the tasks `done`. **Any ❌ or red gate anywhere → STOP, report to the user, do NOT mark anything `done`.**

## 6. Fallback when Skill/SlashCommand isn't exposed
Not every harness exposes the Skill tool or a SlashCommand tool for invoking `/code-review`, `/simplify`, or `/ccf:ccf-updatespec` (this varies by environment — do not assume). If a call fails or the tool isn't available: **tell the user explicitly** which step could not be auto-invoked, and instruct them to run it by hand, in the same order (`/ccf:ccf-check` → `/code-review` → `/ccf:ccf-test` if the test discipline is on → `/simplify` → re-gate → `/ccf:ccf-updatespec`) — the same manual sequence `auto-verify.mjs` documents as its own fallback.

## 7. Relationship with `auto-verify.mjs`
`/cook` and the opt-in `auto-verify.mjs` Stop hook both drive the SAME verify chain — do not run both in the same workflow:
- If you use `/cook`, do NOT also enable `--auto-verify` in `hooks.json` — they would double-drive the chain.
- When `/cook` DID successfully spawn `ccf-spec-checker` via Task (step 3a), `auto-verify.mjs`'s own `checkAlreadyRan`/`hasSpecCheckerReview` guard will see that review in the transcript and auto-suppress a redundant drive at Stop — so leaving `--auto-verify` on is harmless (merely redundant) in that case.
- In the **manual-fallback** branch (step 6 — no Task spawn happened because Skill/SlashCommand wasn't available), that guard does NOT fire (there is no `ccf-spec-checker` transcript entry to detect), so `auto-verify.mjs` re-driving the chain at Stop is CORRECT and harmless — it picks up exactly the work `/cook` couldn't finish itself.

## 8. Context management
Suggest `/compact` between implement slices (step 2) once the transcript grows large — a long sequential backlog accumulates context fast. Recommend running `/cook` over a **small backlog** per invocation (a handful of tasks, not an entire multi-iteration plan) so a single session stays within a manageable context budget and a RED gate stops the loop early rather than deep into a long queue.

## Notes
- The **"≤3 agents" cap** applies ONLY to CCF-spawned work via Task (i.e. `ccf-spec-checker` in step 3a). Built-in `/code-review` and `/simplify` fan out INTERNALLY — `/code-review`'s depth is tuned by `effort`, and `/simplify` is fixed at 4 parallel agents — neither is numerically cappable from the outside; do not conflate the two mechanisms.
- Never spawn two `ccf-implementer` agents in parallel, and never spawn a writer (`ccf-implementer` or `/simplify`) at the same time as anything else that touches files.
