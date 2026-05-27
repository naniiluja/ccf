# CCF — Claude Context First

**English** · [Tiếng Việt](./README.vi.md) · [简体中文](./README.zh-CN.md)

A workflow plugin for [Claude Code](https://code.claude.com) that enforces a **context-first, spec-driven, strictly sequential** way of working:

- **Context-first**: the spec lives in `CLAUDE.md` + `.claude/`, kept continuously fresh so every session starts with fresh context.
- **Grounding**: every design decision references best practices from **Context7** and **Microsoft Learn** (two MCP servers bundled with the plugin).
- **Strictly sequential**: one task at a time (waterfall), no parallel feature development — to maximize quality.
- **Adapts to your codebase**: bootstrap a fresh project as a monorepo (git init at the root; fullstack splits into `be/` + `fe/` with nested specs) — *or* onboard an existing codebase, where `/ccf:ccf-init` analyzes the real structure (5 read-only agents) and writes a spec that mirrors it, with no layout forced on you.

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

## The 5 commands

| Command | What it does |
|---------|--------------|
| `/ccf:ccf-init` | Bootstrap a new project (interview → generate CLAUDE.md + .claude + plan) or onboard an existing one (5 analyzer agents). |
| `/ccf:ccf-plan` | Create a sequential plan for one feature. **Requires plan mode** (Shift+Tab). After planning, execute each task with an agent. |
| `/ccf:ccf-check` | Verify the implementation against the spec (conformance, conventions, SOLID/OOP, BE↔FE cross-check). |
| `/ccf:ccf-fix` | Disciplined debugging: reproduce → trace logs/DB step by step → root cause → failing test → fix. |
| `/ccf:ccf-updatespec` | Update the spec **and system memory** with this session's lessons (incl. new tools with "when to use"). |

Typical flow: `ccf-init` → (plan mode) `ccf-plan` → implement → `ccf-check` → `/code-review` → `ccf-updatespec`.

## Bundled MCP servers

The plugin bundles 2 MCP servers (plugin scope, auto started/stopped by Claude Code):

- **microsoft-learn** — `https://learn.microsoft.com/api/mcp` (remote HTTP, no auth required).
- **context7** — `https://mcp.context7.com/mcp` (remote HTTP, works out of the box without a key).

> **Context7 rate limit:** the plugin runs Context7 without an API key (free rate limit). If you hit a rate limit, get a free key at [context7.com/dashboard](https://context7.com/dashboard), set the `CONTEXT7_API_KEY` env var, and restart Claude Code.

## Spec vs Memory (two context tiers)

`/ccf:ccf-updatespec` records lessons in **two places** with different purposes:

- **Spec** (`CLAUDE.md` + `.claude/rules/`) — loaded as a *user message*, lower weight. Holds **project rules**: conventions, architecture, tech-stack, tooling.
- **Memory** (`~/.claude/projects/<path>/memory/`) — loaded into the *system prompt*, **not down-weighted**, so Claude follows it more strongly. Holds **anti-mistake feedback** + **user preferences** across sessions → helps Claude repeat fewer mistakes.

Principle: **no duplication**. A rule in CLAUDE.md that keeps getting forgotten → write a `feedback` memory that *reinforces* it (with the "why"), rather than copying its content.

## Compact-aware mechanism

A proactive `/compact <hint>` beats letting auto-compact fire (when context has "rotted" the model is at its least sharp). After you compact, CCF's `SessionStart` hook (matcher `compact`) auto re-loads the in-progress task from `.claude/plan/PLAN.md`, restoring the right work context so you don't have to paste it back.

## Architecture

- **Commands** = markdown prompts that drive Claude in-session (not scripts).
- **Hooks** = `.mjs` run directly with `node` — no build step, no dependency, Windows-clean.
- **Agents** = 6 specialized subagents (analyzer, researcher, implementer, spec-writer, spec-checker, debugger).

See `plugins/ccf/` for details. Requires Node ≥ 18 for the hooks.

## License

MIT
