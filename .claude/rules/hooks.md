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
- **Inject context (non-blocking)**: `emitContext(eventName, text)` — prints `{ hookSpecificOutput: { hookEventName, additionalContext } }` then `exit 0`. ONLY for events whose schema accepts `additionalContext`: SessionStart, UserPromptSubmit, PostToolUse. **NOT PreToolUse** (its `hookSpecificOutput` is `permissionDecision`/`permissionDecisionReason` only) and **NOT Stop** (no `hookSpecificOutput`/`additionalContext` at all — validator rejects it as "Invalid input").
- **Advise at Stop (non-blocking)**: `emitSystemMessage(text)` — prints `{ systemMessage }` then `exit 0`. The only non-blocking channel for a `Stop` hook (omitting `decision` lets the stop proceed; a `decision: "block"` would force Claude to keep working).
- **Block a prompt**: `blockUserPrompt(reason)` — writes `reason` to stderr then `exit 2`. UserPromptSubmit only.

## Exit code semantics (per Claude Code docs)
- `exit 0` — no decision, the flow continues normally (even after emitting additionalContext).
- `exit 2` — **BLOCK**; stderr is sent back as feedback. This is the only blocking mechanism CCF uses.
- `exit 1` — non-blocking error, does NOT block. CCF avoids it (it adds noise without blocking).

## Events CCF currently uses (`hooks.json`)
- `UserPromptSubmit` → `plan-mode-guard.mjs`: only intervenes on prompts containing `/ccf-plan` (namespaced + bare regex); blocks if `permission_mode !== "plan"`. Every other prompt `exit 0` immediately.
- `SessionStart` (matcher `startup|clear|compact`) → `session-start.mjs`: injects the context-first reminder; if CCF-managed, adds a freshness signal + re-loads the in-progress task after `compact`/`clear`.
- `Stop` → `updatespec-nudge.mjs`: PURELY ADVISORY, never blocks. Surfaces the nudge via `emitSystemMessage` (`{ systemMessage }`), NOT `additionalContext` (which `Stop` does not support). Must check `input.stop_hook_active` to avoid loops.
- `PostToolUse` → `context-nudge.mjs`: PURELY ADVISORY, never blocks. Reads `transcript_path` (.jsonl) to compute current context tokens (`message.usage` of the last assistant line: input + cache_creation + cache_read); if ≥ ~40% of the model window — capped at an absolute ~300k tokens via `NUDGE_ABS_CAP` (40% of a 1M-native Opus/Sonnet-4.x window = 400k is unreachable before auto-compact, so the cap keeps the nudge useful), i.e. the "dumb zone" — it injects `additionalContext` nudging a proactive `/compact <hint>` (hint pre-filled with the in-progress task via `lib/plan.mjs`). The transcript `.jsonl` shape is **undocumented/internal** → read it **best-effort only**: any error returns null and the hook stays silent (never breaks a session). Anti-spam dedup state lives in the OS temp dir keyed by `session_id` (NOT in git-tracked `.claude/`). The dedup mark MUST be persisted on EVERY run **before** the threshold gate (the `decideNudge` decision is pure + unit-tested), so the mark can fall through the sub-threshold band where a `/compact` lands — otherwise the next climb back into the degrade zone is silently suppressed.

## Hook-writing conventions
- Each hook starts with `#!/usr/bin/env node` + a comment describing the event, mechanism, role.
- Defensive: wrap every `readdirSync`/`statSync`/`readFileSync` in try/catch, on error → skip the entry (the freshness heuristic is only for nudging, must not break the session).
- Limit recursion depth when walking the tree (e.g. `newestMtime(dir, depth)`); always skip `node_modules` and `.git`.
- Hooks run synchronously and block Claude — keep them fast; `hooks.json` sets a `timeout` (seconds) per hook.
- When adding a new hook: add an entry to `hooks.json` + a comment, reuse `io.mjs`, add the file to `tsconfig.json`'s `include` if it doesn't match the glob.
- **Do NOT declare `"hooks": "./hooks/hooks.json"` in `plugin.json`.** Current Claude Code (v2.1.x) auto-loads `hooks/hooks.json` from the standard location; the `manifest.hooks` field is only for *additional* hook files at a non-standard path (e.g. `./config/hooks.json`). Pointing it back at the standard `hooks/hooks.json` loads the file twice → fatal `Duplicate hooks file detected` and the plugin fails to load. Verify with `claude plugin validate plugins/ccf`. (History: a much older Claude Code did NOT auto-discover and required the field — that behavior was reversed; do not re-add it.)
