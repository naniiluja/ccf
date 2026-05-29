---
description: Bootstrap a new project or onboard an existing one into the CCF workflow — generate CLAUDE.md + .claude specs + an initial sequential plan.
argument-hint: "[optional: short description of what you want to build]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, WebFetch, mcp__context7__resolve-library-id, mcp__context7__query-docs, mcp__microsoft-learn__*
model: opus
---

You are running CCF `/ccf-init`. Task: produce a fresh, best-practice-grounded context layer (CLAUDE.md + `.claude/`) and an initial sequential implementation plan. Follow Anthropic's Explore → Plan workflow. **Do NOT write application code in this command.**

Templates live in `${CLAUDE_PLUGIN_ROOT}/templates/`. Read and instantiate them (replacing `{{...}}` placeholders) when generating real files into the project.

## Step 0: Classify the project
Scan `cwd` read-only (Glob `**/*` excluding `node_modules`/`.git`; check for `package.json`, `src/`, an existing `CLAUDE.md`). Classify as **EMPTY** (nothing substantial yet) or **EXISTING** (has code).

---

## Branch A — EMPTY project

### A1. Interview (grill-me)
Invoke the `grill-me` skill via the Skill tool, passing `init` as the argument. It walks the project decision tree **one question at a time** (exploring the repo + git history to self-answer first, recommending an answer for each) and returns the collected decisions.

Synthesize the result into a **"decisions summary"** and present it for the user to confirm.

### A2. Best-practice grounding
For each chosen design pattern / DB design / framework, **consult the docs before writing the spec**. Delegate to `ccf-best-practice-researcher` (via Task) — or directly call Context7 (`resolve-library-id` → `query-docs`) and the Microsoft Learn docs tool. Cite what you learned in the spec.

### A3. Generate spec files
Read the templates in `${CLAUDE_PLUGIN_ROOT}/templates/root/`, instantiate them, write the root `CLAUDE.md` + `.claude/rules/*` into the root folder. If **fullstack**: also write nested `CLAUDE.md` + `.claude/rules/*` inside `be/` (template `templates/backend/`) and `fe/` (template `templates/frontend/`).
- Every `CLAUDE.md` < 200 lines; push detail into `.claude/rules/*` via `@import` (max depth 5).
- Specific & verifiable rules. Omit anything Claude can infer.
- Path-scoped rules use `paths:` frontmatter (e.g. `be/**`, `fe/**`).
- **If the frontend is React + shadcn/ui** (the recommended default): fill `{{STYLING_APPROACH}}` = "Tailwind CSS + shadcn/ui", `{{COMPONENT_LIBRARY}}` = "shadcn/ui (Radix primitives + Tailwind)", and `{{DESIGN_SOURCE}}` = the Claude Design handoff URL if the user gave one (else the "no design handoff yet…" line). Then **add the shadcn MCP to the project's own `.mcp.json`** (create it, or merge into an existing one): `mcpServers.shadcn = { "command": "npx", "args": ["shadcn@latest", "mcp"] }`. Do NOT touch the CCF plugin's `.mcp.json` — this server is project-scoped.

### A4. Generate the initial plan
Generate one large plan in `.claude/plan/` using the templates (`PLAN.md` index + `task-NNN-*.md` files), structured as a **sequential waterfall of VERTICAL SLICES** — each task a thin tracer-bullet crossing the layers it touches (DB + service + UI), ordered thinnest → richest, spec → failing test → implement. Each task has exactly one predecessor and names the test gate that must be green before the next slice.

**MANDATORY review gate:** after generating the plan, **STOP — do NOT proceed to A5 until** a fresh-context `ccf-spec-checker` subagent (plan-review mode, read-only, via Task) has critiqued it: vertical slicing, real/verifiable gates, exactly one predecessor per task, no task hiding multiple concerns, no drift from the spec. Fold the critique back in (loop until clean) before closing. (`ccf-init` does not run in plan mode, so there is no ExitPlanMode hook here — this prompt gate is the enforcement.)

### A5. Closing
Do NOT run git. Tell the user to start a fresh session and run `/ccf:ccf-plan` (in plan mode) when ready to detail the first feature. Remind them: if Context7 hits a rate limit, set a free `CONTEXT7_API_KEY` env var and restart Claude Code.
- **If shadcn was wired in:** tell the user to run `shadcn init` (creates `components.json`) and restart Claude Code, then `/mcp` to confirm the shadcn server shows `Connected`. If a Claude Design handoff was provided, point them to use it when planning the UI slices.

---

## Branch B — EXISTING project

### B1. Analyze with 5 parallel agents
Launch **5 `ccf-codebase-analyzer` subagents in parallel** (via Task — this is the ONLY place CCF allows parallelism, since it's read-only research). Assign each one slice:
1. Architecture & module boundaries
2. Data layer & DB
3. API surface
4. Frontend & state
5. Build/test/CI + conventions & logging

Each returns a structured report; they must NOT write files.

### B2. Synthesize + validate
Synthesize the 5 reports. Validate the observed patterns against best practices via Context7 + Microsoft Learn (or `ccf-best-practice-researcher`), flagging drift.

### B3. Generate spec reflecting the ACTUAL codebase
Generate `CLAUDE.md` + `.claude/` describing the existing codebase (not an idealized one), using the same templates + the same < 200-line / `@import` rules. For a monorepo with several sub-packages, generate nested CLAUDE.md per package.
- **Git conventions from history (do NOT invent):** fill `git-workflow.md`'s `{{COMMIT_CONVENTION}}` / `{{BRANCH_NAMING}}` / `{{PR_RULES}}` from the **git patterns slice-5 inferred from `git log`/`git branch`** — match the repo's real commit subject style, body/trailer usage, and branch naming. If history is thin (≤2 commits) or inconsistent, do NOT silently pick one: state the patterns you observed, propose a standard convention, and have the user confirm before writing it into the spec.
- **If React is present but shadcn/ui is not:** you MAY suggest adopting shadcn/ui (+ the project-scoped shadcn MCP) for a more polished UI — suggest only, do not impose it on an existing codebase.

### B4. Closing
Recommend `/ccf:ccf-plan` for new work. Do NOT commit.

---

## Guardrails (both branches)
- One task at a time; do NOT spawn **writing** agents in parallel (only read-only research may run in parallel).
- Specs must be verifiable.
- Do NOT run git unless the user asks.
