---
description: Bootstrap a new project or onboard an existing one into the CCF workflow — generate CLAUDE.md + .claude specs + an initial sequential plan.
argument-hint: "[optional: short description of what you want to build]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, AskUserQuestion, WebFetch, mcp__plugin_ccf_context7__resolve-library-id, mcp__plugin_ccf_context7__query-docs, mcp__plugin_ccf_microsoft-learn__*
model: opus
---

You are running CCF `/ccf:init`. Produce a best-practice-grounded context layer (`CLAUDE.md` plus `.claude/`) and an initial sequential implementation plan, following Anthropic's Explore then Plan workflow. Write no application code in this command: `/ccf:plan` details the first feature and `ccf-implementer` writes the code for it.

Templates live in `${CLAUDE_PLUGIN_ROOT}/templates/`. Read them and instantiate them, replacing every `{{...}}` placeholder, when you write real files into the project.

## 0a. Style for user-facing text
**Scope boundary:** this rule governs CCF-generated text meant for the human reader (the decisions summary, the plan and task files this command writes, explanations shown to the user). It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself).
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

## 0. Classify the project
Scan `cwd` read-only (Glob `**/*` excluding `node_modules` and `.git`; check for `package.json`, `src/`, an existing `CLAUDE.md`). Classify the project as **EMPTY** (nothing substantial yet) or **EXISTING** (has code), then run the matching branch below.

## Reference: folding the testing answers into `testing.md.tmpl`
Both A3 and B3 instantiate this template, so the fold lives here once. `grill-me` only ASKS about testing; `/ccf:init` is what WRITES the answers, which makes this step deterministic rather than a judgment call.
- Always fill `{{TEST_FRAMEWORK}}` / `{{TEST_CMD}}` / `{{TEST_LOCATION}}` / `{{COVERAGE_TARGET}}`. In A3 they come from the interview answers; in B3 from the test setup the analyzers observed and the interview confirmed.
- Discipline opt-in **ON** → set `{{TEST_MATRIX_REQUIRED}}` to `yes`, keep the "Test design discipline" block, fill `{{INTEGRATION_TEST_SCOPE}}` / `{{E2E_TEST_SCOPE}}` (from the answers, or from the codebase's existing test layers, or from sensible per-app-type defaults), and set `{{TEST_GATE_ENFORCEMENT}}` to `prompt-only` or `stop-hook` per the enforcement answer.
  - Enforcement `stop-hook` → also generate the project's own `.claude/hooks/` gate, stripping the `.tmpl` suffix on each instantiated file:
    - `templates/root/.claude/hooks/test-gate.mjs.tmpl` → `.claude/hooks/test-gate.mjs`
    - `templates/root/.claude/hooks/hooks.json.tmpl` → `.claude/hooks/hooks.json`
    - `templates/root/.claude/hooks/lib/test-gate-core.mjs` → `.claude/hooks/lib/test-gate-core.mjs`, copied VERBATIM (it carries no `.tmpl` suffix and no placeholders). This lib is required, because `test-gate.mjs` does `import { shouldBlockStop } from "./lib/test-gate-core.mjs"` and omitting the lib makes the hook crash with module-not-found.
    - The registration entry in `hooks.json` is itself the on/off toggle for the gate; there is no flag for it in `settings.json`.
- Discipline opt-in **OFF** → delete the whole "Test design discipline" block from the instantiated file (heading, body and the template's HTML comment), per that comment, leaving no empty heading and no unfilled `{{...}}`, and generate none of the hook files.

---

## Branch A — EMPTY project

### A1. Interview (grill-me)
Invoke the `grill-me` skill via the Skill tool, passing `init` as the argument. It walks the project decision tree **one question at a time** (exploring the repo and git history to self-answer first, and recommending an answer for each) and returns the collected decisions.

Synthesize the result into a **decisions summary** and present it for the user to confirm.

### A2. Best-practice grounding
Consult the docs for every chosen design pattern, DB design and framework before you write the spec, so the spec cites a source instead of your memory. Delegate to `ccf-best-practice-researcher` via Task **with `run_in_background: false`** (since Claude Code v2.1.198 a Task spawn omitting that flag defaults to background, which would let A3 start writing the spec before the researcher's report exists), or call Context7 (`resolve-library-id` → `query-docs`) and the Microsoft Learn docs tool yourself. Cite what you learned in the spec.

### A3. Generate spec files
Read the templates in `${CLAUDE_PLUGIN_ROOT}/templates/root/`, instantiate them, and write the root `CLAUDE.md` plus `.claude/rules/*` into the root folder. If the project is **fullstack**, also write a nested `CLAUDE.md` plus `.claude/rules/*` inside `be/` (from `templates/backend/`) and `fe/` (from `templates/frontend/`).
- Keep every `CLAUDE.md` under 200 lines and push the detail into `.claude/rules/*` via `@import` (max depth 5), because the whole imported set is loaded on every session.
- Write specific, verifiable rules and omit anything Claude can infer.
- Path-scoped rules carry `paths:` frontmatter, a list of globs (e.g. `["be/**"]`, `["fe/**"]`, `["src/**/*.{ts,tsx}"]`), so the rule lazy-loads only when Claude touches a matching file. Leave cross-cutting rules without `paths:`, which loads them every session.
- **If the frontend is React with shadcn/ui** (the recommended default): fill `{{STYLING_APPROACH}}` with "Tailwind CSS + shadcn/ui", `{{COMPONENT_LIBRARY}}` with "shadcn/ui (Radix primitives + Tailwind)", and `{{DESIGN_SOURCE}}` with the Claude Design handoff URL when the user gave one, otherwise the "no design handoff yet…" line. Then **add the shadcn MCP to the project's own `.mcp.json`** (create the file, or merge into the existing one): `mcpServers.shadcn = { "command": "npx", "args": ["shadcn@latest", "mcp"] }`. Leave the CCF plugin's own `.mcp.json` alone, since this server is project-scoped and would then run in every project.
- **Generate `.claude/settings.json`** from `templates/root/.claude/settings.json.tmpl` (its companion `settings.json.tmpl.md` holds the fill rules). This is harness-level config that ENFORCES commit attribution deterministically and supersedes any prose rule. An EMPTY project has no commit history to infer from, so **ask the user** whether commits and PRs should carry a Claude attribution trailer: yes → fill `{{ATTRIBUTION_COMMIT}}` / `{{ATTRIBUTION_PR}}` with the trailer text; no → fill `""` to suppress it. The file must instantiate to valid JSON with no comments, and every value must come from an answer rather than from invention.
- Fold the testing answers in per the **Reference** section above.

### A4. Generate the initial plan
Generate one large plan in `.claude/plan/` from the templates (a `PLAN.md` index plus `task-NNN-*.md` files), structured as a **sequential waterfall of VERTICAL SLICES**: each task is a thin tracer-bullet crossing the layers it touches (DB, service, UI), ordered thinnest to richest, each running spec → failing test → implement. **Right-size each slice** to a cohesive PR-sized increment, folding its doc and spec-sync in by default, and split it smaller only on a real driver (a data dependency, a need for an independent green gate, risk isolation, or a slice that will not fit one context). A swarm of micro-tasks costs a review cycle each and buys nothing. Give each task exactly one predecessor and name the test gate that must be green before the next slice starts.
- **Model line:** write `Model: <alias>` (e.g. `Model: sonnet`) as its own line in EVERY generated task file, an ALIAS only, never a dated model ID and never any parenthetical or translated text on that line, because `/ccf:cook` parses this exact line to pick the spawn model. When no explicit choice was made for this project, still write the plain `Model: sonnet` line (the `ccf-implementer` frontmatter default) and tell the user in prose, separately, that the default was applied.

**STOP.** Do not proceed to A5 until a fresh-context `ccf-spec-checker` subagent has critiqued the plan you just generated. Delegate it via Task in plan-review mode, read-only, **with `run_in_background: false`**: a Task spawn omitting that flag defaults to background since Claude Code v2.1.198, which would let A5 close the command before the review exists. `/ccf:init` does not run in plan mode, so there is no `ExitPlanMode` call for the `plan-review-gate` hook to deny, and this paragraph is the ONLY layer enforcing the gate here. Have the reviewer check that slices are truly vertical, that gates are real and verifiable, that each task has exactly one predecessor, that no task hides multiple concerns, and that nothing drifts from the spec, PLUS its **premortem / prospective-failure lens** (the top 2 to 4 failure modes, each with a preventing change; a brand-new project has no past failures to anchor to, so it reports `anchor: none`). **Loop**: while the review returns anything under `### Violations` or `### Should-reconsider`, fix the plan and re-review, until both sections are empty or the user knowingly accepts a finding. **Resolve every H-likelihood premortem finding** by fixing the plan or by having the user knowingly accept it, and record each H-finding's **disposition** (`fixed-by …` / `accepted-because …`) in the plan so an accepted high risk stays auditable.

### A5. Closing
Run no git command here; leave that to the user. Tell them to start a fresh session and run `/ccf:plan` (in plan mode) when they are ready to detail the first feature, and remind them that a Context7 rate limit is fixed by setting a free `CONTEXT7_API_KEY` env var and restarting Claude Code.
- **If shadcn was wired in:** tell the user to run `shadcn init` (which creates `components.json`), restart Claude Code, then run `/mcp` to confirm the shadcn server shows `Connected`. When a Claude Design handoff was provided, point them at it for planning the UI slices.

---

## Branch B — EXISTING project

### B1. Analyze with 5 parallel agents
**Model — ask with `AskUserQuestion`, once, before spawning.** **Recommend `haiku`** and label it as the recommendation: it is the agent's frontmatter default paired with `effort: low`, and these slices gather bounded evidence. Offer `sonnet` as the step-up for a large or complex codebase, and `opus` only if the user asks. Accept a model ALIAS only, never a dated model ID.
- Do not spawn the session's own model just because it is what you are running as. The analyzer's `model` frontmatter is a DEFAULT, and a call site overriding it without asking is the behavior this bullet exists to stop.
- If `AskUserQuestion` is genuinely blocked (a non-interactive session), fall back to `haiku` and state explicitly that the default was used because asking was blocked. Never proceed as if the user had answered.

Launch **5 `ccf-codebase-analyzer` subagents in parallel** via Task with the chosen model override. This is read-only research, one of the two places CCF allows parallelism; the other is `/ccf:plan` step 1b, which fans the same agent out on its **set B** planning slices. Writing work is never parallel. Parallel does not mean fire-and-forget: pass `run_in_background: false` on all 5 spawns and wait for every one to finish before B2 synthesizes, since an omitted flag defaults to background from Claude Code v2.1.198 and would let B2 summarize reports that do not exist yet.

Assign the agent's **set A (onboarding) slices**, which map the WHOLE project, unlike `/ccf:plan`'s set B scoped to one requested change. One slice each:
1. Architecture & module boundaries
2. Data layer & DB
3. API surface
4. Frontend & state
5. Build/test/CI + conventions & logging

Each returns a structured report and writes no files (their `disallowedTools` enforces that).

### B2. Synthesize + validate
Synthesize the 5 reports, then validate the observed patterns against best practices via Context7 and Microsoft Learn, or delegate to `ccf-best-practice-researcher` via Task **with `run_in_background: false`** (an omitted flag defaults to background since Claude Code v2.1.198, which would let B3 write the spec before the researcher's report exists). Flag every drift you find.

### B3. Generate spec reflecting the ACTUAL codebase
Generate `CLAUDE.md` plus `.claude/` describing the existing codebase rather than an idealized one, using the same templates and the same under-200-line and `@import` rules. For a monorepo with several sub-packages, generate a nested `CLAUDE.md` per package.
- **Git conventions come from history, not from invention:** fill `git-workflow.md`'s `{{COMMIT_CONVENTION}}` / `{{BRANCH_NAMING}}` / `{{PR_RULES}}` from the **git patterns slice 5 inferred from `git log` and `git branch`**, matching the repo's real commit subject style, body and trailer usage, and branch naming. When history is thin (2 commits or fewer) or inconsistent, state the patterns you observed, propose a standard convention, and have the user confirm it before you write it into the spec.
- **Generate `.claude/settings.json`** from `templates/root/.claude/settings.json.tmpl` (fill rules in its companion `settings.json.tmpl.md`), the harness-level config that ENFORCES commit attribution and supersedes the prose rule. Fill `{{ATTRIBUTION_COMMIT}}` / `{{ATTRIBUTION_PR}}` from that **same slice-5 git history**: when commits or PRs already carry a Co-Authored-By or Generated-with trailer, keep that text; when they do not, use `""` to suppress it. Thin or inconsistent history → state what you observed and confirm with the user instead of inventing a value. The file must instantiate to valid JSON with no comments.
- **If React is present but shadcn/ui is not:** you may suggest adopting shadcn/ui plus the project-scoped shadcn MCP for a more polished UI. Suggest it and let the user decide, rather than imposing a UI library on a codebase that already works.
- Fold the testing answers in per the **Reference** section above.

### B4. Closing
Recommend `/ccf:plan` for new work. Leave committing to the user.

---

## Guardrails (both branches)
- One task at a time, and no **writing** agents in parallel. Only read-only research fans out, per `architecture.md`.
- Every rule you write must be verifiable, so that a later `/ccf:check` can actually test it.
- Run a git command only when the user asks for one.
