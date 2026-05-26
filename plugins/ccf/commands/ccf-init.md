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
Invoke the `grill-me` skill to interview the user **one question at a time**. Before each question, if it can be answered by exploring the codebase, explore first; only ask what code cannot tell you. Walk this decision tree (give your recommendation with each question):
- (a) What system + the core problem?
- (b) Acceptable budget/cost?
- (c) App type: REST API / frontend / backend / fullstack?
- (d) Expected user scale? → **based on scale, propose hosting** (e.g. Supabase or Railway) and tell the user to install the corresponding MCP (`/plugin install ...`).
- (e) Design patterns for FE & BE?
- (f) AI-traceable logging system (structured logs, correlation ID, consistent prefixes)?
- (g) Database?
- (h) Coding conventions?
- (i) Testing strategy?
- (j) **Tech stack — must be the most stable, best-supported, least-buggy** (mainstream); for each library pick the most popular/well-maintained option.
- (k) **Monorepo rule:** work in the root folder; if fullstack create `be/` + `fe/`; **git init at the root, NOT in sub-folders**; the root holds CLAUDE.md, `.claude/`, docker, CI/CD.
- (l) **Git conventions:** first check whether the repo already has commits (read-only `git log`/`git branch -a`) — an "empty" project may still carry a few commits. If a pattern exists, infer the commit/branch convention from it (don't invent). If history is empty/too thin, ask the user (or default to conventional commits: `feat:`/`fix:`/`refactor:`…). This fills `git-workflow.md`'s `{{COMMIT_CONVENTION}}` / `{{BRANCH_NAMING}}` / `{{PR_RULES}}`.

Synthesize into a **"decisions summary"** and present it for the user to confirm.

### A2. Best-practice grounding
For each chosen design pattern / DB design / framework, **consult the docs before writing the spec**. Delegate to `ccf-best-practice-researcher` (via Task) — or directly call Context7 (`resolve-library-id` → `query-docs`) and the Microsoft Learn docs tool. Cite what you learned in the spec.

### A3. Generate spec files
Read the templates in `${CLAUDE_PLUGIN_ROOT}/templates/root/`, instantiate them, write the root `CLAUDE.md` + `.claude/rules/*` into the root folder. If **fullstack**: also write nested `CLAUDE.md` + `.claude/rules/*` inside `be/` (template `templates/backend/`) and `fe/` (template `templates/frontend/`).
- Every `CLAUDE.md` < 200 lines; push detail into `.claude/rules/*` via `@import` (max depth 5).
- Specific & verifiable rules. Omit anything Claude can infer.
- Path-scoped rules use `paths:` frontmatter (e.g. `be/**`, `fe/**`).

### A4. Generate the initial plan
Generate one large plan in `.claude/plan/` using the templates (`PLAN.md` index + `task-NNN-*.md` files), structured as a **sequential waterfall** (smallest → largest, spec → test → implement). Each task has exactly one predecessor.

### A5. Closing
Do NOT run git. Tell the user to start a fresh session and run `/ccf:ccf-plan` (in plan mode) when ready to detail the first feature. Remind them: if Context7 hits a rate limit, set a free `CONTEXT7_API_KEY` env var and restart Claude Code.

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

### B4. Closing
Recommend `/ccf:ccf-plan` for new work. Do NOT commit.

---

## Guardrails (both branches)
- One task at a time; do NOT spawn **writing** agents in parallel (only read-only research may run in parallel).
- Specs must be verifiable.
- Do NOT run git unless the user asks.
