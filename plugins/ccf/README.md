# CCF Plugin

The Claude Context First plugin. See the [root README](../../README.md) for installation and an overview.

## Plugin structure

```
plugins/ccf/
├─ .claude-plugin/plugin.json   # manifest
├─ .mcp.json                    # microsoft-learn + context7 (HTTP, key-less)
├─ commands/                    # 6 slash commands (markdown prompts)
│  ├─ ccf-init.md  ccf-plan.md  ccf-check.md
│  ├─ ccf-fix.md   ccf-updatespec.md
├─ agents/                      # 6 subagents
│  ├─ ccf-codebase-analyzer.md       # x5 in parallel to onboard an existing project
│  ├─ ccf-best-practice-researcher.md# fetch best practices from Context7/MS Learn
│  ├─ ccf-implementer.md             # implement 1 task (has MCP)
│  ├─ ccf-spec-writer.md             # draft the spec
│  ├─ ccf-spec-checker.md            # fresh-context reviewer
│  └─ ccf-debugger.md                # investigate 1 root-cause branch
├─ skills/                      # 1 internal skill (invoked by commands; hidden from / menu)
│  └─ grill-me/SKILL.md         # shared requirements-interview engine (plan/fix/init modes)
├─ hooks/
│  ├─ hooks.json
│  ├─ lib/io.mjs                # stdin/stdout JSON helpers
│  ├─ lib/freshness.mjs         # shared spec-vs-code git-commit-time heuristic (mtime fallback)
│  ├─ lib/plan.mjs              # read the in-progress task from PLAN.md
│  ├─ lib/context-usage.mjs     # transcript token usage + compact-nudge logic
│  ├─ lib/review-trace.mjs      # detect /ccf-plan session + ccf-spec-checker review in transcript
│  ├─ plan-mode-guard.mjs       # UserPromptSubmit: block /ccf-plan outside plan mode
│  ├─ plan-review-gate.mjs      # PreToolUse(ExitPlanMode): deny until plan is spec-checker reviewed
│  ├─ session-start.mjs         # SessionStart: reminder + re-load task after compact
│  ├─ updatespec-nudge.mjs      # Stop: nudge /ccf-updatespec
│  └─ context-guard.mjs         # UserPromptSubmit: warn (or opt-in --hard-block) for /compact in the dumb zone
└─ templates/                   # read by /ccf-init to generate files (not auto-loaded)
   ├─ root/      backend/      frontend/
```

## Hooks

Run directly with `node "${CLAUDE_PLUGIN_ROOT}/hooks/<file>.mjs"`. No build, no dependency.
They use the `.mjs` extension (not `.sh`) so Claude Code on Windows doesn't auto-prepend `bash`.

Manual test:
```bash
echo '{"prompt":"/ccf:ccf-plan","permission_mode":"default"}' | node hooks/plan-mode-guard.mjs
# exit 2 + stderr saying plan mode is required
```

## Templates

`/ccf-init` reads `templates/`, replaces the `{{...}}` placeholders, and writes real `CLAUDE.md` + `.claude/` into the project. Goal: each `CLAUDE.md` < 200 lines thanks to `@import`-ing rule files (< 50 lines each).
