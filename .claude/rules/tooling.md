---
description: Tools and MCP used in / for developing the CCF plugin — with "when to use".
---

# Tooling

## Plugin-bundled MCP servers (`plugins/ccf/.mcp.json`)
Two remote HTTP servers, auto started/stopped by Claude Code at plugin scope:
- **context7** (`https://mcp.context7.com/mcp`) — **use when**: you need to look up the schema/contract/syntax of Claude Code, a library, framework, or CLI. Flow: `resolve-library-id` → `query-docs`. Runs without an API key (free rate limit); if rate-limited, set env `CONTEXT7_API_KEY` (free at context7.com/dashboard) and restart Claude Code.
- **microsoft-learn** (`https://learn.microsoft.com/api/mcp`) — **use when**: you need Microsoft/Azure/.NET platform guidance. No auth. Tools: `microsoft_docs_search` (breadth) → `microsoft_code_sample_search` (examples) → `microsoft_docs_fetch` (depth).

> Grounding is a CCF law: before writing a spec/decision about Claude Code's schema or a library, consult the official docs and CITE them, don't rely on memory.

## Grounding subagent
- `ccf-best-practice-researcher` — **use when**: you want to fan out best-practice lookups into a separate context so they don't flood the main conversation. It calls Context7/MS Learn and returns a cited recommendation.

## Internal skill
- `grill-me` (`plugins/ccf/skills/grill-me/SKILL.md`) — **use when**: a command (`ccf-plan`/`ccf-fix`/`ccf-init`) needs to interview the user before acting. **How to call**: invoke via the Skill tool, passing the mode (`plan`/`fix`/`init`) as the argument; it runs the one-question-at-a-time interview and returns a summary. Internal (`user-invocable: false`) — not for direct user invocation; model-invocation stays enabled so commands can call it.

## Plugin development tools
- **Node ≥ 18** — runs the hooks and `bin/ccf-bootstrap.mjs`.
- **`tsc`** — type-checks JS via `tsconfig.json`. **Use when**: you just edited any `.mjs`. Run `npm install` (once) then `npx tsc --noEmit`. Needs `@types/node` (already in `devDependencies`) because `tsconfig` sets `"types": ["node"]` — this is a type-check devDependency, not a runtime dep.
- **`claude plugin` CLI** — `marketplace add` / `install`. **Use when**: installing locally or in `bin/ccf-bootstrap.mjs`.

## CCF self-checks (internal commands)
- `/ccf:ccf-check` — verify the implementation against this spec (conformance, conventions, SOLID, cross-check).
- `/ccf:ccf-updatespec` — refresh the spec after a session; **also records new tools with "when to use"** into this very file.

## Convention for adding a new tool
When integrating a new tool/MCP, add an entry here in the format "**name** — when to use — how to call", and update the `allowed-tools`/`tools` of the related commands/agents.
