# Task 017 — `agent-rules-inject.mjs` (SubagentStart hook injecting coding rules)

- **Vertical slice:** hook (deterministic) — pure lib + `node --test` + hook I/O + `hooks.json` wiring + `io.mjs` JSDoc. End-to-end tracer: a spawned `ccf-implementer` receives the coding-rules directive at start.
- **Depends on:** — (head of queue).
- **Spec refs:** `hooks.md` (Absolute invariants: no-build/no-dep/Windows-clean, defensive I/O, reuse `io.mjs`, no `"hooks"` in plugin.json); `components.md`; grounded `code.claude.com/docs/en/hooks` (SubagentStart). Memory: [[ccf-enforce-with-hook-not-prompt]], [[ground-claude-facts-primary-not-blog]].
- **Implemented by:** ccf-implementer + MCP context7 (grounding). **Test discipline:** off (lib still `node --test`).
- **Gate (must be GREEN before 018):** `node --test plugins/ccf/hooks/lib/*.test.mjs` all pass (incl. `output-style.test.mjs`); `npx -p typescript tsc --noEmit` exit 0; stdin smoke ≥3 cases; `claude plugin validate plugins/ccf` passed; **BLOCKING live-check** (below) before this task is set `done`.

## Step 0 (BLOCKING grounding — do this FIRST, in this fresh session)
Open + CITE `code.claude.com/docs/en/hooks` via Context7 to re-confirm, before writing any code:
(a) the `SubagentStart` event exists; (b) the input field is named **`agent_type`** (NOT `subagent_type` — wrong key ⇒ the hook silently never fires); (c) `hookSpecificOutput.additionalContext` is injected into the subagent's context before its first prompt. Grounded once during planning; re-confirm here because this is a fresh session.

## Goal (one sentence)
A `SubagentStart` hook injects, into every spawned `ccf-implementer`, a directive to read & obey the project's coding rules (`.claude/rules/*`) plus the active output style's coding rules (persona excluded) — deterministically, because output styles never reach subagents.

## Acceptance criteria (verifiable)
- [ ] `plugins/ccf/hooks/lib/output-style.mjs` exports pure, JSDoc'd: `shouldInject(agentType)` (allowlist `WRITER_AGENTS = new Set(["ccf-implementer"])`), `resolveActiveOutputStyle({ settingsLayers, projectStyleFiles, userStyleFiles })` → `{name,path}|null`, `buildInjectDirective(stylePath)` → string.
- [ ] `plugins/ccf/hooks/lib/output-style.test.mjs` (`node --test`) covers: shouldInject (writer / non-writer / "" / undefined); resolveActiveOutputStyle (project-over-user precedence, built-in→`path:null`, file-missing→null, malformed-settings→null, no-`outputStyle`-key→null); buildInjectDirective (with/without stylePath; always references `.claude/rules`).
- [ ] `plugins/ccf/hooks/agent-rules-inject.mjs`: reads stdin; `shouldInject(input.agent_type)` false → `exit 0`; reads settings layers + lists output-styles dir DEFENSIVELY (each `readFileSync`/`readdirSync` in try/catch, error→skip); `emitContext("SubagentStart", buildInjectDirective(path))`; ANY error → `exit 0`.
- [ ] `plugins/ccf/hooks/lib/io.mjs`: `emitContext` JSDoc adds `SubagentStart` to the additionalContext-valid events (NO new helper — reuse; body is event-agnostic).
- [ ] `plugins/ccf/hooks/hooks.json`: new `"SubagentStart"` array, NO matcher (internal `shouldInject` filter), command `node "${CLAUDE_PLUGIN_ROOT}/hooks/agent-rules-inject.mjs"` timeout 10; top-level `description` updated.
- [ ] Directive excludes persona/tone/narration/emoji/roleplay; instructs reading `.claude/rules/*` always and the style file only when resolved.

## Test first (write before implementing)
Write `output-style.test.mjs` FIRST (red): assert `shouldInject("ccf-implementer")===true`, `shouldInject("ccf-spec-checker")===false`; `resolveActiveOutputStyle` precedence + null branches; `buildInjectDirective` contains `.claude/rules` and, given a path, the path + a persona-exclusion phrase. Run → fails (module not yet present) → implement → green.

## Files to touch
- `plugins/ccf/hooks/lib/output-style.mjs` — new pure decision lib.
- `plugins/ccf/hooks/lib/output-style.test.mjs` — new `node --test`.
- `plugins/ccf/hooks/agent-rules-inject.mjs` — new SubagentStart hook (I/O only; decisions in lib).
- `plugins/ccf/hooks/lib/io.mjs` — `emitContext` JSDoc adds SubagentStart.
- `plugins/ccf/hooks/hooks.json` — add SubagentStart entry + update description.
- (tsconfig.json — NO change; glob `hooks/**/*.mjs` already covers.)

## Steps (thin end-to-end slice)
1. Step 0 grounding (cite the doc).
2. Write `output-style.test.mjs` (red).
3. Implement `output-style.mjs` to green.
4. Write `agent-rules-inject.mjs` + update `io.mjs` JSDoc + `hooks.json`.
5. `node --test` + `tsc --noEmit` + stdin smoke (a: ccf-implementer→additionalContext with directive; b: ccf-spec-checker→exit 0 no output; c: empty/malformed→exit 0) + `claude plugin validate`.
6. Mark `in-review` (NOT `done`). Run the BLOCKING live-check, then `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec` sets `done`.

## Live-check (BLOCKING — user-run, gate before `done`)
In a project with a CUSTOM output style active, spawn a real `ccf-implementer` and confirm (i) the directive appears in the subagent's context, (ii) produced code obeys the rule (e.g. no comments if the style forbids them). This is the reason the feature exists, so it gates `done` — do not defer.

## Notes / best-practice sources
Grounded `code.claude.com/docs/en/hooks` (SubagentStart: input `agent_type`, output `additionalContext` "added to the subagent's context… before its first prompt", "cannot block subagent creation"); `/en/sub-agents` + `/en/output-styles` (output style modifies the MAIN system prompt, NOT inherited by subagents); GitHub [#8395](https://github.com/anthropics/claude-code/issues/8395) (no built-in style→subagent propagation). Chose SubagentStart over `PreToolUse + updatedInput` to avoid the harness-dependent spawn-tool name + the less-certain "does updatedInput reach the subagent" path.
