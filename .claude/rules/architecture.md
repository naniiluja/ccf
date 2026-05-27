---
description: CCF plugin architecture — artifact types, boundaries, distribution flow.
---

# Architecture

## Three artifact types (don't confuse their roles)
1. **Command** (`plugins/ccf/commands/*.md`) — a prompt that drives Claude in the **main conversation** when the user types `/ccf:<name>`. NOT a script. Has frontmatter (`description`, `argument-hint`, `allowed-tools`, `model`).
2. **Agent / subagent** (`plugins/ccf/agents/*.md`) — a prompt that runs in a **separate** context when delegated via Task. Has frontmatter (`name`, `description`, `model`, `tools`). Use when you need to isolate context or fan out read-only research.
3. **Hook** (`plugins/ccf/hooks/*.mjs`) — executable Node code run out-of-process, called by Claude Code at lifecycle events. This is the ONLY deterministic part; everything else is a prompt.

## Command ↔ agent boundary (CCF law)
- **Shared-context** work (plan → implement → test) stays in the main conversation (command), NOT split into an agent.
- Only split into an agent when: (a) read-only research can fan out in parallel (e.g. 5 `ccf-codebase-analyzer` in `/ccf-init`), or (b) you need one isolated work unit (1 `ccf-implementer` for exactly 1 task).
- **Do NOT spawn multiple file-WRITING agents in parallel** on the same feature. Parallelism is for read-only research only.

## Deterministic part vs prompt part
- Logic that must be certain (e.g. "block `/ccf-plan` if not in plan mode") → goes in a **hook** (`plan-mode-guard.mjs`), because a prompt can be ignored by the model. The command still keeps a verbal backup layer (see `ccf-plan.md` section 0) — this is deliberate defense-in-depth, not redundant duplication.
- Judgment/interpretation logic → goes in the **command/agent prompt**.

## Distribution flow
`bin/ccf-bootstrap.mjs` (npx) → `claude plugin marketplace add` + `install` → Claude Code reads `.claude-plugin/marketplace.json` → points to `plugins/ccf` → reads `.claude-plugin/plugin.json` → loads commands/agents/.mcp.json **and** `hooks/hooks.json`, all auto-discovered by their standard location. Do NOT add a `"hooks"` field pointing at `hooks/hooks.json` in `plugin.json` — that re-loads the already-auto-loaded file and fails with `Duplicate hooks file detected`. The `manifest.hooks` field is only for *additional* hook files at a non-standard path. See `@.claude/rules/hooks.md`.

## Invariants
- Every command name in docs/prompts must match a real file in `commands/`. There are currently **5** commands and **6** agents — keep README/MEMORY in sync; the real files in `commands/`+`agents/` are the source of truth.
- Components reference each other by name (e.g. a command calls the `ccf-implementer` agent); renaming a file ⇒ update every reference.
