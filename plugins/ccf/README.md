# CCF Plugin

The Claude Context First plugin. See the [root README](../../README.md) for installation and an overview.

## Plugin structure

```
plugins/ccf/
├─ .claude-plugin/plugin.json   # manifest
├─ .mcp.json                    # microsoft-learn + context7 (HTTP, key-less)
├─ commands/                    # 6 slash commands (markdown prompts)
│  ├─ ccf-init.md  ccf-plan.md  ccf-check.md
│  ├─ ccf-fix.md   ccf-updatespec.md  ccf-cook.md
├─ agents/                      # 6 subagents — inherit the project's tools/MCP/skills (see below)
│  ├─ ccf-codebase-analyzer.md       # x5 in parallel to onboard an existing project
│  ├─ ccf-best-practice-researcher.md# fetch best practices from Context7/MS Learn
│  ├─ ccf-implementer.md             # implement 1 task (writer: omits tools → inherit-all)
│  ├─ ccf-spec-writer.md             # draft the spec
│  ├─ ccf-spec-checker.md            # fresh-context reviewer (+ premortem plan-review)
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
│  ├─ lib/verify-trace.mjs      # detect "edited code but ran no test" in the session transcript
│  ├─ lib/git-trace.mjs         # detect a `git commit` ran this session (for the plan-status nudge)
│  ├─ lib/verify-chain.mjs      # decide whether a Stop drives the verify chain + build its reason
│  ├─ lib/output-style.mjs      # resolve active output style + build the SubagentStart rules directive
│  ├─ lib/explore-guide.mjs     # build the language-agnostic LSP/Grep/Glob directive for the Explore subagent
│  ├─ plan-mode-guard.mjs       # UserPromptSubmit: block /ccf-plan outside plan mode
│  ├─ plan-review-gate.mjs      # PreToolUse(ExitPlanMode): deny until plan is spec-checker reviewed
│  ├─ session-start.mjs         # SessionStart: reminder + re-load task after compact
│  ├─ updatespec-nudge.mjs      # Stop: advisory nudges (verify/updatespec/plan-status)
│  ├─ auto-verify.mjs           # Stop: opt-in (--auto-verify) block to drive the verify chain
│  ├─ context-guard.mjs         # UserPromptSubmit: warn (or opt-in --hard-block) for /compact in the dumb zone
│  ├─ agent-rules-inject.mjs    # SubagentStart: inject coding rules + active style into spawned ccf-implementer
│  └─ explore-guide-inject.mjs  # SubagentStart(Explore): inject the LSP/Grep/Glob exploration directive
└─ templates/                   # read by /ccf-init to generate files (not auto-loaded)
   ├─ root/      backend/      frontend/
```

## Agents — tool/MCP/skill inheritance

The 6 subagents have **no `tools` allowlist**; they inherit the host project's full tool/MCP/skill set. `ccf-implementer` (the writer) OMITS `tools` → inherit-all (every project MCP + the Skill tool). The 5 read-only agents carry `disallowedTools: Write, Edit, NotebookEdit` → inherit-all-minus-file-writes. An allowlist would block unlisted project MCP + Skill (a plugin subagent can't list unknown-at-authoring-time MCP), so inheritance is the only mechanism; safety is the file-write denial + per-call permission prompts. An inherited MCP tool may be lazily loaded — use `ToolSearch` to load its schema before calling.

## Hooks

8 hooks, run directly with `node "${CLAUDE_PLUGIN_ROOT}/hooks/<file>.mjs"`. No build, no dependency.
They use the `.mjs` extension (not `.sh`) so Claude Code on Windows doesn't auto-prepend `bash`.
The `SubagentStart` array carries two hooks: `agent-rules-inject` (no matcher; gated by an internal `WRITER_AGENTS` allowlist) injects coding rules into the writer `ccf-implementer`, and `explore-guide-inject` (matcher `Explore`) injects a language-agnostic LSP/Grep/Glob exploration directive into the built-in `Explore` subagent.
The `Stop` array also carries two hooks: `updatespec-nudge` (purely advisory) and `auto-verify` (opt-in via `--auto-verify`, the only CCF Stop hook that BLOCKS — it drives the verify chain via `decision:"block"`).

Manual test:
```bash
echo '{"prompt":"/ccf:ccf-plan","permission_mode":"default"}' | node hooks/plan-mode-guard.mjs
# exit 2 + stderr saying plan mode is required
```

## Templates

`/ccf-init` reads `templates/`, replaces the `{{...}}` placeholders, and writes real `CLAUDE.md` + `.claude/` into the project. Goal: each `CLAUDE.md` < 200 lines thanks to `@import`-ing rule files (< 50 lines each).
