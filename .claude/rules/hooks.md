---
description: Claude Code hook contract and CCF's .mjs hook conventions.
paths: plugins/ccf/hooks/**
---

# Hooks (`plugins/ccf/hooks/*.mjs`)

## Absolute invariants
- **No-build, no-dependency, Windows-clean.** Hooks are `.mjs` ESM run directly with `node` (Node ≥ 18). Do NOT add an npm dependency, do NOT add a transpile/bundle step. All I/O via `node:fs`, `node:path`, `node:child_process` built-ins.
- Type-check with `tsc` using `checkJs` + JSDoc (see `tsconfig.json`). Do NOT switch to `.ts`.
- Paths in `hooks.json` use `node "${CLAUDE_PLUGIN_ROOT}/hooks/<file>.mjs"` — this variable ONLY expands in a hook command.

## I/O contract (packaged in `hooks/lib/io.mjs` — reuse it, don't rewrite)
- **Read stdin**: `readStdinJson()` — always returns `{}` on empty/TTY/parse error so the hook NEVER crashes.
- **Inject context (non-blocking)**: `emitContext(eventName, text)` — prints `{ hookSpecificOutput: { hookEventName, additionalContext } }` then `exit 0`. For SessionStart, Stop, PreToolUse, PostToolUse.
- **Block a prompt**: `blockUserPrompt(reason)` — writes `reason` to stderr then `exit 2`. UserPromptSubmit only.

## Exit code semantics (per Claude Code docs)
- `exit 0` — no decision, the flow continues normally (even after emitting additionalContext).
- `exit 2` — **BLOCK**; stderr is sent back as feedback. This is the only blocking mechanism CCF uses.
- `exit 1` — non-blocking error, does NOT block. CCF avoids it (it adds noise without blocking).

## Events CCF currently uses (`hooks.json`)
- `UserPromptSubmit` → `plan-mode-guard.mjs`: only intervenes on prompts containing `/ccf-plan` (namespaced + bare regex); blocks if `permission_mode !== "plan"`. Every other prompt `exit 0` immediately.
- `SessionStart` (matcher `startup|clear|compact`) → `session-start.mjs`: injects the context-first reminder; if CCF-managed, adds a freshness signal + re-loads the in-progress task after `compact`/`clear`.
- `Stop` → `updatespec-nudge.mjs`: PURELY ADVISORY, never blocks. Must check `input.stop_hook_active` to avoid loops.

## Hook-writing conventions
- Each hook starts with `#!/usr/bin/env node` + a comment describing the event, mechanism, role.
- Defensive: wrap every `readdirSync`/`statSync`/`readFileSync` in try/catch, on error → skip the entry (the freshness heuristic is only for nudging, must not break the session).
- Limit recursion depth when walking the tree (e.g. `newestMtime(dir, depth)`); always skip `node_modules` and `.git`.
- Hooks run synchronously and block Claude — keep them fast; `hooks.json` sets a `timeout` (seconds) per hook.
- When adding a new hook: add an entry to `hooks.json` + a comment, reuse `io.mjs`, add the file to `tsconfig.json`'s `include` if it doesn't match the glob.
- **Do NOT declare `"hooks": "./hooks/hooks.json"` in `plugin.json`.** Current Claude Code (v2.1.x) auto-loads `hooks/hooks.json` from the standard location; the `manifest.hooks` field is only for *additional* hook files at a non-standard path (e.g. `./config/hooks.json`). Pointing it back at the standard `hooks/hooks.json` loads the file twice → fatal `Duplicate hooks file detected` and the plugin fails to load. Verify with `claude plugin validate plugins/ccf`. (History: a much older Claude Code did NOT auto-discover and required the field — that behavior was reversed; do not re-add it.)
