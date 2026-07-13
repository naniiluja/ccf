---
description: Tools and MCP used in / for developing the CCF plugin — with "when to use".
---

# Tooling

## Plugin-bundled MCP servers (`plugins/ccf/.mcp.json`)
Two remote HTTP servers, auto started/stopped by Claude Code at plugin scope:
- **context7** (`https://mcp.context7.com/mcp`) — **use when**: you need to look up the schema/contract/syntax of Claude Code, a library, framework, or CLI. Flow: `resolve-library-id` → `query-docs`. Runs without an API key (free rate limit); if rate-limited, set env `CONTEXT7_API_KEY` (free at context7.com/dashboard) and restart Claude Code.
- **microsoft-learn** (`https://learn.microsoft.com/api/mcp`) — **use when**: you need Microsoft/Azure/.NET platform guidance. No auth. Tools: `microsoft_docs_search` (breadth) → `microsoft_code_sample_search` (examples) → `microsoft_docs_fetch` (depth).

> Grounding is a CCF law: before writing a spec/decision about Claude Code's schema or a library, consult the official docs and CITE them, don't rely on memory.

> **shadcn MCP is intentionally NOT bundled here.** The official shadcn server (`npx shadcn@latest mcp`) is **stdio + project-scoped** (it reads the target project's `components.json`), so bundling it at CCF's plugin scope would make it run — and error — in every non-React project. Instead `/ccf-init` writes it into the **target React project's own `.mcp.json`** when the user picks shadcn (same pattern as the Supabase/Railway hosting MCP). Keep this file's count at **2 bundled servers**.

## Grounding subagent
- `ccf-best-practice-researcher` — **use when**: you want to fan out best-practice lookups into a separate context so they don't flood the main conversation. It calls Context7/MS Learn and returns a cited recommendation.

## Internal skill
- `grill-me` (`plugins/ccf/skills/grill-me/SKILL.md`) — **use when**: a command (`ccf-plan`/`ccf-fix`/`ccf-init`) needs to interview the user before acting. **How to call**: invoke via the Skill tool, passing the mode (`plan`/`fix`/`init`) as the argument; it runs the one-question-at-a-time interview and returns a summary. Internal (`user-invocable: false`) — not for direct user invocation; model-invocation stays enabled so commands can call it.

## Plugin development tools
- **Node ≥ 18** — runs the hooks and `bin/ccf-bootstrap.mjs`.
- **`tsc`** — type-checks JS via `tsconfig.json`. **Use when**: you just edited any `.mjs`. Run `npm install` (once) then **`npx -p typescript tsc --noEmit`** (bare `npx tsc` grabs an unrelated squat package since `typescript` isn't a devDependency). Needs `@types/node` (already in `devDependencies`) because `tsconfig` sets `"types": ["node"]` — this is a type-check devDependency, not a runtime dep.
- **`claude plugin` CLI** — `marketplace add` / `install`. **Use when**: installing locally or in `bin/ccf-bootstrap.mjs`.

## CCF self-checks (internal commands)
- `/ccf:ccf-check` — verify the implementation against this spec (conformance, conventions, SOLID, cross-check).
- `/ccf:ccf-updatespec` — refresh the spec after a session; **also records new tools with "when to use"** into this very file.
- `/ccf:ccf-cook` — **use when**: you want to run the WHOLE todo/in-progress backlog in one go instead of a fresh session per task — sequential `ccf-implementer` loop (stop on any red gate) then a batch-verify pass (review + `/code-review` in parallel, `/simplify`, re-gate, `/ccf:ccf-updatespec`). **Mutually exclusive with `auto-verify.mjs --auto-verify`** — `/ccf:ccf-cook` drives the same verify chain itself; don't enable both. NOTE: the contract-level test matrix (EP+BVA+decision-table) is written by `ccf-implementer` during implement (part of its failing-test-first flow), NOT a separate command.

## Convention for adding a new tool
When integrating a new tool/MCP, add an entry here in the format "**name** — when to use — how to call", and update the `allowed-tools` of the related COMMANDS (main-loop scope, least-privilege). Do NOT add it to an agent `tools` list: subagents have NO `tools` allowlist — they reach project-arbitrary MCP by INHERITANCE (writer uses `disallowedTools: Agent, Task` → inherit-all-minus-spawn; the 5 read-only agents use `disallowedTools: Write, Edit, NotebookEdit, Agent, Task`), so a newly added project MCP is automatically available to them with no per-agent edit. An inherited MCP tool may be lazily loaded — load its schema with `ToolSearch` before calling it (a blind call fails with InputValidationError).
