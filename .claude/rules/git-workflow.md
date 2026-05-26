---
description: Git and distribution/versioning conventions for the CCF plugin.
---

# Git workflow & distribution

## Git
- **Do NOT commit/push/create branches unless the user explicitly asks.** This is a hard rule of CCF and of the output style — it applies to hooks, commands, agents, and the spec.
- git init at the **repo root**, not in sub-folders. `.gitignore` already excludes `node_modules/`, `dist/`, `*.log`, `.env*`.
- When asked to commit: the message describes the change by artifact type (e.g. `feat: add hook X`, `docs: sync README`).

## Versioning (synced in 3 places — easy to drift)
The version number appears in **three** files and must match on every bump:
1. `package.json` → `version`
2. `plugins/ccf/.claude-plugin/plugin.json` → `version`
3. `.claude-plugin/marketplace.json` → `plugins[0].version`

Claude Code's resolution order: `plugin.json` > `marketplace.json` > git SHA. Still, keep all three in sync to avoid confusing installers.

## Syncing on plugin structure changes
A structural change usually touches multiple files — check all before calling it done:
- Add/change/remove a **command** → `commands/`, README (command table), cross-references in other prompts.
- Add/change/remove an **agent** → `agents/`, every command that calls it via Task, README if listed.
- Add/change a **hook** → `hooks/<file>.mjs`, `hooks/hooks.json`, `tsconfig.json` (the `include` glob).
- Add an **MCP** → `.mcp.json`, the `allowed-tools`/`tools` of commands/agents that use it, `tooling.md`.

## README is the user doc, the spec is for Claude
The README + spec must be consistent on the count/names of commands. If they diverge (e.g. README says "5 commands" while there are 6), treat it as **drift** to fix on next touch — README/MEMORY is not the source of truth; the real files in `commands/`+`agents/` are.
