---
description: Create a strictly sequential (waterfall) implementation plan, grounded in best practices. Requires plan mode.
argument-hint: "[feature or change to plan]"
allowed-tools: Read, Glob, Grep, Skill, Task, AskUserQuestion, WebFetch, mcp__plugin_ccf_context7__resolve-library-id, mcp__plugin_ccf_context7__query-docs, mcp__plugin_ccf_microsoft-learn__*
model: opus
---

You are running CCF `/ccf:plan`.

## 0. Plan-mode gate (backup for the hook)
**STOP.** Confirm this session is in plan mode before anything else. If it is not, refuse to continue: tell the user to enter plan mode (Shift+Tab cycles to 'plan', or start the session with `--permission-mode plan`), then re-run `/ccf:plan`. Do not run any step below. The `plan-mode-guard` hook blocks this deterministically too; this sentence is the backup for the case where the hook does not fire.

## 0a. Style for user-facing text (applies to every step below that writes text into the plan)
**Scope boundary:** this rule governs CCF-generated text meant for the human reader (the plan body, task files, explanations to the user). It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself).
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

## 1. Read existing context
Read `CLAUDE.md` (root + nested) + `.claude/rules/*` + `.claude/plan/PLAN.md`. The new plan must be consistent with the spec and slot into the existing sequential backlog.

## 1b. Discover the codebase with 5 parallel analyzers
Launch **5 `ccf-codebase-analyzer` subagents in parallel** via Task, each on ONE of the agent's **set B (planning) slices**. Pass `run_in_background: false` on all 5 and wait for every report before step 2: since Claude Code v2.1.198 an omitted `run_in_background` defaults to background, which would let the interview start against reports that do not exist yet. Read-only research may fan out; that exemption (shared with `/ccf:init` B1) does not touch the sequential law, which governs WRITING work.

Route discovery through `ccf-codebase-analyzer` rather than the built-in `Explore` agent, and do not sweep the whole codebase by hand in the main conversation. CCF does not own `Explore`'s prompt, so it cannot be told what a planner needs; `ccf-codebase-analyzer` is read-only by `disallowedTools`, returns a fixed report shape with a mandatory **Unknowns** section, and keeps 5 slices of findings out of the main context window. Reading a specific file yourself stays fine, since the ban is on the broad sweep. Every CCF subagent is read-only, used for discovery, review or best-practice grounding; none of them writes code — see step 6 below.

Give every one of the 5 the SAME context — the requested change (`$ARGUMENTS` plus anything already known from step 1) — then assign one slice each:
1. Impact surface (the files/functions the change must touch)
2. Patterns to conform to (nearest precedents + conventions)
3. Existing test surface (what covers it, and the EXACT command that runs it)
4. Integration points & dependencies (boundaries + data contracts)
5. Blast radius & fragility (what depends on it, where it is weak)

- **Skip ONLY on a greenfield project.** Check with Glob whether any source file exists outside `.claude/`, `CLAUDE.md` and docs. With no code to discover, skip this step and say so in one line ("no source files yet, skipping codebase discovery"). Never skip silently, and never skip because the change looks small: "small" is a judgment the reports exist to check.
- **Model — ask, do not decide silently.** Before spawning, use `AskUserQuestion` ONCE to ask which model runs all 5 analyzers. **Recommend `haiku`** and label it as the recommendation: the slices gather evidence over a bounded surface, `haiku` is the agent's frontmatter default paired with `effort: low`, and 5 spawns of a stronger model on every plan costs real money for little gain. Offer `sonnet` as the step-up for a large or unfamiliar codebase, where slices 1 and 5 need the most inference (who calls this, what breaks), and `opus` only if the user asks. Accept a model ALIAS only, never a dated model ID.
  - Do not spawn `sonnet` (or anything else) just because it is the session's model. The analyzer's `model` frontmatter is a DEFAULT, and a call site overriding it without asking is the behavior this bullet exists to stop.
  - If `AskUserQuestion` is genuinely unavailable (non-interactive session), fall back to `haiku` and say in one line that the default was used because asking was blocked. Never proceed as if the user had chosen.
  - If the user already named an analyzer model earlier in this session, reuse it without re-asking.
- Reports are INPUT to the plan, not the plan. Fold their relevant facts into the task files (files to touch, gate commands, predecessors) and cite the evidence paths the analyzers returned, instead of copying report text into the plan body.

## 2. Interview
Invoke the `grill-me` skill via the Skill tool, passing `plan` as the argument. It interrogates the user **one question at a time** (exploring the code to self-answer first) and returns a summary of the answers. Fold that summary into the plan.
- **Feed step 1b into the interview.** The 5 reports already answer much of what the interview would otherwise ask blind, so pass their findings along and confirm rather than ask: "the analyzers found the tests run with `npm test` and that `foo.ts:42` is the only caller — still correct?". Every item under a report's **Unknowns** heading is a candidate question, and the highest-value one, because it is exactly what the code could not tell you.

## 3. Best-practice grounding
Before finalizing, raise the plan to best-practice quality: call Context7 (`resolve-library-id` → `query-docs`) for the libraries involved and Microsoft Learn for platform guidance, or delegate to `ccf-best-practice-researcher` via Task with `run_in_background: false` (since Claude Code v2.1.198 a Task spawn defaults to background unless told otherwise, which would let step 4 finalize the plan before the report exists). Fold the findings into the plan.

## 4. The SEQUENTIAL law (CCF core)
- Plans are always sequential waterfall. **Slice VERTICALLY, not horizontally:** each task is a thin tracer-bullet that crosses ALL layers it touches (DB + service + UI) for one small piece of behavior, so integration feedback arrives early. Phasing the work as "all DB, then all API, then all FE" hides integration risk until the end.
- Order slices thinnest → richest. The first slice is the smallest end-to-end path that proves the wiring; each later slice adds one increment of behavior on top.
- **Right-size each slice.** A slice is the smallest end-to-end increment that is still COHESIVE, the size of one meaningful PR. Keep cohesive work in one task instead of fragmenting it into micro-tasks, and split smaller only on a real driver: (1) a genuine data dependency between the parts; (2) a need for an INDEPENDENT green gate (e.g. a hanging live-verify); (3) risk isolation, meaning a refactor SEPARATED from a feature; (4) it does not fit one context or one review. By default fold doc/spec/count-sync into the feature task it belongs to, and split doc-sync out only when it is genuinely large and independent. Right-size tunes the THICKNESS of each slice; the tracer-bullet stays vertical either way.
- Each task: spec → **failing test** → implement (verification-first, "the single highest-leverage thing").
- **One task at a time.** Finish slice 1 end-to-end (implemented directly in this session, see step 6) before starting slice 2.
- Refactor and feature work are sequentially SEPARATE tasks, each with its own gate. **Never hide a refactor inside a feature task**, because a mixed task leaves the gate unable to tell which of the two changes broke it.

## 5. Plan output
Write/append task files `.claude/plan/task-NNN-*.md` (using the task-template). Each task is one right-sized, PR-sized vertical slice, cohesive, with its doc/spec-sync folded in by default per step 4: goal, spec refs, files to touch, test written first, acceptance criteria, and **exactly ONE predecessor**. Name any MCP the task will need (e.g. a project DB MCP), since that is still a real per-task decision; there is no per-task model or agent choice to record, because every task is implemented directly in this session (step 6). In plan mode, the writing is presented as the plan for approval.
- **Each slice is a gate:** name the test types that must be GREEN before the next slice starts (unit always; integration when it crosses a boundary; e2e/automation for the user-visible path). The next task does not begin until its predecessor's gate passes. State the gate explicitly in the task file.

### 5b. Test-discipline opt-in
Ask the user ONE question: **adopt the contract-level test discipline for THIS plan?** If the project's `.claude/rules/testing.md` already carries the "Test design discipline" block or `Matrix required: yes`, default to ON and just confirm; otherwise default OFF.
- **ON** → write into EACH task's gate that it must include the **contract-level matrix tests** (EP / BVA / decision-table at the function's public signature) **and an actual test run** before the gate is GREEN. Record `discipline: on` in the task file, since the matrix is designed and written as part of the failing-test-first flow when the task is implemented, and `/ccf:check` enforces it.
- **OFF** → plans behave exactly as today; gates keep the unit/integration/e2e wording from step 4 and no matrix is forced, so ship-fast is unaffected.

## 6. Implement directly, one task at a time
Implement each task **in this same session, directly** — do not spawn a subagent to write the code. Spawning a coding subagent adds a wait for its own separate context and result, which is slower than writing the code yourself with the full plan and codebase context already loaded; CCF's subagents are reserved for read-only work (codebase discovery, best-practice research, spec review), never for coding. Keep the sequential law regardless: finish one task's failing-test-first flow, implementation, and self-check before touching the next task's files.
- Follow the process per task: read the task file (goal, spec refs, acceptance criteria, files to touch), read `.claude/rules/*` + `CLAUDE.md` for conventions, write the **failing test first** and confirm it is red, implement the minimum that turns it green, re-run it and note the actual result, then self-check the diff against the coding rules before moving on.
- **Scope discipline (anti-over-engineering):** build only what the acceptance criteria require; an abstraction, config flag, or dependency nothing in the task consumes is speculative, so leave it out. Do not refactor code the task did not ask you to change, even when you see a better shape; note the observation and let a future task carry it. Touch no other task's files.
- Keep `PLAN.md`'s status current through the lifecycle **`todo → in-progress → in-review → done`**: mark a task `in-review` once its code and tests are complete, and **only `/ccf:updatespec` writes `done`**, after `/ccf:check` passes.
- Write each status as a **bare word, with no markdown emphasis** (`in-review`, not `**in-review**`). The Stop hook's `lib/plan.mjs` compares the status cell against anchored predicates, and although it strips emphasis defensively, decorating the cell has already made two finished tasks read as open in this project's own history.
- For a backlog of several tasks, `/ccf:cook` runs this same one-task-at-a-time loop end to end without re-invoking each task by hand.

## 7. Closing
After implementing (this session or via `/ccf:cook` for the whole backlog), run **`/ccf:check`** once: that is the single verify step CCF requires before marking work done, not a multi-gate pipeline. If it comes back clean, run `/ccf:updatespec` to refresh the spec and mark the task(s) `done`. If it reports a `FAIL:` finding, fix it and re-run `/ccf:check` before moving on. `/code-review` remains a good optional extra the user can run for additional quality feedback, but it is not a required step.
