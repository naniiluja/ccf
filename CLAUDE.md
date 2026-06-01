# CCF — Claude Context First (plugin source)

> Managed by **CCF**. This project IS the source code of the CCF plugin — not an app with a DB/API/frontend.
> **STRICTLY SEQUENTIAL**: one change at a time, no parallel work on multiple things.
> Ground every decision about Claude Code's schema/contract in the official docs (via Context7) before writing.
> Keep this spec always fresh with `/ccf:ccf-updatespec`.

## What this is
CCF is a **Claude Code plugin** that imposes a context-first, spec-driven, strictly sequential workflow. It has NO application runtime (no server, DB, API, UI). The entire "product" is the artifacts Claude Code loads: commands (markdown prompts), agents/subagents (markdown), hooks (`.mjs` scripts run by `node`), templates for `/ccf-init` to instantiate, plus distribution manifests. Users install via a marketplace, then run `/ccf:ccf-*`.

## Repo layout
- **git init at the root** (`D:/projects/ccf`). The root holds `CLAUDE.md`, `.claude/`, `package.json`, `tsconfig.json`, `bin/`, `README.md`, `LICENSE`, `.claude-plugin/marketplace.json`.
- `plugins/ccf/` — the plugin itself. `.claude-plugin/plugin.json` is the manifest (ONLY the manifest goes in `.claude-plugin/`); the component directories live at the **plugin root**:
  - `commands/*.md` — 6 slash commands (`ccf-init`, `ccf-plan`, `ccf-check`, `ccf-fix`, `ccf-test`, `ccf-updatespec`).
  - `agents/*.md` — 6 subagents (`ccf-codebase-analyzer`, `ccf-best-practice-researcher`, `ccf-implementer`, `ccf-spec-writer`, `ccf-spec-checker`, `ccf-debugger`).
  - `skills/grill-me/SKILL.md` — 1 internal skill: the shared requirements-interview engine invoked by `ccf-plan`/`ccf-fix`/`ccf-init` (`user-invocable: false`; hidden from the `/` menu).
  - `hooks/*.mjs` + `hooks/hooks.json` + `hooks/lib/` — 5 hooks (plan-mode-guard, plan-review-gate, session-start, updatespec-nudge, context-guard — the last warns/optionally hard-blocks on `UserPromptSubmit` when context enters the degrade zone) sharing `lib/io.mjs` (+ `lib/freshness.mjs`, `lib/plan.mjs`, `lib/context-usage.mjs`, `lib/review-trace.mjs`).
  - `templates/{root,backend,frontend}/**` — `*.tmpl` files with `{{...}}` placeholders for `/ccf-init` to instantiate.
  - `.mcp.json` — bundles 2 remote MCP servers (microsoft-learn, context7).
- `bin/ccf-bootstrap.mjs` — the npx entry; only shells out to the `claude plugin` CLI, writes no files itself.

## Core invariants (read before editing)
- Hooks are **no-build, no-dependency, Windows-clean** `.mjs` run directly with `node` (Node ≥ 18). Do NOT add a dependency, do NOT add a build step. See `@.claude/rules/hooks.md`.
- Components (command/agent/template) are **markdown prompts**, not executable code. Editing the content = changing Claude's behavior. See `@.claude/rules/components.md`.
- `${CLAUDE_PLUGIN_ROOT}` only expands in `hooks[].command` and `mcpServers` — NOT in markdown frontmatter.
- Every `CLAUDE.md` (including ones CCF generates for other projects) must be < 200 lines, pushing detail into `.claude/rules/*` via `@import` (max depth 5).

## Rules (imported — keep this file < 200 lines)
@.claude/rules/architecture.md
@.claude/rules/components.md
@.claude/rules/hooks.md
@.claude/rules/coding-conventions.md
@.claude/rules/testing.md
@.claude/rules/tooling.md
@.claude/rules/git-workflow.md

## Current plan
No open tasks. Latest closed iteration in `.claude/plan/PLAN.md` — **plan-status-sync** (tasks 010–011: `in-review` status + Stop-hook clause C nudging "committed but PLAN.md not done"). Prior iterations also closed: test-discipline opt-in (005–009, v0.3.0), best-practice integration (001–004, v0.2.0). **Task-status lifecycle**: `todo → in-progress → in-review → done` — `ccf-implementer` reaches `in-review`; only `/ccf:ccf-updatespec` writes `done` after `/ccf:ccf-check` + `/code-review` pass. When you need a new change, enter plan mode and run `/ccf:ccf-plan`; execute one task at a time in a fresh session via `ccf-implementer`, gate GREEN before the next.
