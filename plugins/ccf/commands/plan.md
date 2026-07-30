---
description: Create a strictly sequential (waterfall) implementation plan, grounded in best practices. Requires plan mode.
argument-hint: "[feature or change to plan]"
allowed-tools: Read, Glob, Grep, Skill, Task, WebFetch, mcp__plugin_ccf_context7__resolve-library-id, mcp__plugin_ccf_context7__query-docs, mcp__plugin_ccf_microsoft-learn__*
model: opus
---

You are running CCF `/ccf:plan`.

## 0. Plan-mode gate (backup for the hook)
**STOP.** Verify the session is in **plan mode**. If NOT in plan mode, REFUSE: tell the user to enter plan mode (Shift+Tab to cycle to 'plan', or `--permission-mode plan`) and re-run `/ccf:plan`. Do not proceed. (The plan-mode-guard hook also blocks this deterministically; this is the backup layer.)

## 0a. Style for user-facing text (applies to every step below that writes text into the plan)
- **Scope boundary:** this rule governs CCF-generated text meant for the human reader (the plan body, task files, explanations to the user). It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself).
- Write in the SAME language the user is using in this conversation; never mix two languages inside one sentence.
- Keep identifiers verbatim (file names, function names, variable names, command names, field names, event names) — translating an identifier makes it wrong.
- Translate every other concept into the user's language (do not leave English jargon untranslated when a plain equivalent exists, e.g. gate, fold, spike, toggle, fail-open, surface, drift, premortem).
- No em dash; use a comma, colon, or parentheses instead.
- One idea per sentence; split a sentence longer than two lines.
- A language that uses diacritics (e.g. Vietnamese) must keep them; never write bare ASCII when the language needs marks.
- Do not invent abbreviations; if one is used, spell it out on first use.

## 1. Read existing context
Read `CLAUDE.md` (root + nested) + `.claude/rules/*` + `.claude/plan/PLAN.md`. The new plan must be consistent with the spec and slot into the existing sequential backlog.

## 1b. Discover the codebase with 5 parallel analyzers (NOT the built-in Explore)
Launch **5 `ccf-codebase-analyzer` subagents in parallel** via Task, each on ONE of the agent's **set B (planning) slices**. Pass `run_in_background: false` on all 5 and WAIT for every report before step 2 — since Claude Code v2.1.198 an omitted `run_in_background` defaults to background, which would let the interview start against reports that do not exist yet. This is read-only research, so parallelism is allowed here (same exemption as `/ccf:init` B1); it does NOT relax the sequential law, which governs WRITING work.

**Do NOT spawn the built-in `Explore` agent for this, and do NOT hand-explore the whole codebase in the main conversation.** CCF does not own `Explore`'s prompt, so it cannot be told what a CCF planner needs; `ccf-codebase-analyzer` is read-only by `disallowedTools`, returns a fixed report shape (including a mandatory **Unknowns** section), and keeps 5 slices of findings OUT of the main context window. Reading a specific file yourself is still fine — this bans the broad sweep, not targeted reads.

Give every one of the 5 the SAME context — the requested change (`$ARGUMENTS` plus anything already known from step 1) — then assign one slice each:
1. Impact surface (the files/functions the change must touch)
2. Patterns to conform to (nearest precedents + conventions)
3. Existing test surface (what covers it, and the EXACT command that runs it)
4. Integration points & dependencies (boundaries + data contracts)
5. Blast radius & fragility (what depends on it, where it is weak)

- **Skip ONLY on a greenfield project.** Check with Glob whether any source file exists outside `.claude/`, `CLAUDE.md` and docs. If there is no code to discover, skip this step and SAY SO in one line ("no source files yet, skipping codebase discovery"). Never skip silently, and never skip merely because the change looks small — "small" is a judgment the reports exist to check.
- **Model:** the analyzer's frontmatter default is `haiku` + `effort: low`, which suits slices 2-4. Slices 1 and 5 need more inference (who calls this, what breaks). Use the default, but STATE in one line which model you used, and offer to re-run with `sonnet` if the codebase is large or the reports come back thin. If the user has already named a model for this session, that choice WINS over the default.
- Reports are INPUT to the plan, not the plan. Do not copy them into the plan body; fold the relevant facts into the task files (files to touch, gate commands, predecessors) and cite the evidence paths the analyzers returned.

## 2. Interview
Invoke the `grill-me` skill via the Skill tool, passing `plan` as the argument. It interrogates the user **one question at a time** (exploring the code to self-answer first) and returns a summary of the answers. Fold that summary into the plan.
- **Feed step 1b into the interview.** The 5 reports already answer much of what the interview would otherwise ask blind, so pass their findings along: confirm rather than ask ("the analyzers found the tests run with `npm test` and that `foo.ts:42` is the only caller — still correct?"). Every item under a report's **Unknowns** heading is a candidate question, and the highest-value one: it is exactly what the code could not tell you.

## 3. Best-practice grounding
Before finalizing, raise the plan to best-practice quality: call Context7 (`resolve-library-id` → `query-docs`) for the libraries involved and Microsoft Learn for platform guidance — or delegate to `ccf-best-practice-researcher` via Task with `run_in_background: false` (since Claude Code v2.1.198 a Task spawn defaults to background unless told otherwise — see step 6 for why this matters here). Fold the findings into the plan.

## 4. The SEQUENTIAL law (CCF core)
- Plans are ALWAYS sequential waterfall. **Slice VERTICALLY, not horizontally:** each task is a thin tracer-bullet that crosses ALL layers it touches (DB + service + UI) for one small piece of behavior, so you get end-to-end feedback early. Do NOT phase the work as "all DB, then all API, then all FE" — that hides integration risk until the end.
- Order slices thinnest → richest (the first slice is the smallest end-to-end path that proves the wiring); each later slice adds one increment of behavior on top.
- **Right-size each slice.** A slice = the smallest end-to-end increment that is still COHESIVE, the size of one meaningful PR — do NOT fragment cohesive work into many micro-tasks. Split smaller ONLY when there is a REAL driver: (1) a genuine data dependency between the parts; (2) a need for an INDEPENDENT green gate (e.g. a hanging live-verify); (3) risk isolation (refactor SEPARATED from feature — the existing law is unchanged); (4) it does not fit one context/review. By default FOLD doc/spec/count-sync into the feature task it belongs to; split doc-sync out only when it is genuinely large/independent. (Still slice VERTICALLY as above — right-size tunes the THICKNESS of each slice, it does not drop the tracer-bullet.)
- Each task: spec → **failing test** → implement (verification-first — "the single highest-leverage thing").
- **NEVER run two agents in parallel on the same feature.** Finish slice 1 end-to-end → ONLY THEN start slice 2.
- Refactor and feature work are sequentially SEPARATE tasks, each with its own gate; NEVER hide a refactor inside a feature task.
- Default to one task at a time for quality. Rationale (Anthropic): phases that share context (planning→implementation→testing) belong in the main conversation; sequential prompt chaining trades latency for accuracy; tasks with many dependencies don't fit parallel multi-agent systems.

## 5. Plan output
Write/append task files `.claude/plan/task-NNN-*.md` (using the task-template). Each task = one right-sized, PR-sized vertical slice (cohesive, with its doc/spec-sync folded in by default — see step 4): goal, spec refs, files to touch, test written first, acceptance criteria, **exactly ONE predecessor**, and a **suggestion of which agent/MCP to use when implementing this task**. (In plan mode, the writing is presented as the plan for approval.)
- **Model line:** step 2's interview (the `grill-me` skill's plan-mode model question) only sets a single PLAN-WIDE default model — the task list does not exist yet at that point. Now that every task is known, apply that default to each task's `Model:` line, and offer a per-task OVERRIDE for any task that is unusually hard (many constraints → `opus`) or unusually simple/mechanical (→ `haiku`). Write the result as its own line in the task file, `Model: <alias>` — an ALIAS ONLY (e.g. `Model: sonnet`), never a dated model ID, and never any parenthetical/translated text on this line: `/ccf:cook` parses this exact line to pick the spawn model, so it must stay machine-readable in every plan language. If the user never answered the model question at all (step 2 skipped it, non-interactive), still write the plain `Model: sonnet` line, and separately — on its own sentence, in the plan's own output language per step 0a (e.g. Vietnamese "mô hình mặc định `sonnet` được dùng vì bạn chưa chọn") — tell the user that the default was used. Never leave the `Model:` line silently unfilled, and never fold the "default" note into the line itself.
- **Each slice is a gate:** name the test types that must be GREEN before the next slice starts (unit always; integration when it crosses a boundary; e2e/automation for the user-visible path). The next task does not begin until its predecessor's gate passes. State the gate explicitly in the task file.

### 5b. Test-discipline opt-in (ask BEFORE the review gate)
Before step 6, ask the user ONE question: **adopt the contract-level test discipline for THIS plan?** (If the project's `.claude/rules/testing.md` already has the "Test design discipline" block / `Matrix required: yes`, default to ON and just confirm; otherwise default OFF.) Ask here — never between the step-6 review and ExitPlanMode (the `plan-review-gate` hook acts there; placing the question before step 6 keeps it clear of the gate).
- **ON** → write into EACH task's gate that it must include the **contract-level matrix tests** (EP / BVA / decision-table at the function's public signature) **and an actual test run** before the gate is GREEN. Record `discipline: on` in the task file so `ccf-implementer` designs + writes the matrix (EP/BVA/decision-table) as part of its failing-test-first flow and `ccf-spec-checker` enforces it.
- **OFF** → plans behave exactly as today; gates keep the unit/integration/e2e wording from step 5, no matrix is forced (ship-fast unaffected).

## 6. Review the plan (MANDATORY GATE — fresh-context, staff-engineer)
**STOP. Do NOT call ExitPlanMode (do NOT present the plan for approval) until** a fresh-context `ccf-spec-checker` subagent has reviewed the PLAN ITSELF (not the code). Delegate via Task (read-only) **with `run_in_background: false`** — since Claude Code v2.1.198 a Task spawn omitting this defaults to running in the background, which would let ExitPlanMode fire before the review exists and defeat this very gate — to critique it as a staff engineer would — are slices truly vertical/independent? gates real and verifiable? any task hiding multiple concerns or a missing predecessor? drift from the spec? It ALSO returns a **premortem / prospective-failure lens** (top 2–4 failure modes anchored to this project's real past iterations, each with a preventing change). The anchor history lives in **`.claude/plan/ARCHIVE.md`** once an iteration closes, with only the current iteration's "Closed" notes left in `PLAN.md` — tell the reviewer to read both, otherwise it reports `anchor: none` on a project that in fact has years of precedent. **Loop**: if it reports any ❌/⚠️, fix the plan and re-review until clean (or the user knowingly accepts a finding). **Every H-likelihood premortem finding MUST be resolved** before ExitPlanMode — fix the plan OR have the user knowingly accept it — and record each H-finding's **disposition** (`fixed-by …` / `accepted-because …`) so an accepted high risk is auditable. Only then call ExitPlanMode. (Read-only review → allowed under the sequential law.)
- This is enforced deterministically: the `plan-review-gate` PreToolUse hook DENIES `ExitPlanMode` in a `/ccf:plan` session until it sees a `ccf-spec-checker` review in the transcript. This step is the defense-in-depth backup — do not rely on the hook alone.
- **OPTIONAL cross-model second opinion:** if the official `/advisor` command is available (OPTIONAL, may be absent on an older Claude Code build), the user MAY run `/advisor sonnet` or `/advisor fable` to have a DIFFERENT model sanity-check the plan alongside the same-model `ccf-spec-checker` review. This is a SUPPLEMENT, never a substitute — it does NOT replace `ccf-spec-checker`, which stays the mandatory gate enforced by `plan-review-gate` above.

## 7. Implement with agents
Direct the user to execute EACH task via the **`ccf-implementer`** subagent (which has MCP to query the Supabase/Railway DB if integrated + Context7/MS Learn) rather than the main thread. Keep the sequential law: do NOT run multiple implementers in parallel on dependent tasks. Each task should run in a fresh session (clean context). Record in the task file which agent + MCP to use. Keep the `PLAN.md` status up to date through the lifecycle **`todo → in-progress → in-review → done`**: `ccf-implementer` marks `in-review` when code+test are complete; **only `/ccf:updatespec` writes `done`**, after `/ccf:check` + `/code-review` pass.

## 8. Closing
Advise executing each task in a fresh session; after implementation, recommend `/ccf:check` → `/code-review` → `/ccf:updatespec`. If the project opted into the test discipline, remind them the contract-level matrix tests written by `ccf-implementer` must actually pass (run the project's test command) before `/code-review`. Fresh-session-per-task stays the quality default — but if the user wants to run the whole backlog in one go, point them at **`/ccf:cook`**: it drives the sequential implement loop + batch-verify (review + `/code-review` in parallel, `/simplify`, re-gate, `/ccf:updatespec`) automatically as a convenience option.
