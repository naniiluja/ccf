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
  - `templates/{root,backend,frontend}/**` — `*.tmpl` files with `{{...}}` placeholders for `/ccf:init` to instantiate.
  - `.mcp.json` — bundles 2 remote MCP servers (microsoft-learn, context7).
- `bin/ccf-bootstrap.mjs` — the npx entry; only shells out to the `claude plugin` CLI, writes no files itself.

## Core invariants (read before editing)
- Hooks are **no-build, no-dependency, Windows-clean** `.mjs` run directly with `node` (Node ≥ 18). Do NOT add a dependency, do NOT add a build step. See `@.claude/rules/hooks.md`.
- Components (command/agent/template) are **markdown prompts**, not executable code. Editing the content = changing Claude's behavior. See `@.claude/rules/components.md`.
- `${CLAUDE_PLUGIN_ROOT}` only expands in `hooks[].command` and `mcpServers` — NOT in markdown frontmatter.
- Every `CLAUDE.md` (including ones CCF generates for other projects) must be **< 200 lines AND < 12KB, whichever binds first**, pushing detail into `.claude/rules/*` via `@import` (max depth 5). **Measure both, because a line count alone is gameable:** this file passed "< 200 lines" at 38 lines while weighing 25KB, since a single `## Current plan` paragraph had grown to 21KB on one line. Official guidance calls `CLAUDE.md` a cheat sheet of about two screens, not documentation; 200 lines of readable prose lands near 12KB, so a file over that is documentation no matter how few newlines it contains. Check with `wc -lc CLAUDE.md`, not by eye.
- **Everything `CLAUDE.md` `@import`s is loaded EVERY session — budget it as one total.** Run `wc -c CLAUDE.md .claude/rules/*.md` before adding prose anywhere in that set. Known outlier as of v0.8.2: `.claude/rules/hooks.md` at ~36KB is the single largest per-session cost and is a candidate for `paths:`-scoping or splitting; do not grow it further without moving something out.

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

Lead iteration **cc-2.1.220-realign** (v0.8.0), tasks 036–041. **036 + 037 are `done`**; **038–041 stay `in-review`**, each blocked on an UNOBSERVED capture, not on missing code. Two releases shipped on top. **v0.8.1**: `context-usage.mjs#modelWindowSize` now reads the `fable`/`mythos` families and a bare family alias as a 1M window, fixing a premature `/compact` nag. **v0.8.2**: closed iterations retired out of `PLAN.md` into `.claude/plan/ARCHIVE.md`, this section cut from 21,056 to ~2,300 bytes, a bytes gate added beside the line gate, `TaskCreate`/`TaskUpdate`/`TaskList` wired into `cook.md` step 1b, and `plan.mjs#stripEmphasis` fixed a real misread where a `**done**` status cell counted as unfinished work.

**Outstanding observation gates** — the reason 038–041 are not `done`. None is waivable by reading code; each needs a real payload captured from a reloaded plugin:
- the real `SubagentStop` payload. Both failure directions are live: an absent `stop_hook_active` blocks forever, a `true` one on the first stop never blocks at all.
- the real `agent_type` inside a `SubagentStart` payload.
- the post-reload `/compact` hint wording.
- all FOUR opt-in toggles (`--hard-block`, `--auto-verify`, `--enforce-tests`, `--dual-channel-stop`). Not one has EVER been seen running.

**All four toggles stay OFF in the shipped `hooks.json`.** After any observation, revert `hooks.json` — it is a released file.

**Deferred but already grounded**: task 042, an ack-vs-finished detector for a background spawn. A background-spawned agent returns an instant `"Async agent launched successfully."` ack instead of its report, and `is_error` is `undefined` in every observed case, so it cannot serve as a done-ness signal. Buildable; deliberately not built yet.

**Task-status lifecycle**: `todo → in-progress → in-review → done`. `ccf-implementer` reaches `in-review`; only `/ccf:updatespec` writes `done`, after `/ccf:check` + `/code-review` pass. Counts: **6 cmd / 6 agent / 9 hook / 1 skill** — the real files under `commands/`, `agents/`, `hooks/`, `skills/` are the source of truth.

When you need a new change, enter plan mode and run `/ccf:plan`; execute one task at a time in a fresh session via `ccf-implementer`, and gate GREEN before the next.
