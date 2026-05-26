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
Invoke the `grill-me` skill to interview the user **one question at a time** about this specific feature: acceptance criteria, edge cases, data shape, failure modes, test cases. Explore the codebase to self-answer before asking.

## 3. Best-practice grounding
Before finalizing, raise the plan to best-practice quality: call Context7 (`resolve-library-id` → `query-docs`) for the libraries involved and Microsoft Learn for platform guidance — or delegate to `ccf-best-practice-researcher` via Task. Fold the findings into the plan.

## 4. The SEQUENTIAL law (CCF core)
- Plans are ALWAYS sequential waterfall. Order tasks smallest → largest.
- Each task: spec → **failing test** → implement (verification-first — "the single highest-leverage thing").
- **NEVER run two agents in parallel on the same feature.** For features A, B, C: finish A's BE → A's FE → ONLY THEN start B.
- Default to one task at a time for quality. Rationale (Anthropic): phases that share context (planning→implementation→testing) belong in the main conversation; sequential prompt chaining trades latency for accuracy; tasks with many dependencies don't fit parallel multi-agent systems.

## 5. Plan output
Write/append task files `.claude/plan/task-NNN-*.md` (using the task-template). Each task = one PR-sized unit: goal, spec refs, files to touch, test written first, acceptance criteria, **exactly ONE predecessor**, and a **suggestion of which agent/MCP to use when implementing this task**. (In plan mode, the writing is presented as the plan for approval.)

## 6. Implement with agents
Direct the user to execute EACH task via the **`ccf-implementer`** subagent (which has MCP to query the Supabase/Railway DB if integrated + Context7/MS Learn) rather than the main thread. Keep the sequential law: do NOT run multiple implementers in parallel on dependent tasks. Each task should run in a fresh session (clean context). Record in the task file which agent + MCP to use. Keep `in-progress`/`done` status in `PLAN.md` up to date.

## 7. Closing
Advise executing each task in a fresh session; after implementation, recommend `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.
