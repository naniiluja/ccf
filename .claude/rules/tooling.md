---
description: Tools and MCP used in / for developing the CCF plugin — with "when to use".
---

# Tooling

## Plugin-bundled MCP servers (`plugins/ccf/.mcp.json`)
Two remote HTTP servers, auto started/stopped by Claude Code at plugin scope:
- **context7** (`https://mcp.context7.com/mcp`) — **use when**: you need to look up the schema/contract/syntax of Claude Code, a library, framework, or CLI. Flow: `resolve-library-id` → `query-docs`. Runs without an API key (free rate limit); if rate-limited, set env `CONTEXT7_API_KEY` (free at context7.com/dashboard) and restart Claude Code.
- **microsoft-learn** (`https://learn.microsoft.com/api/mcp`) — **use when**: you need Microsoft/Azure/.NET platform guidance. No auth. Tools: `microsoft_docs_search` (breadth) → `microsoft_code_sample_search` (examples) → `microsoft_docs_fetch` (depth).

> Grounding is a CCF law: before writing a spec/decision about Claude Code's schema or a library, consult the official docs and CITE them, don't rely on memory.

> **shadcn MCP is intentionally NOT bundled here.** The official shadcn server (`npx shadcn@latest mcp`) is **stdio + project-scoped** (it reads the target project's `components.json`), so bundling it at CCF's plugin scope would make it run — and error — in every non-React project. Instead `/ccf:init` writes it into the **target React project's own `.mcp.json`** when the user picks shadcn (same pattern as the Supabase/Railway hosting MCP). Keep this file's count at **2 bundled servers**.

## Grounding subagent
- `ccf-best-practice-researcher` — **use when**: you want to fan out best-practice lookups into a separate context so they don't flood the main conversation. It calls Context7/MS Learn and returns a cited recommendation.

## Internal skill
- `grill-me` (`plugins/ccf/skills/grill-me/SKILL.md`) — **use when**: a command (`/ccf:plan`/`/ccf:fix`/`/ccf:init`) needs to interview the user before acting. **How to call**: invoke via the Skill tool, passing the mode (`plan`/`fix`/`init`) as the argument; it runs the one-question-at-a-time interview and returns a summary. Internal (`user-invocable: false`) — not for direct user invocation; model-invocation stays enabled so commands can call it.

## Plugin development tools
- **Node ≥ 18** — runs the hooks and `bin/ccf-bootstrap.mjs`.
- **`tsc`** — type-checks JS via `tsconfig.json`. **Use when**: you just edited any `.mjs`. Run `npm install` (once) then **`npx -p typescript tsc --noEmit`** (bare `npx tsc` grabs an unrelated squat package since `typescript` isn't a devDependency). Needs `@types/node` (already in `devDependencies`) because `tsconfig` sets `"types": ["node"]` — this is a type-check devDependency, not a runtime dep.
- **`claude plugin` CLI** — `marketplace add` / `install`. **Use when**: installing locally or in `bin/ccf-bootstrap.mjs`.

## CCF self-checks (internal commands)
- `/ccf:check` — verify the implementation against this spec (conformance, conventions, SOLID, cross-check).
- `/ccf:updatespec` — refresh the spec after a session; **also records new tools with "when to use"** into this very file.
- `/ccf:cook` — **use when**: you want to run the WHOLE todo/in-progress backlog in one go instead of a fresh session per task — sequential `ccf-implementer` loop (stop on any red gate) then a batch-verify pass (review + `/code-review` in parallel, `/simplify`, re-gate, `/ccf:updatespec`). **Mutually exclusive with `auto-verify.mjs --auto-verify`** — `/ccf:cook` drives the same verify chain itself; don't enable both. NOTE: the contract-level test matrix (EP+BVA+decision-table) is written by `ccf-implementer` during implement (part of its failing-test-first flow), NOT a separate command.

## Harness-supplied review/cleanup skills (observed, NOT CCF-shipped)
Availability and SCOPE vary by harness — verify before relying on one, and never treat a missing one as a skipped CCF gate.
- **`simplify`** — **use when**: the verify chain reaches `/ccf:cook` step 4 and you want quality cleanups (reuse, simplification, efficiency, altitude) on the working diff. **How to call**: Skill tool, no argument; it fans out 4 review angles then you apply the fixes. It WRITES files, so run it alone, after every read-only reviewer has finished. **Observed working** (cc-2.1.220-realign): its altitude angle correctly identified that a helper had been placed in the wrong domain module, and its efficiency angle measured a real 5x test-suite slowdown.
- **`review`** — **use when**: reviewing a GitHub **pull request**. **How to call**: Skill tool with a PR number/branch. **Observed limitation (cc-2.1.220-realign):** on this harness it accepts ONLY a pull request and gathers its diff via `gh pr view`/`gh pr diff` — it CANNOT review an uncommitted working diff. So `/code-review` on a working tree may be UNAVAILABLE: when it is, say so explicitly and ask the user to run it by hand (`cook.md` step 6 fallback), and do NOT mark any task `done` on the strength of `ccf-spec-checker` alone. See [[slashcommand-tool-not-always-exposed]] — same class of harness variance.

## Session task list (harness-supplied, not CCF-shipped)
- **`TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`** — **use when**: a run has three or more distinct steps, or the user handed over a list of items, or progress needs to be visible while a long loop executes. In CCF that is `/ccf:cook` over a backlog (see `cook.md` step 1b), which matches every one of those triggers at once. **How to call**: `TaskCreate {subject, description, activeForm?}` (every task is born `pending`); `TaskUpdate {taskId, status}` walking `pending → in_progress → completed` (`deleted` removes one), plus `addBlockedBy`/`addBlocks` for dependency edges and `owner` to claim; `TaskList` to enumerate `id`/`subject`/`status`/`owner`/`blockedBy`. Schemas may be deferred — load them with `ToolSearch` before the first call.
  - **`TodoWrite` is the OLD tool and is disabled by default.** Since Claude Code v2.1.142 (TS Agent SDK 0.3.142) sessions use the structured `Task*` tools instead; `TodoWrite` returns only under `CLAUDE_CODE_ENABLE_TASKS=0`. Never write `TodoWrite` into a CCF prompt.
  - **NOT the `Task` spawn tool.** `Task` (a.k.a. `Agent`) spawns a subagent; `TaskCreate`/`TaskUpdate`/`TaskList` manage a checklist. The shared prefix is a naming collision, nothing more — do not reason from one to the other.
  - **Ephemeral, and therefore never a replacement for `PLAN.md`.** The list is scoped to the current coding session, so it cannot carry status across sessions. `.claude/plan/PLAN.md` stays the source of truth, and the two lifecycles are deliberately different (`completed` in the list vs `in-review` in `PLAN.md`) — only `/ccf:updatespec` writes `done`.
  - **Availability is not guaranteed** — treat a missing `Task*` tool exactly like a missing `/code-review`: say so explicitly and carry on from `PLAN.md`, never silently skip the tracking and imply it happened.
  - **Untested against an agent denylist**: all 6 CCF agents declare `disallowedTools: Agent, Task`. Whether that exact-match string also blocks `TaskCreate` has NOT been observed. It does not matter today because only the main-loop command `cook.md` uses these tools — do not add them to an agent on the assumption that it works.

## Optional official Claude Code commands (runtime, not CCF-shipped)
These are official Claude Code slash commands, NOT part of CCF's artifact count (no command/agent/hook/skill added) — they may be ABSENT on an older Claude Code build, so treat them as optional enhancements, never a required step.
- **/advisor** — **use when**: you want a DIFFERENT model to sanity-check a plan (`plan.md` step 6) or an implementation (`check.md` closing) alongside the mandatory same-model `ccf-spec-checker` review. **How to call**: `/advisor sonnet` or `/advisor fable` (also accepts `opus`, a specific model ID, or no argument to open a picker); the choice persists in user settings. It is a SUPPLEMENT — it never replaces the mandatory `ccf-spec-checker` gate (`plan-review-gate` hook still enforces that gate deterministically).
- **/goal** — **use when**: running `/ccf:cook` over a backlog and you want the session to keep working autonomously until a condition holds (e.g. "all selected tasks are in-review"), instead of re-prompting after every turn. **How to call**: `/goal <condition>` (a fast model checks the condition after each turn; `/goal clear` — or aliases `stop`/`off`/`reset`/`none`/`cancel` — removes it). It is a SECONDARY convenience only — it never replaces `/ccf:cook`'s stop-on-red-gate law (a RED gate still stops the loop immediately).
  - **Observed behavior (cc-2.1.220-realign), state it when advising a user:** the Stop hook re-blocks on EVERY stop until the condition holds, and its checker reads the literal condition. A condition naming a whole command (`/goal /ccf:cook`) is therefore only satisfied when that command's LAST step completes — so an externally blocked step (denied permission, an unavailable `/code-review`) makes the goal unsatisfiable and the session loops on advisory text without progressing. When that happens: say plainly that the condition cannot be met, name the exact blocker, stop taking action, and tell the user to run `/goal clear` or remove the blocker. Prefer phrasing a goal as an OBSERVABLE END STATE ("all selected tasks are in-review") over a command name.

## Convention for adding a new tool
When integrating a new tool/MCP, add an entry here in the format "**name** — when to use — how to call", and update the `allowed-tools` of the related COMMANDS (main-loop scope, least-privilege). Do NOT add it to an agent `tools` list: subagents have NO `tools` allowlist — they reach project-arbitrary MCP by INHERITANCE (writer uses `disallowedTools: Agent, Task` → inherit-all-minus-spawn; the 5 read-only agents use `disallowedTools: Write, Edit, NotebookEdit, Agent, Task`), so a newly added project MCP is automatically available to them with no per-agent edit. An inherited MCP tool may be lazily loaded — load its schema with `ToolSearch` before calling it (a blind call fails with InputValidationError).
