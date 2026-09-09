---
description: Execute the entire todo/in-progress backlog sequentially in this session, then run /ccf:check once and /ccf:updatespec.
argument-hint: "[optional: task range]"
allowed-tools: Read, Glob, Grep, Task, Skill, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, Bash
model: opus
---

You are running CCF `/ccf:cook`. You are the **backlog orchestrator**: once `/ccf:plan` has produced a sequential task queue, you drive it end to end, implementing each task directly in this session, one at a time, then run a single verify step, without the user re-invoking each task by hand.

**Mutually exclusive with `auto-verify.mjs --auto-verify`:** you drive the same verify step that hook drives, so only one of the two may be active. Step 6 has the details.

## 0a. Style for user-facing text (applies to every step below that writes text for the user)
**Scope boundary:** this rule governs the text you show the user (the ordered task list, the per-slice gate result, the stop-and-report message). It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself). Marker words, section headings and identifiers stay verbatim in every language, because the verify step parses them.
- Write in the SAME language the user is using in this conversation; never mix two languages inside one sentence.
- Keep identifiers verbatim (file names, function names, variable names, command names, field names, event names) — translating an identifier makes it wrong.
- Translate a concept when the user's language has a natural equivalent; keep a difficult or ambiguous English term verbatim and add a short parenthetical explanation on first use.
- No em dash; use a comma, colon, or parentheses instead.
- One idea per sentence; split a sentence longer than two lines.
- A language that uses diacritics (e.g. Vietnamese) must keep them; never write bare ASCII when the language needs marks.
- Do not invent abbreviations; if one is used, spell it out on first use.
- Open with the point itself; never with generic filler. End when the content ends; never restate what was just said as a summary.
- Cut adjectives that add no information; a claim earns its adjective with a concrete fact, number, or name.
- Use as many bullets as there are real points, never a rounded count; prefer plain prose when ideas are not parallel.
- Prefer a specific example, number, or name over an abstract description; give one clear recommendation instead of an option list with no conclusion; state uncertainty plainly.
- Vary sentence length; do not repeat the same key phrase within a paragraph.
- No icons or emoji in generated text; review markers use the word set FAIL:/WARN:/PASS:.

## 1. Read the backlog
Read `.claude/plan/PLAN.md` plus the relevant `.claude/plan/task-NNN-*.md` files. `PLAN.md` holds the CURRENT iteration; closed iterations live in `.claude/plan/ARCHIVE.md` and are never eligible. Select the `todo` and `in-progress` tasks in dependency order, respecting each `Depends on`: a task whose predecessor is still open is not eligible yet. If `$ARGUMENTS` names a task range, restrict to it; otherwise take the full eligible backlog. State the ordered task list to the user before starting.

### 1b. Mirror the queue into the session task list
Call **`TaskList`** first, since an earlier run may have left entries to reuse or clean rather than duplicate. Then **`TaskCreate`** one entry per selected task, in execution order, and use `addBlockedBy` via `TaskUpdate` to encode each `Depends on` edge, so the sequential law is visible in the list and not only in this prompt.

A backlog run is the one place in CCF that genuinely warrants the session list: the official trigger criteria are three or more distinct steps, a user-supplied list of items, non-trivial work that benefits from progress tracking, and an explicit user request, and this run matches all four at once.

Two constraints, both load-bearing:
- **The session task list is EPHEMERAL and is not the plan.** It exists for the current coding session only. `.claude/plan/PLAN.md` stays the single source of truth for status across sessions, so every status change is written there as well, never only via `TaskUpdate`. The two lifecycles differ on purpose: the session list runs `pending → in_progress → completed`, `PLAN.md` runs `todo → in-progress → in-review → done`. A finished slice reaches `completed` in the session list but only `in-review` in `PLAN.md`; mapping `completed` onto `done` would forge a gate only `/ccf:updatespec` may write.
- **`TaskCreate` / `TaskUpdate` / `TaskList` are NOT the `Task` spawn tool** despite the shared prefix: `Task` spawns a subagent, these three manage a checklist. If the harness does not expose them (they are unavailable when `CLAUDE_CODE_ENABLE_TASKS=0` restores the legacy `TodoWrite`), skip this sub-step, say so in one line, and run the backlog from `PLAN.md` alone. Never fall back to `TodoWrite`, which has been disabled by default since Claude Code v2.1.142.

## 2. Sequential implement loop, directly in this session (one slice at a time, the CCF law)
Implement each task **yourself, in this same session** — do not spawn a `Task`/subagent to write the code. A spawned coding subagent means waiting on a separate context with its own setup and its own result to read back, which is strictly slower than writing the code directly with the plan and codebase already loaded in this conversation; that is why CCF reserves its subagents for read-only work (codebase discovery, best-practice research, spec review) and implements everything else here.

For EACH task, in order:
0. `TaskUpdate` this task's session entry to `in_progress` **before** starting, so the list reflects reality instead of being back-filled afterwards.
1. Read the task file: goal, spec refs, acceptance criteria, files to touch, the test to write first. When it needs a DB schema or library documentation, use whatever MCP the project provides (Context7, MS Learn, a project DB MCP), loading its schema with `ToolSearch` first if it is not already available.
2. **If the task indicates the test discipline is ON** (`discipline: on` in the task file, or its gate names the matrix tests): design the contract-level EP/BVA/decision-table matrix for the function's public signature first, then write the tests from it.
3. **Write the failing test first** and run it to confirm it is red. A test that has never been red proves nothing.
4. Implement the minimum that turns the test green and meets the acceptance criteria. Build only what the acceptance criteria require: no speculative abstraction, no refactor the task did not ask for, no touching another task's files.
5. Re-run the test and note the actual result, including the exact command.
6. **Check the slice gate**, meaning the command the task file names:
   - **GREEN** → self-check the diff against `.claude/rules/*` and fix any violation, `TaskUpdate` the session entry to `completed`, write `in-review` (never `done`) into the `PLAN.md` status column, then move to the next task.
   - **RED** → **STOP immediately.** Tell the user which task failed and why, implement no further task, and do not run step 5's verify. **Leave the session entry `in_progress`**, because a red gate is unfinished work and marking it `completed` would erase the only signal that the run stopped here. The sequential law is absolute: never touch two tasks' files at once, and never move past a red gate.
7. Recommend `/compact` between slices once the transcript grows large (step 7).

## 3. Verify: a single `/ccf:check`, not a multi-gate pipeline
Once every selected task is `in-review`, run **`/ccf:check`** once over the whole batch (Skill tool, or instruct the user to run it). This is the ONE verify step CCF requires: since every task was implemented directly in this session rather than by a separate subagent, one fresh-context review is enough, and there is no separate implementer output to re-check.
- **If it reports a `FAIL:` finding**, **STOP here** and report it to the user; do not run `/ccf:updatespec`.
- **If the project opted into the test discipline** (`.claude/rules/testing.md` carries the "Test design discipline" block or `Matrix required: yes`, and the task files record `discipline: on`): `/ccf:check` itself confirms the contract-level matrix tests actually pass as part of its own step 5 (verification-first, run the tests). With the discipline off, this is unchanged: no matrix is forced.
- `/code-review` remains a good optional extra the user can run for additional quality feedback (Skill tool), but it is not part of this mandatory chain.

## 4. `/ccf:updatespec`
**Only if** step 3 came back clean (no `FAIL:` finding), invoke `/ccf:updatespec` (via the Skill tool, or instruct the user to run it) to mark the tasks `done`. **Any `FAIL:` finding anywhere → STOP, report to the user, and leave every task at `in-review`.**

## 5. Fallback when Skill or SlashCommand is not exposed
Not every harness exposes the Skill tool, or a SlashCommand tool for `/ccf:check` and `/ccf:updatespec`; this varies by environment, so verify rather than assume. When a call fails or the tool is absent: **tell the user explicitly** which step could not be auto-invoked, and hand them the same order to run by hand (`/ccf:check` → `/ccf:updatespec`), which is the manual sequence `auto-verify.mjs` documents as its own fallback.

## 6. Relationship with `auto-verify.mjs`
`/ccf:cook` and the opt-in `auto-verify.mjs` Stop hook drive the SAME verify step, so run one or the other:
- When you use `/ccf:cook`, leave `--auto-verify` out of `hooks.json`, or the step gets driven twice.
- When `/ccf:cook` DID run `/ccf:check` (step 3), the hook's `checkAlreadyRan` / `hasSpecCheckerSpawn` guard sees the `ccf-spec-checker` spawn that `/ccf:check` makes in the transcript (spawned, not necessarily finished — see that function's own note) and suppresses a redundant drive at Stop, so leaving `--auto-verify` on is merely redundant there.
- In the **manual-fallback branch** (step 5, where no such spawn happened because Skill was unavailable), that guard does not fire, since there is no `ccf-spec-checker` entry to detect. The hook re-driving the step at Stop is correct there: it picks up exactly the work `/ccf:cook` could not finish itself.

## 7. Context management
Suggest `/compact` between implement slices (step 2) once the transcript grows large, since a long sequential backlog accumulates context fast. Recommend invoking `/ccf:cook` over a **small backlog** each time, a handful of tasks rather than a whole multi-iteration plan, so one session stays inside a manageable context budget and a red gate stops the loop early instead of deep in a long queue.

**Optional secondary stop condition:** if the official `/goal` command is available (it may be absent on an older Claude Code build), the user may set a condition such as `/goal all selected tasks are in-review` to keep the session working across the implement loop. That is a convenience only: a RED gate still stops the loop immediately (step 2.6), whatever any `/goal` condition says.

## Notes
- Never touch two tasks' files at once. Implementation always happens directly in this session; the only agents CCF ever spawns are read-only (`ccf-codebase-analyzer`, `ccf-best-practice-researcher`, `ccf-spec-checker`, `ccf-spec-writer`), used for discovery, review or grounding, never for writing code.
