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
  - `commands/*.md` — 5 slash commands (`init`, `plan`, `check`, `updatespec`, `cook`; invoked via the plugin namespace, e.g. `/ccf:plan`).
  - `agents/*.md` — 4 subagents, ALL read-only (`ccf-codebase-analyzer`, `ccf-best-practice-researcher`, `ccf-spec-writer`, `ccf-spec-checker`). There is no writer agent: every task is implemented directly in the main session, never by a spawned coding subagent.
  - `skills/grill-me/SKILL.md` — 1 internal skill: the shared requirements-interview engine invoked by `/ccf:plan`/`/ccf:init` (`user-invocable: false`; hidden from the `/` menu).
  - `hooks/*.mjs` + `hooks/hooks.json` + `hooks/lib/` — 6 hooks (plan-mode-guard, session-start, updatespec-nudge — advisory Stop nudges, auto-verify — an opt-in `--auto-verify` Stop hook that BLOCKS via `decision:"block"` to drive a single verify step (`/ccf:check` then `/ccf:updatespec`) when a task is in-review and code changed this session, context-guard — warns/optionally hard-blocks on `UserPromptSubmit` when context enters the degrade zone, and explore-guide-inject, which on `SubagentStart` (matcher `Explore`) injects a language-agnostic LSP/Grep/Glob exploration directive into the built-in `Explore` subagent) sharing `lib/io.mjs` (+ `lib/freshness.mjs`, `lib/plan.mjs`, `lib/context-usage.mjs`, `lib/review-trace.mjs`, `lib/git-trace.mjs`, `lib/verify-trace.mjs`, `lib/verify-chain.mjs`, `lib/explore-guide.mjs`, `lib/archive.mjs`).
  - `scripts/archive-plan.mjs` — 1 human-run CLI (not a hook, not a command; nothing invokes it automatically). Retires a fully-closed iteration out of `PLAN.md` into `ARCHIVE.md`. File-MUTATING actions belong here, never in a hook — see `@.claude/rules/architecture.md`.
  - `templates/{root,backend,frontend}/**` — `*.tmpl` files with `{{...}}` placeholders for `/ccf:init` to instantiate.
  - `.mcp.json` — bundles 2 remote MCP servers (microsoft-learn, context7).
- `bin/ccf-bootstrap.mjs` — the npx entry; only shells out to the `claude plugin` CLI, writes no files itself.

## Core invariants (read before editing)
- Hooks are **no-build, no-dependency, Windows-clean** `.mjs` run directly with `node` (Node ≥ 18). Do NOT add a dependency, do NOT add a build step. See `@.claude/rules/hooks.md`.
- Components (command/agent/template) are **markdown prompts**, not executable code. Editing the content = changing Claude's behavior. See `@.claude/rules/components.md`.
- `${CLAUDE_PLUGIN_ROOT}` only expands in `hooks[].command` and `mcpServers` — NOT in markdown frontmatter.
- Every `CLAUDE.md` (including ones CCF generates for other projects) must be **< 200 lines AND < 12KB, whichever binds first**, pushing detail into `.claude/rules/*` via `@import` (max depth 5). **Measure both, because a line count alone is gameable:** this file passed "< 200 lines" at 38 lines while weighing 25KB, since a single `## Current plan` paragraph had grown to 21KB on one line. Official guidance calls `CLAUDE.md` a cheat sheet of about two screens, not documentation; 200 lines of readable prose lands near 12KB, so a file over that is documentation no matter how few newlines it contains. Check with `wc -lc CLAUDE.md`, not by eye.
- **Everything `CLAUDE.md` `@import`s is loaded EVERY session — budget it as one total.** Run `wc -c CLAUDE.md .claude/rules/*.md` before adding prose anywhere in that set, and again as the LAST step of any task that touches it (a number written here and not re-measured has drifted before — four times in a row for this same figure). The verified paid total is no longer restated here; it lives in `.claude/rules/prompt-standard.md`'s machine-readable `<!-- ccf-budget: paid=NNNNN -->` label, which `.claude/tests/context-budget.test.mjs` asserts against a real measurement on every run.
- **An `@import` loads a rule unconditionally and VOIDS its `paths:` frontmatter.** Observed live in the session that wrote `prompt-standard.md`: `hooks.md` arrived in full at session start, before any file under `plugins/ccf/hooks/**` was read. The docs describe the two mechanisms separately and never say how they combine, so this observation is the ruling. Consequences: `.claude/rules/hooks.md` DOES load every session despite carrying `paths:`, and the only way to make that scope real is to delete its `@import` line below, not to add more `paths:` patterns. The one genuinely lazy rule is `.claude/rules/prompt-standard.md` — it carries `paths:`, is deliberately NOT `@import`ed, and is reachable by PATH from `.claude/rules/coding-conventions.md`, so it costs 0 per session; see the `ccf-budget` label in `.claude/rules/prompt-standard.md` (referenced by path in the bullet above, not restated here) for the exact paid figure.

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

**No live iteration as of 2026-08-02 — `PLAN.md` holds only the preamble; the next change starts with plan mode + `/ccf:plan`.** The last two iterations closed back-to-back and sit in `ARCHIVE.md`: **latch-hardening (049+050)** closed with EVERY gate observed (the first no-bulk-close iteration — PR #2/#3, three spec-review rounds to CLEAN, the first live `/ccf:cook`, and the `ccf-budget` latch that went RED for real three times and was refilled last each time), and **prompt-standard (045-048)** closed by BULK-CLOSE #3 (explicit user command; accepted-missing gates recorded by name in `ARCHIVE.md`'s residual-risk section — `/code-review` never ran on its straight-to-main diff, and 047's narrow init/fix checks never ran).

**Standing machine latches now guarding this repo:** `.claude/tests/context-budget.test.mjs` (the paid-context label — `updatespec.md`'s Closing re-measures it after every spec edit), the `FAIL:` marker asserts in `verify-chain.test.mjs`, and the `PLAN.md.tmpl` preamble latch in `archive.test.mjs` (verified RED on a bug reproduction before being trusted — `testing.md`'s "a latch never seen RED proves nothing" lesson).

**Read `ARCHIVE.md`'s "Residual risk carried forward from the bulk-closes" section before planning anything.** Two bulk-closes happened by explicit user command, so a `done` row in the archive does NOT imply its gate was observed. Still **UN-OBSERVED** from there: the real `agent_type` in a `SubagentStart` payload, the post-reload `/compact` wording, all THREE remaining opt-in toggles (`--hard-block`, `--auto-verify`, `--dual-channel-stop` — none has been seen running; all stay OFF in the shipped `hooks.json`), and every part of task 044. (`--enforce-tests`'s `SubagentStop` payload-shape question is now moot: the hook it gated, `implementer-verify-gate.mjs`, was retired along with `ccf-implementer` — see the architecture note below.)

**Architecture simplification (this session, coding-subagent + multi-step-verify retirement, done directly by explicit user command, no `/ccf:plan` ceremony):** retired the writer agent `ccf-implementer` and the debugging command `/ccf:fix` + its agent `ccf-debugger`. Reason: a spawned coding subagent means waiting on a separate context to boot, read the task and hand a result back, which is measurably slower than writing the code directly in the main session with the plan and codebase already loaded — every CCF agent is now read-only (discovery, review, best-practice grounding only). Also collapsed the multi-step verify chain: `/ccf:plan` and `/ccf:init` no longer run a mandatory plan-time `ccf-spec-checker` premortem-review loop before presenting the plan, and `/ccf:cook`'s batch-verify phase no longer chains `ccf-spec-checker` + `/code-review` + `/simplify` + re-gate; a single `/ccf:check` now stands between implementing and `/ccf:updatespec` marking a task `done`. `/code-review` remains a good optional extra, never a mandatory gate. Every prompt/hook/template/rule file referencing the retired pieces was swept and updated in the same pass; see `git log` for the exact diff.

**Deferred but already grounded**: task 042, an ack-vs-finished detector for a background spawn. A background-spawned agent returns an instant `"Async agent launched successfully."` ack instead of its report, and `is_error` is `undefined` in every observed case, so it cannot serve as a done-ness signal. Buildable; deliberately not built yet.

**Standing debt**: `.claude/rules/hooks.md` at ~38.5KB (measured 2026-08-10) is the largest per-session cost, and the proposal to split it by event is still open. Note the `@import` finding above before "fixing" it with `paths:`: that frontmatter buys nothing while the import line stays.

**Task-status lifecycle**: `todo → in-progress → in-review → done`. A task implemented directly in the main session reaches `in-review`; only `/ccf:updatespec` writes `done`, after `/ccf:check` passes. Counts: **5 cmd / 4 agent (all read-only) / 6 hook / 1 skill / 1 script** — the real files under `commands/`, `agents/`, `hooks/`, `skills/`, `scripts/` are the source of truth.

**Archive retirement is now deterministic-detected, human-applied.** `scripts/archive-plan.mjs` performs the retirement (`--apply`; default previews); `updatespec-nudge` clause D detects a fully-closed iteration and prints the command. `lib/archive.mjs` holds the shared decision, grouping iterations **by position** (`## Origin` to the next `## Origin`) because their section headings do not share a name.

When you need a new change, enter plan mode and run `/ccf:plan`; execute one task at a time directly in the session (never a spawned coding subagent), and gate GREEN before the next.
