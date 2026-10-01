# CCF Plugin

The Claude Context First plugin. See the [root README](../../README.md) for installation and an overview.

## Layout

```
plugins/ccf/
├─ .claude-plugin/plugin.json   # manifest
├─ .mcp.json                    # microsoft-learn + context7 (HTTP, key-less)
├─ commands/                    # 4 slash commands; /ccf:plan is a skill (see skills/)
├─ agents/                      # 5 subagents, ALL read-only (see below)
├─ skills/                      # plan/ (the /ccf:plan workflow), grill-me/ (internal interview engine)
├─ hooks/                       # 7 .mjs hooks + hooks.json + lib/ helpers
├─ scripts/                     # 7 human-run CLIs (nothing invokes them automatically)
└─ templates/                   # {{...}} files that /ccf:init instantiates
```

## Agents (all read-only)

All 5 CCF agents are read-only. You implement directly in the main session; `/ccf:cook` runs one built-in general-purpose agent per task in isolated worktrees. A spawned coding agent was measured slower than writing the code yourself with the plan already loaded.

Every agent inherits the host project's tools, MCP servers and skills (no per-agent allowlist to maintain), and carries `disallowedTools: Write, Edit, NotebookEdit, Agent, Task`, so no file writes and no nested spawning.

| Agent | Role |
|---|---|
| `ccf-codebase-analyzer` | Reads one slice of the codebase, reports what exists. Fanned out 5x by `/ccf:init` and `/ccf:plan`. |
| `ccf-best-practice-researcher` | Fetches cited best practices from Context7 / MS Learn. |
| `ccf-spec-writer` | Drafts spec text from a decisions summary; the main thread writes the files. |
| `ccf-spec-checker` | Fresh-context reviewer used by `/ccf:check`. |
| `ccf-scope-checker` | Second reviewer in `/ccf:check`: does the diff stay inside the task's files and criteria, and cover all of them. |

## Hooks

Run directly with `node` (no build, no dependency, Node ≥ 18). The `.mjs` extension keeps Claude Code on Windows from prepending `bash`. Hooks auto-load from `hooks/hooks.json`; do not add a `"hooks"` field to `plugin.json` pointing at that path: it loads the file twice and fails with `Duplicate hooks file detected`.

| Hook | Event | Behavior |
|---|---|---|
| `plan-mode-guard` | `UserPromptSubmit` | Blocks `/ccf:plan` outside plan mode (exit 2). |
| `plan-skill-inject` | `UserPromptSubmit` | In plan mode, nudges the model toward the `ccf:plan` skill, once per session. Never blocks. |
| `session-start` | `SessionStart` | Re-injects the context-first reminder; re-loads the in-progress task after compact/clear; adds a freshness signal when code is newer than the spec. |
| `updatespec-nudge` | `Stop` | Advisory only. Four nudges: verify your work, run check then updatespec, mark done tasks, archive closed iterations. |
| `auto-verify` | `Stop` | Opt-in (`--auto-verify`). The only blocking Stop hook: drives one verify step (`/ccf:check`, then `/ccf:updatespec`) via `decision: "block"`. |
| `completion-evidence` | `Stop` | Opt-in (`--completion-evidence` + `TYPESAFE_API_KEY`). Advisory: asks Jev whether the diff meets the task's criteria. The diff leaves your machine. |
| `explore-guide-inject` | `SubagentStart` (`Explore`) | Injects an LSP/Grep/Glob exploration directive into the built-in `Explore` agent. |

Manual test:

```bash
echo '{"prompt":"/ccf:plan","permission_mode":"default"}' | node hooks/plan-mode-guard.mjs
# exit 2 + stderr saying plan mode is required
```

## Scripts

Human-run CLIs. File-mutating actions belong here, never in a hook.

| Script | What it does |
|---|---|
| `archive-plan.mjs` | Retire a fully-closed iteration: `PLAN.md` → `ARCHIVE.md` (`--apply` to perform; default previews). |
| `jev-slice-check.mjs` | Advisory: ask Jev which open tasks depend on each other (needs `TYPESAFE_API_KEY`). |
| `jev-backtest.mjs` | Backtest Jev's dependency recall against the archived task corpus (needs `TYPESAFE_API_KEY`). |
| `jev-verify-findings.mjs` | Advisory: ask Jev whether each `FAIL:` in a `/ccf:check` report is really in the diff. Annotates only. |
| `plan-waves.mjs` | Print the wave split for the backlog. |
| `worktree-preflight.mjs` | Read-only pre-merge check of a parallel wave (scope, overlap, merge conflicts). |
| `integrate-wave.mjs` | Merge a wave: preflight, `--no-ff` merge per branch, tests after every merge, reset to last green on red. |

## Templates

`/ccf:init` reads `templates/`, replaces `{{...}}` placeholders, writes real `CLAUDE.md` + `.claude/`. Target: each `CLAUDE.md` under 200 lines by `@import`-ing rule files (under 50 lines each).
