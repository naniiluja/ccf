---
description: Conventions for writing CCF plugin commands, agents, and templates (markdown artifacts).
---

# Components (command / agent / template)

## Command (`commands/*.md`)
- Valid frontmatter: `description` (action-oriented, short), `argument-hint` (e.g. `"[bug description]"`), `allowed-tools` (whitelist; do NOT let a command inherit all tools), `model` (`opus`/`sonnet`/`haiku`).
- `allowed-tools` must be the minimum sufficient set. MCP tools written with full namespace (e.g. `mcp__context7__query-docs`, `mcp__microsoft-learn__*`, `mcp__plugin_supabase_supabase__*`).
- The body is a second-person prompt ("You are running CCF `/ccf-...`"). Structured with clear numbered step headings.
- `${CLAUDE_PLUGIN_ROOT}` CANNOT be used in a command's frontmatter/body — only in hook commands and mcpServers.

## Agent (`agents/*.md`)
- Frontmatter: `name` (kebab-case, matches the filename), `description`, `model`, `tools` (comma-separated, least-privilege).
- `description` is the field that DECIDES when Claude invokes the agent — it must state the trigger + scope + limits (e.g. "Read-only", "Does NOT fix code"). Avoid vague descriptions.
- Pick `model` by cost/difficulty: `haiku` for cheap read-only scans (`ccf-codebase-analyzer`), `opus` for implement/review that needs reasoning.
- A read-only agent MUST declare only read-only tools (Read/Glob/Grep/read-style Bash) and state in the body that it does not write.

## Template (`templates/**/*.tmpl`)
- Placeholders are `{{UPPER_SNAKE}}` for `/ccf-init` to replace when instantiating into the target project.
- Usage hints use HTML comments `<!-- ... -->` so they don't leak into the final output.
- A `CLAUDE.md.tmpl` must itself obey the < 200-line + `@import` rule, since it is the mold for another project's spec.
- Three template branches: `root/` (always used), `backend/` + `frontend/` (only when the target project is fullstack).

## Common conventions
- Content language: **English** (matching the whole current codebase), keep technical identifiers in their original form.
- When adding/changing/removing a command or agent: update the README command table, every cross-reference in other prompts, and (if relevant) `plugin.json`.
- Each artifact has one responsibility (SRP): a command orchestrates a flow, an agent does one kind of work, a template describes one kind of file.
