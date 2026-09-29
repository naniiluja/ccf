# CCF Plugin

The Claude Context First plugin. See the [root README](../../README.md) for installation and an overview.

## Plugin structure

```
plugins/ccf/
├─ .claude-plugin/plugin.json   # manifest
├─ .mcp.json                    # microsoft-learn + context7 (HTTP, key-less)
├─ commands/                    # 4 slash commands (markdown prompts); /ccf:plan is a skill, see below
│  ├─ init.md  check.md
│  └─ updatespec.md  cook.md
├─ agents/                      # 4 subagents, ALL read-only — inherit the project's tools/MCP/skills (see below)
│  ├─ ccf-codebase-analyzer.md       # x5 in parallel: onboard (init) or scope a change (plan)
│  ├─ ccf-best-practice-researcher.md# fetch best practices from Context7/MS Learn
│  ├─ ccf-spec-writer.md             # draft the spec
│  └─ ccf-spec-checker.md            # fresh-context reviewer, used by /ccf:check
├─ skills/                      # 2 skills
│  ├─ plan/SKILL.md             # the workflow behind /ccf:plan (user-facing; the model may also load it by description)
│  └─ grill-me/SKILL.md         # internal (hidden from / menu): shared requirements-interview engine (plan/init modes)
├─ hooks/
│  ├─ hooks.json
│  ├─ lib/io.mjs                # stdin/stdout JSON helpers
│  ├─ lib/freshness.mjs         # shared spec-vs-code git-commit-time heuristic (mtime fallback)
│  ├─ lib/plan.mjs              # read the in-progress task from PLAN.md
│  ├─ lib/review-trace.mjs      # detect a ccf-spec-checker review in the transcript (auto-verify's cross-Stop guard)
│  ├─ lib/verify-trace.mjs      # detect "edited code but ran no test" in the session transcript
│  ├─ lib/git-trace.mjs         # detect a `git commit` ran this session (for the plan-status nudge)
│  ├─ lib/verify-chain.mjs      # decide whether a Stop drives the verify step + build its reason
│  ├─ lib/explore-guide.mjs     # build the language-agnostic LSP/Grep/Glob directive for the Explore subagent
│  ├─ lib/archive.mjs           # decide which PLAN.md iteration is fully closed + how to retire it
│  ├─ lib/plan-trigger.mjs      # decide whether a plan-mode prompt gets the ccf:plan nudge + build it
│  ├─ lib/jev-client.mjs        # one fetch call to TypeSafe System One (fail-open, aborts before the hook timeout)
│  ├─ lib/slice-check.mjs       # task Files-to-touch parsing, batched pairwise questions, dependency graph + waves
│  ├─ lib/completion-evidence.mjs # criteria, sensitive-path filter, size cap, Jev request + answer interpretation
│  ├─ plan-mode-guard.mjs       # UserPromptSubmit: block /ccf:plan outside plan mode
│  ├─ plan-skill-inject.mjs     # UserPromptSubmit: in plan mode, nudge the model toward the ccf:plan skill
│  ├─ session-start.mjs         # SessionStart: reminder + re-load task after compact
│  ├─ updatespec-nudge.mjs      # Stop: advisory nudges (verify/updatespec/plan-status); opt-in --dual-channel-stop
│  ├─ auto-verify.mjs           # Stop: opt-in (--auto-verify) block to drive the verify step
│  ├─ completion-evidence.mjs   # Stop: opt-in (--completion-evidence + TYPESAFE_API_KEY) advisory: ask Jev if the diff meets the task's criteria
│  └─ explore-guide-inject.mjs  # SubagentStart(Explore): inject the LSP/Grep/Glob exploration directive
├─ scripts/                     # 3 human-run CLIs — nothing invokes them automatically
│  ├─ jev-slice-check.mjs       # advisory: ask Jev which open tasks depend on each other / are fragments (needs TYPESAFE_API_KEY)
│  ├─ jev-verify-findings.mjs   # advisory: ask Jev whether each FAIL: of a /ccf:check report is in the diff; annotates only (needs TYPESAFE_API_KEY)
│  └─ archive-plan.mjs          # retire a fully-closed iteration: PLAN.md → ARCHIVE.md (--apply)
└─ templates/                   # read by /ccf:init to generate files (not auto-loaded)
   ├─ root/      backend/      frontend/
```

There is no writer agent and no `/ccf:fix` command: implementing a task, and debugging directly in conversation, both happen in the main session now, never in a spawned subagent. A spawned coding subagent means waiting on a separate context to boot, read the task and hand a result back, which is measurably slower than writing the code yourself with the plan and codebase already loaded.

## Agents — tool/MCP/skill inheritance

All 4 subagents have **no `tools` allowlist**; they inherit the host project's full tool/MCP/skill set. Every one of them carries `disallowedTools: Write, Edit, NotebookEdit, Agent, Task` → inherit-all-minus-file-writes-minus-spawn (every project MCP + the Skill tool, but no file writes and no spawning a nested agent). `Agent, Task` is what blocks nested spawning (the leaf-agent invariant); both names are listed because the harness surfaces the spawn tool under either. An allowlist would block unlisted project MCP + Skill (a plugin subagent can't list unknown-at-authoring-time MCP), so inheritance is the only mechanism; safety is the file-write denial + per-call permission prompts. An inherited MCP tool may be lazily loaded — use `ToolSearch` to load its schema before calling.

## Hooks

7 hooks, run directly with `node "${CLAUDE_PLUGIN_ROOT}/hooks/<file>.mjs"`. No build, no dependency.
They use the `.mjs` extension (not `.sh`) so Claude Code on Windows doesn't auto-prepend `bash`.
The `UserPromptSubmit` array carries two hooks: `plan-mode-guard` (blocks `/ccf:plan` outside plan mode) and `plan-skill-inject` (nudges the model toward the `ccf:plan` skill once per session when a CCF project is in plan mode). The old `/compact` nudge (`context-guard`) was retired; CCF no longer measures context usage.
The `SubagentStart` array carries ONE hook: `explore-guide-inject` (matcher `Explore`), which injects a language-agnostic LSP/Grep/Glob exploration directive into the built-in `Explore` subagent — there is no writer subagent left to inject coding rules into.
The `Stop` array carries three hooks (the third, `completion-evidence`, is opt-in via `--completion-evidence` plus `TYPESAFE_API_KEY`, advisory only, and sends the diff to `api.typesafe.ai`): `updatespec-nudge` (purely advisory; its default path is single-channel `systemMessage` only — opt into dual-channel by adding `--dual-channel-stop` to its `hooks.json` command, which also emits the same nudge as `additionalContext`; **not yet observed** on a real harness `Stop` payload, so it stays off in the shipped `hooks.json`) and `auto-verify` (opt-in via `--auto-verify`, the only CCF Stop hook that BLOCKS — it drives a single verify step, `/ccf:check` then `/ccf:updatespec`, via `decision:"block"`).
There is no `SubagentStop` array and no `PreToolUse` array: both hooks that used them (`implementer-verify-gate`, gating a spawned `ccf-implementer`'s stop; `plan-review-gate`, gating `ExitPlanMode` on a plan-time premortem review) were retired along with the writer agent and the mandatory plan-review loop.

Manual test:
```bash
echo '{"prompt":"/ccf:plan","permission_mode":"default"}' | node hooks/plan-mode-guard.mjs
# exit 2 + stderr saying plan mode is required
```

## Templates

`/ccf:init` reads `templates/`, replaces the `{{...}}` placeholders, and writes real `CLAUDE.md` + `.claude/` into the project. Goal: each `CLAUDE.md` < 200 lines thanks to `@import`-ing rule files (< 50 lines each).
