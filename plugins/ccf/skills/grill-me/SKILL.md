---
name: grill-me
description: Internal requirements-interview engine for the CCF commands plan and init. Invoked only by those commands through the Skill tool with a mode argument (plan / init); it interrogates the user one question at a time, exploring the code to self-answer first, and returns a summary of the decisions. Not a standalone command, and never triggered from ordinary conversation.
user-invocable: false
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(git log:*), Bash(git branch:*), Bash(git status:*)
---

# grill-me — CCF requirements interview engine

A CCF command invoked you through the Skill tool. `$ARGUMENTS` carries the **mode** that selects which topics to cover:

- `plan` — interrogate one feature/change before writing a sequential plan.
- `init` — elicit project decisions before bootstrapping CCF.

Run a focused interview under the discipline below, then hand a concise **summary of the answers** back to the calling command so it can continue.

## Interview discipline (every mode)

1. **One question at a time.** Ask, wait for the answer, and let that answer shape the next question. A batch of questions gets a batch of shallow answers, and it forfeits the chance to follow up on the one that mattered.
2. **Explore before you ask.** Before each question, try to answer it yourself from the codebase (Read / Glob / Grep). Ask only what the code cannot tell you; for what it can, confirm instead of asking blind.
3. **Recommend with every question.** Offer your recommended answer plus a one-line rationale, so the user can simply confirm. If the user defers, proceed with your recommendation and say which one you took.
4. **Stop when you have enough** to act. Past the point of diminishing returns, more questions cost the user's patience and buy nothing.
5. **Summarize at the end.** Give a short, structured recap of the decisions, ready for the command to fold into its next step.

<example>
Confirming (correct, because the code already answered it):
"I see the tests run with `npm test` and that `foo.ts:42` is the only caller of `parseRange` — still correct?"

Asking blind (wrong, the answer was one Grep away):
"How do you run the tests, and who calls `parseRange`?"

Asking a genuine unknown (correct, no artifact records the intent):
"When two writers hit the same row, should the second one overwrite or fail loudly? I recommend fail loudly, so a lost update never happens silently."
</example>

## Mode dispatch (`$ARGUMENTS`)

### `plan`
Probe, in order, only the points still unclear after exploring the code:
1. **Acceptance criteria** — what observable behavior means "done"?
2. **Edge cases** — boundary inputs, empty/null, concurrency, limits.
3. **Data shape** — inputs/outputs, types, persistence, schema touched.
4. **Failure modes** — what can go wrong, and the expected handling.
5. **Test cases** — the concrete cases that must be green (the failing test comes first).

### `init`
Walk this decision tree to elicit project decisions. Recommend an answer for each, and prefer confirming what the repo plus `git log` / `git branch` already reveal over asking blind:
- (a) What system + the core problem?
- (b) Acceptable budget/cost?
- (c) App type: REST API / frontend / backend / fullstack?
- (d) Expected user scale? Based on scale, propose hosting (e.g. Supabase or Railway) and tell the user to install the corresponding MCP (`/plugin install ...`).
- (e) Design patterns for FE & BE? **If there is a frontend, recommend React + Tailwind CSS + shadcn/ui by default** (stable, mainstream, well-supported, and it has an MCP that lets Claude browse/install components) with a one-line rationale; the user is free to choose otherwise. When chosen, tell the user that `/ccf:init` will add the shadcn MCP to THIS project's `.mcp.json` (`{"command":"npx","args":["shadcn@latest","mcp"]}`); after `shadcn init` creates `components.json` they restart Claude Code and run `/mcp` to confirm it shows `Connected`.
- (e2) **Design source (only if there is a frontend):** ask whether the user has a Claude Design handoff bundle (a URL like `https://api.anthropic.com/v1/design/h/...`). If yes, record the URL so the FE spec can follow it as the visual source of truth. If no, suggest creating one in Claude Design for a more polished UI (it exports HTML/React plus a design spec to hand to Claude Code), and default to none if they decline. Do not fetch the URL, which is authenticated.
- (f) AI-traceable logging system (structured logs, correlation ID, consistent prefixes)?
- (g) Database?
- (h) Coding conventions?
- (i) Testing strategy? Probe one sub-question at a time, each with a recommended default and a one-line rationale: **test framework / run command / test location / coverage target**, then **"Adopt the test-design discipline, a contract-level EP/BVA/decision-table matrix on each public signature (recommended: yes; it catches edge and boundary bugs early, and kept at the contract level the tests stay robust)?"**, then, only if yes, **"Enforcement: prompt-only (the spec asks for it) or a Stop-hook gate (recommended: prompt-only to start; a stop-hook can `exit 2`-block a session that edited code with no matrix test, which is stronger but noisier)?"**. Ask only, and report the answers in the summary: `/ccf:init` does the template fill, since grill-me has no write tool.
- (j) Tech stack — must be the most stable, best-supported, least-buggy option (mainstream); for each library pick the most popular and well-maintained choice.
- (k) Monorepo rule: work in the root folder; if fullstack create `be/` + `fe/`; git init at the root, not in sub-folders; the root holds CLAUDE.md, `.claude/`, docker, CI/CD.
- (l) Git conventions: first check whether the repo already has commits (read-only `git log` / `git branch -a`). If a pattern exists, infer the commit/branch convention from it rather than inventing one. If history is empty or too thin, ask the user, or default to conventional commits (`feat:`/`fix:`/`refactor:`). This fills `git-workflow.md`'s `{{COMMIT_CONVENTION}}` / `{{BRANCH_NAMING}}` / `{{PR_RULES}}`.

### Unrecognized / empty mode
If `$ARGUMENTS` does not name a known mode, run a general requirements interview under the discipline above, inferring the topics from the calling command's context.
