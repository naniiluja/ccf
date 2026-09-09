# CCF Plugin

The Claude Context First plugin. See the [root README](../../README.md) for installation and an overview.

## Plugin structure

```
plugins/ccf/
├─ .claude-plugin/plugin.json   # manifest
├─ .mcp.json                    # microsoft-learn + context7 (HTTP, key-less)
├─ commands/                    # 5 slash commands (markdown prompts)
│  ├─ init.md  plan.md  check.md
│  └─ updatespec.md  cook.md
├─ agents/                      # 4 subagents, ALL read-only — inherit the project's tools/MCP/skills (see below)
│  ├─ ccf-codebase-analyzer.md       # x5 in parallel: onboard (init) or scope a change (plan)
│  ├─ ccf-best-practice-researcher.md# fetch best practices from Context7/MS Learn
│  ├─ ccf-spec-writer.md             # draft the spec
│  └─ ccf-spec-checker.md            # fresh-context reviewer, used by /ccf:check
├─ skills/                      # 1 internal skill (invoked by commands; hidden from / menu)
│  └─ grill-me/SKILL.md         # shared requirements-interview engine (plan/init modes)
├─ hooks/
│  ├─ hooks.json
│  ├─ lib/io.mjs                # stdin/stdout JSON helpers
│  ├─ lib/freshness.mjs         # shared spec-vs-code git-commit-time heuristic (mtime fallback)
│  ├─ lib/plan.mjs              # read the in-progress task from PLAN.md
│  ├─ lib/context-usage.mjs     # transcript token usage + compact-nudge logic
│  ├─ lib/review-trace.mjs      # detect a ccf-spec-checker review in the transcript (auto-verify's cross-Stop guard)
│  ├─ lib/verify-trace.mjs      # detect "edited code but ran no test" in the session transcript
│  ├─ lib/git-trace.mjs         # detect a `git commit` ran this session (for the plan-status nudge)
│  ├─ lib/verify-chain.mjs      # decide whether a Stop drives the verify step + build its reason
│  ├─ lib/explore-guide.mjs     # build the language-agnostic LSP/Grep/Glob directive for the Explore subagent
│  ├─ lib/archive.mjs           # decide which PLAN.md iteration is fully closed + how to retire it
│  ├─ plan-mode-guard.mjs       # UserPromptSubmit: block /ccf:plan outside plan mode
│  ├─ session-start.mjs         # SessionStart: reminder + re-load task after compact
│  ├─ updatespec-nudge.mjs      # Stop: advisory nudges (verify/updatespec/plan-status); opt-in --dual-channel-stop
│  ├─ auto-verify.mjs           # Stop: opt-in (--auto-verify) block to drive the verify step
│  ├─ context-guard.mjs         # UserPromptSubmit: warn (or opt-in --hard-block) for /compact in the dumb zone
│  └─ explore-guide-inject.mjs  # SubagentStart(Explore): inject the LSP/Grep/Glob exploration directive
├─ scripts/                     # 1 human-run CLI — nothing invokes it automatically
│  └─ archive-plan.mjs          # retire a fully-closed iteration: PLAN.md → ARCHIVE.md (--apply)
└─ templates/                   # read by /ccf:init to generate files (not auto-loaded)
   ├─ root/      backend/      frontend/
```

There is no writer agent and no `/ccf:fix` command: implementing a task, and debugging directly in conversation, both happen in the main session now, never in a spawned subagent. A spawned coding subagent means waiting on a separate context to boot, read the task and hand a result back, which is measurably slower than writing the code yourself with the plan and codebase already loaded.

## Agents — tool/MCP/skill inheritance

All 4 subagents have **no `tools` allowlist**; they inherit the host project's full tool/MCP/skill set. Every one of them carries `disallowedTools: Write, Edit, NotebookEdit, Agent, Task` → inherit-all-minus-file-writes-minus-spawn (every project MCP + the Skill tool, but no file writes and no spawning a nested agent). `Agent, Task` is what blocks nested spawning (the leaf-agent invariant); both names are listed because the harness surfaces the spawn tool under either. An allowlist would block unlisted project MCP + Skill (a plugin subagent can't list unknown-at-authoring-time MCP), so inheritance is the only mechanism; safety is the file-write denial + per-call permission prompts. An inherited MCP tool may be lazily loaded — use `ToolSearch` to load its schema before calling.

## Hooks

6 hooks, run directly with `node "${CLAUDE_PLUGIN_ROOT}/hooks/<file>.mjs"`. No build, no dependency.
They use the `.mjs` extension (not `.sh`) so Claude Code on Windows doesn't auto-prepend `bash`.
The `SubagentStart` array carries ONE hook: `explore-guide-inject` (matcher `Explore`), which injects a language-agnostic LSP/Grep/Glob exploration directive into the built-in `Explore` subagent — there is no writer subagent left to inject coding rules into.
The `Stop` array carries two hooks: `updatespec-nudge` (purely advisory; its default path is single-channel `systemMessage` only — opt into dual-channel by adding `--dual-channel-stop` to its `hooks.json` command, which also emits the same nudge as `additionalContext`; **not yet observed** on a real harness `Stop` payload, so it stays off in the shipped `hooks.json`) and `auto-verify` (opt-in via `--auto-verify`, the only CCF Stop hook that BLOCKS — it drives a single verify step, `/ccf:check` then `/ccf:updatespec`, via `decision:"block"`).
There is no `SubagentStop` array and no `PreToolUse` array: both hooks that used them (`implementer-verify-gate`, gating a spawned `ccf-implementer`'s stop; `plan-review-gate`, gating `ExitPlanMode` on a plan-time premortem review) were retired along with the writer agent and the mandatory plan-review loop.

Manual test:
```bash
echo '{"prompt":"/ccf:plan","permission_mode":"default"}' | node hooks/plan-mode-guard.mjs
# exit 2 + stderr saying plan mode is required
```

## Templates

`/ccf:init` reads `templates/`, replaces the `{{...}}` placeholders, and writes real `CLAUDE.md` + `.claude/` into the project. Goal: each `CLAUDE.md` < 200 lines thanks to `@import`-ing rule files (< 50 lines each).
