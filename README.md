# CCF — Claude Context First

**English** · [Tiếng Việt](./README.vi.md) · [简体中文](./README.zh-CN.md)

A workflow plugin for [Claude Code](https://code.claude.com) that enforces a **context-first, spec-driven, strictly sequential** way of working. CCF turns the loose "vibe coding" loop into a disciplined pipeline where the spec is always fresh, every decision is grounded in real docs, and work happens one verifiable slice at a time.

- **Context-first** — the spec lives in `CLAUDE.md` + `.claude/`, kept continuously fresh so every session starts already knowing the project.
- **Grounding** — every design decision references best practices from **Context7** and **Microsoft Learn** (two MCP servers bundled with the plugin), not from memory.
- **Strictly sequential** — one task at a time (waterfall of vertical slices), no parallel feature development, to maximize quality.
- **Adapts to your codebase** — bootstrap a fresh project as a monorepo (git init at the root; fullstack splits into `be/` + `fe/` with nested specs) *or* onboard an existing one, where `/ccf:ccf-init` analyzes the real structure (5 read-only agents) and writes a spec that mirrors it — no layout forced on you.

## Why CCF — the problems it solves

| Pain in plain Claude Code | What CCF does about it |
|---|---|
| Context "rots" over a long session; the model drifts from the rules | A **`SessionStart` hook** re-injects the context-first reminder every start/clear/compact, and re-loads your in-progress task after a compact. |
| The spec silently falls behind the code | Two **freshness hooks** compare the spec's vs the code's last **git commit time** and *nudge* `/ccf:ccf-updatespec` — at session start and when you stop. |
| Planning slips straight into editing files | A **`UserPromptSubmit` hook** hard-blocks `/ccf:ccf-plan` unless you're in plan mode — planning stays read-only and reviewable. |
| Design decisions made from stale memory | Bundled **Context7 + Microsoft Learn** MCP servers; CCF prompts cite official docs before writing. |
| Mistakes repeat across sessions | `/ccf:ccf-updatespec` writes **two tiers** — project rules to the spec, anti-mistake feedback to system **memory** (loaded at higher weight). |
| Big-bang features that are hard to review | Plans are a **sequential waterfall of vertical slices**, each a thin tracer-bullet (DB→service→UI) with its own test gate. |
| Tests written loosely (or skipped) under time pressure | An **opt-in test discipline** — `/ccf:ccf-test` designs a contract-level matrix (Equivalence Partitioning + Boundary Value Analysis + decision table), and once you opt in, a generated **Stop-hook gate blocks stopping** until the tests actually pass. Ship-fast flows simply don't opt in. |

## Install

### Via marketplace (recommended)
```
/plugin marketplace add naniiluja/ccf
/plugin install ccf@ccf
```

### Via npx
```
npx @naniiluja/ccf
```
(runs `claude plugin marketplace add` + `install` for you)

### Local (for development)
```
claude plugin marketplace add D:/projects/ccf
claude plugin install ccf@ccf
```

After installing, open Claude Code in your project folder and run `/ccf:ccf-init`.

## The 6 commands

| Command | What it does |
|---------|--------------|
| `/ccf:ccf-init` | Bootstrap a new project (interview → generate CLAUDE.md + .claude + plan) or onboard an existing one (5 read-only analyzer agents map the real structure). |
| `/ccf:ccf-plan` | Create a sequential plan for one feature, grounded in best practices. **Requires plan mode** (Shift+Tab) — enforced by a hook. After planning, execute each task with an agent. |
| `/ccf:ccf-check` | Verify the implementation against the spec (conformance, conventions, SOLID/OOP, BE↔FE cross-check). Read-only. |
| `/ccf:ccf-test` | Design a contract-level test matrix (EP + BVA + decision table) for a function/slice, write the tests failing-first, run them, and report actual results vs the coverage gate. Only under a project that opted into the test discipline. |
| `/ccf:ccf-fix` | Disciplined debugging: reproduce → trace logs/DB step by step → root cause → failing test → minimal fix. No guessing. |
| `/ccf:ccf-updatespec` | Update the spec **and system memory** with this session's lessons (incl. new tools with "when to use"). |

Typical flow: `ccf-init` → (plan mode) `ccf-plan` → implement → `ccf-check` → (`ccf-test` when the test discipline is ON) → `/code-review` → `ccf-updatespec`.

## The 6 agents

Specialized subagents that **inherit the host project's tools, MCP servers and skills** — so they can use whatever MCP your project provides (Supabase, Oracle, chrome-devtools, …) and call its skills, with no per-agent allowlist to maintain. The read-only agents (everyone except `ccf-implementer`) carry `disallowedTools: Write, Edit, NotebookEdit`, so they get the same MCP/skill reach but **cannot write files**. Parallelism is **read-only research only** — file-writing agents never run in parallel on the same feature.

| Agent | Role | Mode |
|---|---|---|
| `ccf-codebase-analyzer` | Analyzes one slice of an existing codebase; `/ccf-init` fans out 5 in parallel. | read-only |
| `ccf-best-practice-researcher` | Fetches cited best practices from Context7 / MS Learn in an isolated context. | read-only |
| `ccf-implementer` | Implements **exactly one** plan task: failing test first, then code to meet acceptance criteria. | writes |
| `ccf-spec-writer` | Drafts CLAUDE.md / rules content from a decisions summary. | drafts |
| `ccf-spec-checker` | Fresh-context reviewer — checks an implementation or critiques a plan, including a premortem / prospective-failure lens. | read-only |
| `ccf-debugger` | Investigates one root-cause hypothesis, follows the correlation ID, verifies against the DB. | read-only |

## Hooks — the deterministic layer

Commands and agents are *prompts* (a model can choose to ignore a prompt). **Hooks are the only deterministic part of CCF** — `.mjs` scripts run by `node` at lifecycle events, so they fire every time regardless of what the model decides. They are **no-build, no-dependency, Windows-clean** (Node ≥ 18, built-ins only).

| Hook | Event | What it guarantees |
|---|---|---|
| **plan-mode-guard** | `UserPromptSubmit` | If a prompt contains `/ccf:ccf-plan` but the session is **not in plan mode**, it **blocks** (exit 2) and tells you to enter plan mode. Every other prompt passes through untouched. This is the *enforced* half of "planning is read-only and reviewed before execution". |
| **plan-review-gate** | `PreToolUse` (`ExitPlanMode`) | In a `/ccf-plan` session, **denies** `ExitPlanMode` (so the plan can't be presented for approval) until the transcript shows a `ccf-spec-checker` plan review ran. Best-effort on the undocumented transcript shape: any read failure or a non-CCF session passes through, so it never blocks wrongly — strong enforcement backed by `ccf-plan`'s step-6 prompt. (The review now includes a premortem lens; the gate mechanism is unchanged.) |
| **session-start** | `SessionStart` (`startup\|clear\|compact`) | Injects the context-first reminder so the model wakes up already in CCF mode. If **CCF-managed**, it adds a *freshness signal* when the code looks newer than the spec, and after a `compact`/`clear` it **re-loads the in-progress task** from `.claude/plan/PLAN.md` so you resume exactly where you left off. |
| **updatespec-nudge** | `Stop` | Purely **advisory**, never blocks. Three independent nudges: **(A)** if you edited code this session but ran no tests, it reminds you to *verify your work* (run the tests / type-check); **(B)** if the code changed but the spec didn't, it nudges `/ccf:ccf-check` then `/ccf:ccf-updatespec`; **(C)** if you ran `git commit` this session but `PLAN.md` still has tasks not `done`, it nudges you to mark each `done` (only after its `/ccf-check` + `/code-review`) or fix its status. Guards against re-trigger loops via `stop_hook_active`. |
| **context-guard** | `UserPromptSubmit` | When the session transcript shows context has crossed ~40% of the model window — capped at an absolute ~300k tokens, since 40% of a 1M-native window (Opus/Sonnet 4.x) would be unreachable before auto-compact — i.e. the "dumb zone", it surfaces a **proactive `/compact`** warning (with a ready-made hint pre-filled from your active task). **Default = warn**, non-blocking: the advice reaches both you (`systemMessage`) and the model (`additionalContext`) every turn. **Opt into hard-block** by adding `--hard-block` to the `context-guard.mjs` command in `hooks.json` — it then **blocks** (exit 2) any over-threshold prompt until you compact, with an escape hatch (prefix the prompt with `/compact`, or include `ccf:override`). Best-effort: if it can't read the transcript it stays silent. |
| **agent-rules-inject** | `SubagentStart` | Output styles modify only the **main** loop and aren't inherited by subagents, so a spawned file-writing `ccf-implementer` could violate the coding rules. At spawn this hook **injects** (via `additionalContext`) a directive to read & obey the project rules (`.claude/rules/*` + CLAUDE.md) plus the active output style's **coding** rules (persona/tone/emoji excluded), then self-check. Only the writer agent gets it (read-only agents are a no-op); best-effort, never blocks the spawn. |

**Freshness heuristic (shared, single source of truth in `hooks/lib/freshness.mjs`):** both freshness-aware hooks compare the last **git commit time** (`git log -1 --format=%ct`) of *code* files against that of *spec* files (`.md` under `.claude/rules` + `CLAUDE.md`) — committer time, so it reflects real content change and is **immune to `mtime` churn** from `checkout`/`pull`/`clone`. When git can't answer (not a git repo, or a path with no commits yet — e.g. a freshly `/ccf-init`-ed project) it **falls back to a depth-limited `mtime` walk** that works for *any* layout (`src/`, `server/`, `packages/x/src`, plugin-style `plugins/x/hooks`, or code at the root). It is a lightweight nudge, never a hard conclusion — a content-level "is the spec still accurate?" judgment is left to `/ccf:ccf-updatespec`.

**Why hooks are auto-loaded, not declared:** like commands/agents/MCP, hooks load automatically from the standard `hooks/hooks.json` location — current Claude Code (v2.1.x) auto-discovers it. Do **not** add a `"hooks"` field to `plugin.json` pointing back at the standard path: that loads the file twice and fails with `Duplicate hooks file detected`. The `manifest.hooks` field is only for *additional* hook files at a non-standard path.

## Bundled MCP servers

The plugin bundles 2 MCP servers (plugin scope, auto started/stopped by Claude Code):

- **microsoft-learn** — `https://learn.microsoft.com/api/mcp` (remote HTTP, no auth required).
- **context7** — `https://mcp.context7.com/mcp` (remote HTTP, works out of the box without a key).

> **Context7 rate limit:** the plugin runs Context7 without an API key (free rate limit). If you hit a rate limit, get a free key at [context7.com/dashboard](https://context7.com/dashboard), set the `CONTEXT7_API_KEY` env var, and restart Claude Code.

## Spec vs Memory (two context tiers)

`/ccf:ccf-updatespec` records lessons in **two places** with different purposes:

- **Spec** (`CLAUDE.md` + `.claude/rules/`) — loaded as a *user message*, lower weight. Holds **project rules**: conventions, architecture, tech-stack, tooling.
- **Memory** (`~/.claude/projects/<path>/memory/`) — loaded into the *system prompt*, **not down-weighted**, so Claude follows it more strongly. Holds **anti-mistake feedback** + **user preferences** across sessions → helps Claude repeat fewer mistakes.
- **`MEMORY.md` is a pure index** — only its first **200 lines or 25KB** load each session, so keep it lean; the strongest tier is **`feedback`** (always with its `Why`).

Principle: **no duplication**. A rule in CLAUDE.md that keeps getting forgotten → write a `feedback` memory that *reinforces* it (with the "why"), rather than copying its content.

## Compact-aware mechanism

A proactive `/compact <hint>` beats letting auto-compact fire (when context has "rotted" the model is at its least sharp). After you compact, CCF's `session-start` hook (matcher `compact`) auto re-loads the in-progress task from `.claude/plan/PLAN.md`, restoring the right work context so you don't have to paste it back.

## Plan = sequential waterfall of vertical slices

`/ccf:ccf-init` and `/ccf:ccf-plan` produce one plan in `.claude/plan/` (a `PLAN.md` index + `task-NNN-*.md` files). Each task is a **thin vertical slice** — a tracer-bullet crossing the layers it touches (DB + service + UI), ordered thinnest → richest, each as *spec → failing test → implement*. Every task has exactly **one predecessor** and names the **test gate** that must be green before the next slice starts. This is what makes "strictly sequential" concrete and reviewable.

## Architecture

- **Commands** = markdown prompts that drive Claude in-session (not scripts).
- **Agents** = 6 specialized subagents (analyzer, researcher, implementer, spec-writer, spec-checker, debugger).
- **Skills** = 1 internal skill (`grill-me`) — the shared requirements-interview engine the commands invoke via the Skill tool; hidden from the `/` menu (`user-invocable: false`).
- **Hooks** = 6 `.mjs` run directly with `node` — no build step, no dependency, Windows-clean; shared helpers (freshness, plan parsing, context-usage, review-trace, git-trace, verify-trace, output-style) live in `hooks/lib/`.
- **Templates** = `{{...}}`-placeholder files (`root/` always, `backend/` + `frontend/` when fullstack) that `/ccf:ccf-init` instantiates.

See `plugins/ccf/` for details. Requires Node ≥ 18 for the hooks.

## License

MIT

## Acknowledgements

This project was first released in the [LINUX DO](https://linux.do/) community — thanks to the community members for their support and feedback.
