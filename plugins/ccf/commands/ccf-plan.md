---
description: Create a strictly sequential (waterfall) implementation plan, grounded in best practices. Requires plan mode.
argument-hint: "[feature or change to plan]"
allowed-tools: Read, Glob, Grep, Skill, Task, WebFetch, mcp__context7__resolve-library-id, mcp__context7__query-docs, mcp__microsoft-learn__*
model: opus
---

You are running CCF `/ccf-plan`.

## 0. Plan-mode gate (backup for the hook)
**STOP.** Verify the session is in **plan mode**. If NOT in plan mode, REFUSE: tell the user to enter plan mode (Shift+Tab to cycle to 'plan', or `--permission-mode plan`) and re-run `/ccf:ccf-plan`. Do not proceed. (The plan-mode-guard hook also blocks this deterministically; this is the backup layer.)

## 1. Read existing context
Read `CLAUDE.md` (root + nested) + `.claude/rules/*` + `.claude/plan/PLAN.md`. The new plan must be consistent with the spec and slot into the existing sequential backlog.

## 2. Interview
Invoke the `grill-me` skill via the Skill tool, passing `plan` as the argument. It interrogates the user **one question at a time** (exploring the code to self-answer first) and returns a summary of the answers. Fold that summary into the plan.

## 3. Best-practice grounding
Before finalizing, raise the plan to best-practice quality: call Context7 (`resolve-library-id` → `query-docs`) for the libraries involved and Microsoft Learn for platform guidance — or delegate to `ccf-best-practice-researcher` via Task. Fold the findings into the plan.

## 4. The SEQUENTIAL law (CCF core)
- Plans are ALWAYS sequential waterfall. **Slice VERTICALLY, not horizontally:** each task is a thin tracer-bullet that crosses ALL layers it touches (DB + service + UI) for one small piece of behavior, so you get end-to-end feedback early. Do NOT phase the work as "all DB, then all API, then all FE" — that hides integration risk until the end.
- Order slices thinnest → richest (the first slice is the smallest end-to-end path that proves the wiring); each later slice adds one increment of behavior on top.
- Each task: spec → **failing test** → implement (verification-first — "the single highest-leverage thing").
- **NEVER run two agents in parallel on the same feature.** Finish slice 1 end-to-end → ONLY THEN start slice 2.
- Default to one task at a time for quality. Rationale (Anthropic): phases that share context (planning→implementation→testing) belong in the main conversation; sequential prompt chaining trades latency for accuracy; tasks with many dependencies don't fit parallel multi-agent systems.

## 5. Plan output
Write/append task files `.claude/plan/task-NNN-*.md` (using the task-template). Each task = one PR-sized vertical slice: goal, spec refs, files to touch, test written first, acceptance criteria, **exactly ONE predecessor**, and a **suggestion of which agent/MCP to use when implementing this task**. (In plan mode, the writing is presented as the plan for approval.)
- **Each slice is a gate:** name the test types that must be GREEN before the next slice starts (unit always; integration when it crosses a boundary; e2e/automation for the user-visible path). The next task does not begin until its predecessor's gate passes. State the gate explicitly in the task file.

## 6. Review the plan (MANDATORY GATE — fresh-context, staff-engineer)
**STOP. Do NOT call ExitPlanMode (do NOT present the plan for approval) until** a fresh-context `ccf-spec-checker` subagent has reviewed the PLAN ITSELF (not the code). Delegate via Task (read-only) to critique it as a staff engineer would — are slices truly vertical/independent? gates real and verifiable? any task hiding multiple concerns or a missing predecessor? drift from the spec? **Loop**: if it reports any ❌/⚠️, fix the plan and re-review until clean (or the user knowingly accepts a finding). Only then call ExitPlanMode. (Read-only review → allowed under the sequential law.)
- This is enforced deterministically: the `plan-review-gate` PreToolUse hook DENIES `ExitPlanMode` in a `/ccf-plan` session until it sees a `ccf-spec-checker` review in the transcript. This step is the defense-in-depth backup — do not rely on the hook alone.

## 7. Implement with agents
Direct the user to execute EACH task via the **`ccf-implementer`** subagent (which has MCP to query the Supabase/Railway DB if integrated + Context7/MS Learn) rather than the main thread. Keep the sequential law: do NOT run multiple implementers in parallel on dependent tasks. Each task should run in a fresh session (clean context). Record in the task file which agent + MCP to use. Keep `in-progress`/`done` status in `PLAN.md` up to date.

## 8. Closing
Advise executing each task in a fresh session; after implementation, recommend `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.
