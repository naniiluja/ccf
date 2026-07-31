---
description: Execute the entire todo/in-progress backlog sequentially via ccf-implementer, then batch-verify (review + code-review in parallel, simplify, re-gate, updatespec).
argument-hint: "[optional: task range]"
allowed-tools: Read, Glob, Grep, Task, Skill, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, Bash(npx:*), Bash(node:*), Bash(claude:*)
model: opus
---

You are running CCF `/ccf:cook`. You are the **backlog orchestrator**: once `/ccf:plan` has produced a sequential task queue, you drive it end to end, one implementer slice at a time followed by a batch-verify pass, without the user re-invoking each step by hand.

**Mutually exclusive with `auto-verify.mjs --auto-verify`:** you drive the same verify chain that hook drives, so only one of the two may be active. Step 7 has the details.

## 0a. Style for user-facing text (applies to every step below that writes text for the user)
**Scope boundary:** this rule governs the text you show the user (the ordered task list, the per-slice gate result, the stop-and-report message). It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself). Marker words, section headings and identifiers stay verbatim in every language, because the verify chain parses them.
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

## 2. Sequential implement loop (one slice at a time, the CCF law)
**Since Claude Code v2.1.198 a Task spawn that omits `run_in_background` runs in the background**, which silently breaks the sequential law by letting the next step fire before the implementer finishes. No agent-frontmatter field fixes this (`background: true` only forces backgrounding, and a `false` value is not documented), so the lever is the CALL SITE: every `Task` spawn below passes `run_in_background: false` explicitly.

For EACH task, in order:
0. `TaskUpdate` this task's session entry to `in_progress` **before** spawning, so the list reflects reality instead of being back-filled afterwards.
1. Spawn `ccf-implementer` via **Task** with `run_in_background: false`, passing the task file path, and set the model from a **model override read from that task file's `Model:` line** — an alias such as `sonnet`, `opus` or `haiku`. Pass the alias, never a dated model ID like `claude-sonnet-5`, so the spawn tracks whatever the alias currently resolves to. If the task file carries no `Model:` line, **ask with `AskUserQuestion`** ONCE for the whole run and apply that one answer to every spawn. **Recommend `sonnet`** and label it as the recommendation, because a CCF task is an already-sliced, spec-clear unit, which is also why it is the agent's frontmatter default; offer `opus` for a backlog of unusually hard tasks and `haiku` for mechanical text edits. Spawn the session's own model only if the user picks it, never by default. If `AskUserQuestion` is unavailable (non-interactive session), fall back to `sonnet` and say in one line that the default was used because asking was blocked, so the user is never left thinking they chose it.
2. Wait for it to finish, then read its report: which test, type-check or validate command it ran, and the actual result.
3. **Check the slice gate**, meaning the command the task file names, per that report:
   - **GREEN** → `TaskUpdate` the session entry to `completed`, write `in-review` (never `done`) into the `PLAN.md` status column, then move to the next task.
   - **RED** → **STOP immediately.** Tell the user which task failed and why, spawn no further implementer, and do not start batch-verify. **Leave the session entry `in_progress`**, because a red gate is unfinished work and marking it `completed` would erase the only signal that the run stopped here. The sequential law is absolute: never two `ccf-implementer` spawns at once, and never a step past a red gate.
4. Recommend `/compact` between slices once the transcript grows large (step 8).

## 3. Batch-verify phase (after ALL slices are implemented)
Once every selected task is `in-review`, run TWO READ-ONLY checks **in parallel**, which is safe here precisely because neither touches files, unlike the writer loop above:
- **(a) Spec/code review** — spawn `ccf-spec-checker` via Task with `run_in_background: false`. This is the CCF-spawned side, capped at **3 agents or fewer** per the sequential-work-unit convention; one reviewer is normally enough, so the cap is rarely binding.
- **(b) `/code-review`** — invoke via the **Skill tool**, since it is a bundled Skill rather than a slash command (step 6 covers the case where it is not exposed). Its internal fan-out is tuned by **effort** (low/high/ultra), a different mechanism from (a)'s numeric cap.

Gather both results. If EITHER returns a `FAIL:` finding (a `### Violations` entry from `ccf-spec-checker`) or any correctness finding, **STOP here** and report to the user; do not run `/simplify` or `/ccf:updatespec`.

**If the project opted into the test discipline** (`.claude/rules/testing.md` carries the "Test design discipline" block or `Matrix required: yes`, and the task files record `discipline: on`): `ccf-implementer` already designed and wrote the contract-level EP/BVA/decision-table matrix tests for each slice during step 2, as part of its failing-test-first flow rather than a separate command. After the read-only pair comes back clean, RUN the project's test command to confirm those matrix tests actually pass, before `/simplify`. That keeps this chain aligned with `auto-verify.mjs`'s `buildVerifyReason`, which also runs the matrix tests when the discipline is on. With the discipline off, skip this: no matrix is forced.

## 4. `/simplify` (runs alone, after the read-only pair finishes)
`/simplify` **WRITES files** — cleanup for helper reuse, simplification, efficiency and abstraction level, a fixed 4-parallel-agent fan-out that is not numerically cappable. Invoke it via the **Skill tool** only after both (a) and (b) from step 3 have finished, so no read-only reviewer is diffing the tree while `/simplify` rewrites it.

## 5. Re-gate after `/simplify`, then `/ccf:updatespec`
`/simplify` can change code, so re-run the **deterministic** gates only. This is not a fresh correctness review, which already happened in step 3; it confirms that `/simplify`'s edits broke nothing mechanical:
- `npx -p typescript tsc --noEmit`
- `node --test plugins/ccf/hooks/lib/*.test.mjs` (plus any template libs the tasks touched)
- `claude plugin validate plugins/ccf`

**Only if** step 3's review and `/code-review` came back clean (no `FAIL:` finding) **AND** this re-gate is green, invoke `/ccf:updatespec` (via the Skill tool, or instruct the user to run it) to mark the tasks `done`. **Any `FAIL:` finding or red gate anywhere → STOP, report to the user, and leave every task at `in-review`.**

## 6. Fallback when Skill or SlashCommand is not exposed
Not every harness exposes the Skill tool, or a SlashCommand tool for `/code-review`, `/simplify` and `/ccf:updatespec`; this varies by environment, so verify rather than assume. When a call fails or the tool is absent: **tell the user explicitly** which step could not be auto-invoked, and hand them the same order to run by hand (`/ccf:check` → `/code-review` → the project's test command if the test discipline is on → `/simplify` → re-gate → `/ccf:updatespec`), which is the manual sequence `auto-verify.mjs` documents as its own fallback.

## 7. Relationship with `auto-verify.mjs`
`/ccf:cook` and the opt-in `auto-verify.mjs` Stop hook drive the SAME verify chain, so run one or the other:
- When you use `/ccf:cook`, leave `--auto-verify` out of `hooks.json`, or the chain gets driven twice.
- When `/ccf:cook` DID spawn `ccf-spec-checker` via Task (step 3a), the hook's `checkAlreadyRan` / `hasSpecCheckerSpawn` guard sees that spawn in the transcript (spawned, not necessarily finished — see that function's own note) and suppresses a redundant drive at Stop, so leaving `--auto-verify` on is merely redundant there.
- In the **manual-fallback branch** (step 6, where no Task spawn happened because Skill was unavailable), that guard does not fire, since there is no `ccf-spec-checker` entry to detect. The hook re-driving the chain at Stop is correct there: it picks up exactly the work `/ccf:cook` could not finish itself.

## 8. Context management
Suggest `/compact` between implement slices (step 2) once the transcript grows large, since a long sequential backlog accumulates context fast. Recommend invoking `/ccf:cook` over a **small backlog** each time, a handful of tasks rather than a whole multi-iteration plan, so one session stays inside a manageable context budget and a red gate stops the loop early instead of deep in a long queue.

**Optional secondary stop condition:** if the official `/goal` command is available (it may be absent on an older Claude Code build), the user may set a condition such as `/goal all selected tasks are in-review` to keep the session working across the implement loop. That is a convenience only: a RED gate still stops the loop immediately (step 2.3), whatever any `/goal` condition says.

## Notes
- The **cap of 3 agents** applies ONLY to CCF-spawned work via Task, meaning `ccf-spec-checker` in step 3a. Built-in `/code-review` and `/simplify` fan out internally: `/code-review`'s depth is tuned by `effort` and `/simplify` is fixed at 4 parallel agents, and neither is cappable from outside. Two different mechanisms, so do not reason from one to the other.
- Never two `ccf-implementer` agents at once, and never a writer (`ccf-implementer` or `/simplify`) at the same time as anything else that touches files.
