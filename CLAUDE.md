# CCF — Claude Context First (plugin source)

> Managed by **CCF**. This project IS the source code of the CCF plugin — not an app with a DB/API/frontend.
> **STRICTLY SEQUENTIAL**: one change at a time, no parallel work on multiple things.
> Ground every decision about Claude Code's schema/contract in the official docs (via Context7) before writing.
> Keep this spec always fresh with `/ccf:updatespec`.

## What this is
CCF is a **Claude Code plugin** that imposes a context-first, spec-driven, strictly sequential workflow. It has NO application runtime (no server, DB, API, UI). The entire "product" is the artifacts Claude Code loads: commands (markdown prompts), agents/subagents (markdown), hooks (`.mjs` scripts run by `node`), templates for `/ccf:init` to instantiate, plus distribution manifests. Users install via a marketplace, then run `/ccf:*` (e.g. `/ccf:plan`).

## Repo layout
- **git init at the root** (`D:/projects/ccf`). The root holds `CLAUDE.md`, `.claude/`, `package.json`, `tsconfig.json`, `bin/`, `README.md`, `LICENSE`, `.claude-plugin/marketplace.json`.
- `plugins/ccf/` — the plugin itself. `.claude-plugin/plugin.json` is the manifest (ONLY the manifest goes in `.claude-plugin/`); the component directories live at the **plugin root**:
  - `commands/*.md` — 6 slash commands (`init`, `plan`, `check`, `fix`, `updatespec`, `cook`; invoked via the plugin namespace, e.g. `/ccf:plan`).
  - `agents/*.md` — 6 subagents (`ccf-codebase-analyzer`, `ccf-best-practice-researcher`, `ccf-implementer`, `ccf-spec-writer`, `ccf-spec-checker`, `ccf-debugger`).
  - `skills/grill-me/SKILL.md` — 1 internal skill: the shared requirements-interview engine invoked by `/ccf:plan`/`/ccf:fix`/`/ccf:init` (`user-invocable: false`; hidden from the `/` menu).
  - `hooks/*.mjs` + `hooks/hooks.json` + `hooks/lib/` — 9 hooks (plan-mode-guard, plan-review-gate, session-start, updatespec-nudge — advisory Stop nudges, auto-verify — an opt-in `--auto-verify` Stop hook that BLOCKS via `decision:"block"` to drive the verify chain when a task is in-review and code changed this session, context-guard — warns/optionally hard-blocks on `UserPromptSubmit` when context enters the degrade zone — agent-rules-inject, which on `SubagentStart` injects the project coding rules + active output style's coding rules into spawned `ccf-implementer` subagents, explore-guide-inject, which on `SubagentStart` (matcher `Explore`) injects a language-agnostic LSP/Grep/Glob exploration directive into the built-in `Explore` subagent, and implementer-verify-gate — an opt-in `--enforce-tests` `SubagentStop` hook (matcher `ccf-implementer`) that BLOCKS via `decision:"block"` when a spawned implementer's final message carries no `TEST-RESULT:` evidence) sharing `lib/io.mjs` (+ `lib/freshness.mjs`, `lib/plan.mjs`, `lib/context-usage.mjs`, `lib/review-trace.mjs`, `lib/git-trace.mjs`, `lib/verify-trace.mjs`, `lib/verify-chain.mjs`, `lib/output-style.mjs`, `lib/explore-guide.mjs`, `lib/implementer-verify.mjs`).
  - `scripts/archive-plan.mjs` — 1 human-run CLI (not a hook, not a command; nothing invokes it automatically). Retires a fully-closed iteration out of `PLAN.md` into `ARCHIVE.md`. File-MUTATING actions belong here, never in a hook — see `@.claude/rules/architecture.md`.
  - `templates/{root,backend,frontend}/**` — `*.tmpl` files with `{{...}}` placeholders for `/ccf:init` to instantiate.
  - `.mcp.json` — bundles 2 remote MCP servers (microsoft-learn, context7).
- `bin/ccf-bootstrap.mjs` — the npx entry; only shells out to the `claude plugin` CLI, writes no files itself.

## Core invariants (read before editing)
- Hooks are **no-build, no-dependency, Windows-clean** `.mjs` run directly with `node` (Node ≥ 18). Do NOT add a dependency, do NOT add a build step. See `@.claude/rules/hooks.md`.
- Components (command/agent/template) are **markdown prompts**, not executable code. Editing the content = changing Claude's behavior. See `@.claude/rules/components.md`.
- `${CLAUDE_PLUGIN_ROOT}` only expands in `hooks[].command` and `mcpServers` — NOT in markdown frontmatter.
- Every `CLAUDE.md` (including ones CCF generates for other projects) must be **< 200 lines AND < 12KB, whichever binds first**, pushing detail into `.claude/rules/*` via `@import` (max depth 5). **Measure both, because a line count alone is gameable:** this file passed "< 200 lines" at 38 lines while weighing 25KB, since a single `## Current plan` paragraph had grown to 21KB on one line. Official guidance calls `CLAUDE.md` a cheat sheet of about two screens, not documentation; 200 lines of readable prose lands near 12KB, so a file over that is documentation no matter how few newlines it contains. Check with `wc -lc CLAUDE.md`, not by eye.
- **Everything `CLAUDE.md` `@import`s is loaded EVERY session — budget it as one total.** Run `wc -c CLAUDE.md .claude/rules/*.md` before adding prose anywhere in that set; measured at v0.8.7 (post-review fixes) it totals **110480** bytes.
- **An `@import` loads a rule unconditionally and VOIDS its `paths:` frontmatter.** Observed live in the session that wrote `prompt-standard.md`: `hooks.md` arrived in full at session start, before any file under `plugins/ccf/hooks/**` was read. The docs describe the two mechanisms separately and never say how they combine, so this observation is the ruling. Consequences: `.claude/rules/hooks.md` (~37.8KB) DOES load every session despite carrying `paths:`, and the only way to make that scope real is to delete its `@import` line below, not to add more `paths:` patterns. The one genuinely lazy rule is `.claude/rules/prompt-standard.md` (14196 bytes) — it carries `paths:`, is deliberately NOT `@import`ed, and is reachable by PATH from `.claude/rules/coding-conventions.md`, so it costs 0 per session. Real per-session cost today: **96284** bytes (110480 minus that one lazy file). The figure 58524 is only what the total would be if `hooks.md`'s `paths:` worked; do not quote it as what a session pays.

## Rules (imported — keep this file < 200 lines)
@.claude/rules/architecture.md
@.claude/rules/components.md
@.claude/rules/hooks.md
@.claude/rules/coding-conventions.md
@.claude/rules/testing.md
@.claude/rules/tooling.md
@.claude/rules/git-workflow.md

## Current plan
Live queue: `.claude/plan/PLAN.md` — the CURRENT iteration only. Closed history + postmortems: `.claude/plan/ARCHIVE.md`, with their task files in `.claude/plan/archive/`. Those two files are the premortem anchor source; read them together. Do NOT let a closed row sit in `PLAN.md` — `lib/plan.mjs` counts it as live work.

**Live iteration as of v0.8.7: prompt-standard, tasks 045 to 048 — all four sit at `in-review`, none is `done`.** It rewrote all 13 plugin prompts (6 commands, 6 agents, 1 skill) onto a written standard, added `.claude/rules/prompt-standard.md` (the 14-point checklist, the canonical user-facing style block, the codepoint policy, the `FAIL:`/`WARN:`/`PASS:` marker vocabulary), and replaced every icon review marker with a word marker on both the producing and the reading side. Measured, not assumed: 227 `node --test` pass, 8 template-lib tests pass, `tsc` exit 0, `claude plugin validate` passed, the style block byte-identical across 9 prompts plus the rule (md5 `deac0ef73d3c0cb9d26766027a906385`, 1479 bytes, measured with `sed -n "<start>,<start+12>p" <file> | md5`), and 0 blocked codepoints outside the one recorded exemption.

**Why none of 045 to 048 is `done`: the live checks in each task's Acceptance have not run.** The plugin executes from its installed CACHE copy, not this repo, so a rewritten prompt is inert until the plugin is reinstalled and a fresh session starts. Still owed: `/ccf:plan` through steps 0 to 6 (045), one `/ccf:check` pass (046), `/ccf:fix` as far as the model question and `/ccf:init` as far as A4 (047). **`cook.md` is the weakest link** — no `/ccf:cook` has ever run against the rewritten file, and the user accepted that gap explicitly, because observing it means executing a whole backlog.

**Deliberate drift, owed to the NEXT iteration**: `plugins/ccf/templates/**/*.tmpl` was NOT brought onto the prompt standard. Templates are the mold for another project's spec, so a project generated today still inherits the old wording and the old marker vocabulary. Tasks 045 to 048 scoped themselves to the plugin's own 13 prompts rather than half-converting both surfaces; converting the templates is the first commitment of the next iteration.

**Read `ARCHIVE.md`'s "Residual risk carried forward from the bulk-closes" section before planning anything.** Two bulk-closes happened by explicit user command, so a `done` row in the archive does NOT imply its gate was observed. Still **UN-OBSERVED** from there: the `SubagentStop` payload shape, the real `agent_type` in a `SubagentStart` payload, the post-reload `/compact` wording, all FOUR opt-in toggles (`--hard-block`, `--auto-verify`, `--enforce-tests`, `--dual-channel-stop` — none has been seen running; all stay OFF in the shipped `hooks.json`), and every part of task 044.

**Deferred but already grounded**: task 042, an ack-vs-finished detector for a background spawn. A background-spawned agent returns an instant `"Async agent launched successfully."` ack instead of its report, and `is_error` is `undefined` in every observed case, so it cannot serve as a done-ness signal. Buildable; deliberately not built yet.

**Standing debt**: `.claude/rules/hooks.md` at ~37.8KB is the largest per-session cost, and the proposal to split it by event is still open. Note the `@import` finding above before "fixing" it with `paths:`: that frontmatter buys nothing while the import line stays.

**Task-status lifecycle**: `todo → in-progress → in-review → done`. `ccf-implementer` reaches `in-review`; only `/ccf:updatespec` writes `done`, after `/ccf:check` + `/code-review` pass. Counts: **6 cmd / 6 agent / 9 hook / 1 skill / 1 script** — the real files under `commands/`, `agents/`, `hooks/`, `skills/`, `scripts/` are the source of truth.

**Archive retirement is now deterministic-detected, human-applied.** `scripts/archive-plan.mjs` performs the retirement (`--apply`; default previews); `updatespec-nudge` clause D detects a fully-closed iteration and prints the command. `lib/archive.mjs` holds the shared decision, grouping iterations **by position** (`## Origin` to the next `## Origin`) because their section headings do not share a name.

When you need a new change, enter plan mode and run `/ccf:plan`; execute one task at a time in a fresh session via `ccf-implementer`, and gate GREEN before the next.
