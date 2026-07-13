---
description: Conventions for writing CCF plugin commands, agents, and templates (markdown artifacts).
---

# Components (command / agent / skill / template)

## Command (`commands/*.md`)
- Valid frontmatter: `description` (action-oriented, short), `argument-hint` (e.g. `"[bug description]"`), `allowed-tools` (whitelist; do NOT let a command inherit all tools), `model` (`opus`/`sonnet`/`haiku`).
- `allowed-tools` must be the minimum sufficient set. A plugin's own MCP tools follow the namespace `mcp__plugin_<pluginName>_<serverName>__<toolName>` — for CCF's bundled servers that is `mcp__plugin_ccf_context7__query-docs`, `mcp__plugin_ccf_microsoft-learn__*` (omitting the `plugin_ccf_` segment — i.e. a bare `context7`/`microsoft-learn` prefix — is NOT recognized; an allowlist mismatch silently drops the tool, forcing a WebFetch fallback). A separately-installed plugin keeps its own prefix, e.g. Supabase = `mcp__plugin_supabase_supabase__*`.
- The body is a second-person prompt ("You are running CCF `/ccf-...`"). Structured with clear numbered step headings.
- `${CLAUDE_PLUGIN_ROOT}` CANNOT be used in a command's frontmatter/body — only in hook commands and mcpServers.

## Agent (`agents/*.md`)
- Frontmatter: `name` (kebab-case, matches the filename), `description`, `model`, `effort` (optional — reasoning depth, see below). Tool policy is **inheritance, NOT a `tools` allowlist** (grounded, `code.claude.com/docs/en/sub-agents` + `/en/tools-reference`):
  - The **writer** (`ccf-implementer`) declares `disallowedTools: Agent, Task` (nothing else) → inherit-all-minus-spawn: it gets every tool the main loop has, including ALL project MCP servers (Supabase, Oracle, chrome-devtools, …) and the Skill tool, so it can use whatever the host project provides — it just cannot spawn a nested agent.
  - The **5 read-only agents** declare `disallowedTools: Write, Edit, NotebookEdit, Agent, Task` → inherit-all-minus-file-writes-minus-spawn: they keep the full project MCP/Skill set but cannot write files nor spawn a nested agent (preserves their non-writing mandate + the analyzer 5-parallel safety).
  - A `tools` ALLOWLIST is WRONG for a CCF subagent: it BLOCKS every unlisted MCP tool AND the Skill tool, and a plugin subagent cannot list unknown-at-authoring-time project MCP — the `mcpServers`/`permissionMode`/`hooks` fields are "Ignored for plugin subagents", so inheritance is the only mechanism that reaches arbitrary project MCP. Keep COMMAND `allowed-tools` least-privilege — that is a different scope (the main loop), where the tool set IS known.
  - **Safety is not the allowlist**: it is the file-write denial (`disallowedTools`), the runtime permission prompts (each MCP call still prompts the user), and the **leaf-agent invariant enforced by `disallowedTools: Agent, Task`** — grounded (`code.claude.com/docs/en/sub-agents` + `/agent-sdk/subagents`), a subagent CAN spawn nested subagents by default (fixed depth limit of five levels; the `Agent`/`Task` tool is inherited like any other), so `disallowedTools` is what BLOCKS both the file-write tools AND the spawn tool — nested spawn is not blocked "for free". Each read-only agent ALSO states in its body that it is READ-ONLY (no file writes, SELECT/read-only on any external system) and a leaf (no spawning other agents).
  - **Inherited-baseline assumption**: a subagent only reliably has what the MAIN loop has. An inherited project MCP tool may be **lazily loaded** — load its schema with `ToolSearch` before calling, or a blind call fails with InputValidationError (022 dogfood finding).
- `description` is the field that DECIDES when Claude invokes the agent — it must state the trigger + scope + limits (e.g. "Read-only", "Does NOT fix code"). Avoid vague descriptions.
- Pick `model` by cost/difficulty (grounded, `code.claude.com/docs/en/costs` + `/agent-sdk/subagents`): `haiku` for cheap read-only scans (`ccf-codebase-analyzer`); `sonnet` for a well-scoped IMPLEMENT (`ccf-implementer`) — Anthropic: "Sonnet handles most coding tasks well and costs less than Opus", and a CCF task is an already-sliced, spec-clear unit, not a "large refactor / gnarly debugging" that would justify Opus; `opus` reserved for HIGH-STAKES reasoning — the plan/code REVIEW with its premortem failure-mode lens (`ccf-spec-checker`, matching the official "use a more capable model for high-stakes reviews" pattern) and gnarly debugging (`ccf-debugger`).
- Also pick `effort` by the SAME cost/difficulty axis (grounded, plugin agents support `effort` since Claude Code 2.1.78 — changelog; levels + fallback per `/en/model-config`). `effort` is ORTHOGONAL to `model`: it tunes reasoning DEPTH within the chosen model, it does NOT change the model. Levels `low | medium | high | xhigh | max`; omit → inherit the session effort; an unsupported level falls back to the highest supported ≤ it (e.g. `xhigh` on Sonnet 4.6 → `high`). CCF mapping: `low` for the cheap parallel scan (`ccf-codebase-analyzer`); `medium` for the well-scoped, spec-clear work (`ccf-implementer`, `ccf-best-practice-researcher`, `ccf-spec-writer`); `high` for the high-stakes opus agents (`ccf-spec-checker` review+premortem, `ccf-debugger`) — `high` is the Opus 4.8 default and balances intelligence vs token spend (`max` shows diminishing returns). Re-evaluate `effort` and `model` TOGETHER when either changes: the per-agent `effort` rationale (e.g. "`high` = the opus default") only holds while that agent keeps its paired `model`, so a model change must re-check the effort level (and vice-versa) to avoid split drift.

## Skill (`skills/<name>/SKILL.md`)
- A reusable prompt building-block — one folder per skill (`skills/<name>/SKILL.md` + optional supporting files), **auto-discovered**; do NOT declare it in `plugin.json`.
- Frontmatter: `name` (matches the folder), `description` (the trigger — keep it NARROW for an internal skill so Claude doesn't auto-invoke it out of context), `allowed-tools` (least-privilege), optional `user-invocable` / `disable-model-invocation`.
- **Invocation nuance (grounded, `code.claude.com/docs/en/skills`):** `disable-model-invocation: true` blocks BOTH auto-invocation AND programmatic Skill-tool calls. A skill that a command must invoke (e.g. `grill-me`) MUST keep model-invocation enabled; set `user-invocable: false` to hide it from the `/` menu while commands still call it via the Skill tool, and rely on a tight `description` to limit auto-trigger.
- Receives input via `$ARGUMENTS` (e.g. a mode the command passes). Body < 500 lines, imperative: the shared procedure + per-mode dispatch.
- Use a skill to hold a multi-step procedure reused across commands (single source of truth), not a one-off fact.

## Template (`templates/**/*.tmpl`)
- Placeholders are `{{UPPER_SNAKE}}` for `/ccf:init` to replace when instantiating into the target project.
- Usage hints use HTML comments `<!-- ... -->` so they don't leak into the final output.
- A `CLAUDE.md.tmpl` must itself obey the < 200-line + `@import` rule, since it is the mold for another project's spec.
- Three template branches: `root/` (always used), `backend/` + `frontend/` (only when the target project is fullstack).

## Path-scoped rules (`paths:` frontmatter)
A rule file WITHOUT `paths:` loads every session (unconditional); WITH `paths:` (a list of glob patterns) it lazy-loads only when Claude touches a matching file. Scope rules that are TRULY local (e.g. backend-only); leave cross-cutting rules global. Glob reference (grounded, `code.claude.com/docs/en/memory`):

| Pattern | Matches |
| --- | --- |
| `**/*.ts` | all `.ts` files anywhere |
| `src/**/*` | everything under `src/` |
| `*.md` | `.md` files in the project root only |
| `src/**/*.{ts,tsx}` | brace expansion — `.ts` + `.tsx` under `src/` |

## Common conventions
- Content language: **English** (matching the whole current codebase), keep technical identifiers in their original form.
- When adding/changing/removing a command, agent or skill: update the README command/agent/skill tables and counts, every cross-reference in other prompts, and (if relevant) `plugin.json`.
- Each artifact has one responsibility (SRP): a command orchestrates a flow, an agent does one kind of work, a template describes one kind of file.
