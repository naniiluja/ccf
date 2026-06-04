---
description: CCF plugin architecture — artifact types, boundaries, distribution flow.
---

# Architecture

## Artifact types (don't confuse their roles)
1. **Command** (`plugins/ccf/commands/*.md`) — a prompt that drives Claude in the **main conversation** when the user types `/ccf:<name>`. NOT a script. Has frontmatter (`description`, `argument-hint`, `allowed-tools`, `model`).
2. **Agent / subagent** (`plugins/ccf/agents/*.md`) — a prompt that runs in a **separate** context when delegated via Task. Has frontmatter (`name`, `description`, `model`; tool access is by INHERITANCE, not a `tools` allowlist — see "Agent context & rule propagation"). Use when you need to isolate context or fan out read-only research.
3. **Hook** (`plugins/ccf/hooks/*.mjs`) — executable Node code run out-of-process, called by Claude Code at lifecycle events. This is the ONLY deterministic part; everything else is a prompt.
4. **Skill** (`plugins/ccf/skills/<name>/SKILL.md`) — a reusable prompt building-block invoked BY a command via the Skill tool. Internal (`user-invocable: false`); holds a shared procedure (e.g. the `grill-me` interview discipline) so it isn't duplicated across commands. See `@.claude/rules/components.md`.

## Command ↔ agent boundary (CCF law)
- **Shared-context** work (plan → implement → test) stays in the main conversation (command), NOT split into an agent.
- Only split into an agent when: (a) read-only research can fan out in parallel (e.g. 5 `ccf-codebase-analyzer` in `/ccf-init`), or (b) you need one isolated work unit (1 `ccf-implementer` for exactly 1 task).
- **Do NOT spawn multiple file-WRITING agents in parallel** on the same feature. Parallelism is for read-only research only — the read-only agents' `disallowedTools: Write, Edit, NotebookEdit` keeps their files safe even fanned out 5-wide. NOTE: since subagents now inherit the project's MCP, a read-only agent CAN reach a project DB MCP and (rarely) issue a write through it — that is permission-gated (each MCP call prompts) and the body mandates SELECT/read-only, so parallel read-only research stays safe; treat a parallel DB-write via project MCP as the rare, prompt-gated exception, not the norm.

## Deterministic part vs prompt part
- Logic that must be certain (e.g. "block `/ccf-plan` if not in plan mode") → goes in a **hook** (`plan-mode-guard.mjs`), because a prompt can be ignored by the model. The command still keeps a verbal backup layer (see `ccf-plan.md` section 0) — this is deliberate defense-in-depth, not redundant duplication.
- Judgment/interpretation logic → goes in the **command/agent prompt**.
- The `ccf-spec-checker` plan-review is such judgment work: beyond the structural critique it runs a **premortem** (prospective-hindsight failure modes anchored to `PLAN.md` history + project memory) backed by criteria-decomposition and grounded self-critique — review depth lives in the agent prompt, not in any hook.

## Agent context & rule propagation
- An **output style** modifies the MAIN loop's system prompt and is NOT inherited by spawned subagents — there is no built-in style→subagent propagation ([#8395](https://github.com/anthropics/claude-code/issues/8395)). A subagent gets its OWN system prompt.
- A subagent DOES auto-load the **memory hierarchy** (`.claude/rules/*` + CLAUDE.md, via `@import`). So **enforceable coding rules belong in `.claude/rules`**, never in an output style alone — only `.claude/rules` reaches the subagent.
- CCF then restates those rules **deterministically at spawn**: the `SubagentStart` hook `agent-rules-inject` injects (into the file-writing `ccf-implementer`) a directive pointing at `.claude/rules` + the active style's CODING rules only (persona excluded). Same defense-in-depth as `plan-mode-guard` — `ccf-implementer.md`'s body is the prompt backup. See `@.claude/rules/hooks.md`.
- A SECOND `SubagentStart` hook, `explore-guide-inject` (matcher `"Explore"`), uses the same spawn-time `additionalContext` lever for a DIFFERENT target: CCF does not own the built-in `Explore` subagent's prompt (a harness artifact), so this hook injects a language-agnostic, LSP-conditional directive (prefer the `LSP` tool's semantic navigation + ripgrep `Grep` + `Glob` over reading whole files). So the `SubagentStart` array now carries two hooks — `agent-rules-inject` (rules, gated by an internal `WRITER_AGENTS` allowlist) and `explore-guide-inject` (exploration guidance, gated by the hooks.json `"Explore"` matcher). Both are best-effort and never block a spawn. See `@.claude/rules/hooks.md`.
- **Tool / MCP / skill inheritance** (grounded `code.claude.com/docs/en/sub-agents` + `/en/tools-reference`): a subagent that OMITS `tools` inherits ALL the main loop's tools — every project MCP server + the Skill tool; one with `disallowedTools` inherits-all-MINUS the listed file-write tools. A `tools` allowlist instead BLOCKS unlisted MCP + Skill, and a plugin subagent's `mcpServers`/`permissionMode`/`hooks` are "Ignored for plugin subagents" — so inheritance (omit / `disallowedTools`) is the ONLY way a subagent reaches arbitrary project MCP. This is orthogonal to `agent-rules-inject` (which carries RULES via `additionalContext`, not `tools`). Session-state/spawn tools never reach a subagent → no nested spawn; an inherited MCP tool may be lazily loaded → use `ToolSearch` before calling. CCF uses this uniformly: writer inherit-all, the 5 read-only agents inherit-all-minus-file-writes.

## Distribution flow
`bin/ccf-bootstrap.mjs` (npx) → `claude plugin marketplace add` + `install` → Claude Code reads `.claude-plugin/marketplace.json` → points to `plugins/ccf` → reads `.claude-plugin/plugin.json` → loads commands/agents/skills/.mcp.json **and** `hooks/hooks.json`, all auto-discovered by their standard location. Do NOT add a `"hooks"` field pointing at `hooks/hooks.json` in `plugin.json` — that re-loads the already-auto-loaded file and fails with `Duplicate hooks file detected`. The `manifest.hooks` field is only for *additional* hook files at a non-standard path. See `@.claude/rules/hooks.md`.

## Invariants
- Every command name in docs/prompts must match a real file in `commands/`. There are currently **6** commands, **6** agents and **1** skill (`grill-me`) — keep README/MEMORY in sync; the real files in `commands/`+`agents/`+`skills/` are the source of truth.
- Components reference each other by name (e.g. a command calls the `ccf-implementer` agent); renaming a file ⇒ update every reference.
