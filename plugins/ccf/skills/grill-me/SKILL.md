---
name: grill-me
description: Internal CCF requirements-interview engine. Invoked ONLY by the CCF commands ccf-plan, ccf-fix and ccf-init (via the Skill tool, passing a mode argument) to interrogate the user one question at a time and gather the context those commands need. Not a standalone command — do not trigger it from ordinary conversation.
user-invocable: false
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(git log:*), Bash(git branch:*), Bash(git status:*)
---

# grill-me — CCF requirements interview engine

A CCF command invoked you through the Skill tool. `$ARGUMENTS` carries the **mode** that selects which topics to cover:

- `plan` — interrogate one feature/change before writing a sequential plan.
- `fix` — reconstruct a bug before debugging.
- `init` — elicit project decisions before bootstrapping CCF.

Run a focused interview using the discipline below, then hand a concise **summary of the answers** back to the calling command so it can continue.

## Interview discipline (every mode)

- **One question at a time.** Never batch. Ask, wait for the answer, and let that answer shape the next question.
- **Explore before you ask.** Before each question, try to answer it yourself from the codebase (Read / Glob / Grep). Only ask what the code cannot tell you; for what it can, confirm instead of asking blind ("I see `X` wired in `foo.ts:42` — still correct?").
- **Recommend with every question.** Offer your recommended answer plus a one-line rationale so the user can simply confirm. If the user defers, proceed with your recommendation.
- **Stop when you have enough** to act. Do not interrogate past the point of diminishing returns.
- **Summarize at the end.** Give a short, structured recap of the decisions, ready for the command to fold into its next step.

## Mode dispatch (`$ARGUMENTS`)

### `plan`
Probe, in order, only the points that are still unclear after exploring the code:
1. **Acceptance criteria** — what observable behavior means "done"?
2. **Edge cases** — boundary inputs, empty/null, concurrency, limits.
3. **Data shape** — inputs/outputs, types, persistence, schema touched.
4. **Failure modes** — what can go wrong, and the expected handling.
5. **Test cases** — the concrete cases that must be green (the failing test comes first).

### `fix`
Reconstruct the bug, probing only what you cannot already determine from the code/logs:
1. **Exact symptom** — observed vs expected behavior.
2. **Triggering input** — the input or action that provokes it.
3. **Environment** — OS, runtime, prod/dev, version.
4. **Frequency** — always or intermittent.
5. **Error message / stack trace** — the verbatim text, if any.
6. **Last known-good state** — is this a regression? what changed since?
7. **Reproduction steps** — the minimal sequence that makes it happen.

### `init`
Walk this decision tree to elicit project decisions; recommend an answer for each, and prefer confirming what the repo + `git log` / `git branch` already reveal over asking blind:
- (a) What system + the core problem?
- (b) Acceptable budget/cost?
- (c) App type: REST API / frontend / backend / fullstack?
- (d) Expected user scale? → based on scale, propose hosting (e.g. Supabase or Railway) and tell the user to install the corresponding MCP (`/plugin install ...`).
- (e) Design patterns for FE & BE? **If there is a frontend, recommend React + Tailwind CSS + shadcn/ui by default** (stable, mainstream, well-supported, and has an MCP that lets Claude browse/install components) — one-line rationale, user free to choose otherwise. When chosen, tell the user that `/ccf-init` will add the shadcn MCP to THIS project's `.mcp.json` (`{"command":"npx","args":["shadcn@latest","mcp"]}`); after `shadcn init` (which creates `components.json`) they restart Claude Code and run `/mcp` to confirm it shows `Connected`.
- (e2) **Design source (only if there is a frontend):** ask whether the user has a Claude Design handoff bundle (a URL like `https://api.anthropic.com/v1/design/h/...`). If yes → record the URL so the FE spec can follow it as the visual source of truth. If no → suggest creating one in Claude Design for a more polished UI (it exports HTML/React + a design spec to hand to Claude Code); default to none if they decline. Do NOT try to fetch the URL (it is authenticated).
- (f) AI-traceable logging system (structured logs, correlation ID, consistent prefixes)?
- (g) Database?
- (h) Coding conventions?
- (i) Testing strategy? Probe one sub-question at a time (recommend a default + one-line rationale each): **test framework / run command / test location / coverage target** (as today), THEN **"Adopt the test-design discipline — a contract-level EP/BVA/decision-table matrix on each public signature (recommended: yes; catches edge/boundary bugs early, kept at the contract level so tests stay robust)?"**, THEN (only if yes) **"Enforcement — prompt-only (the spec asks for it) or a Stop-hook gate (recommended: prompt-only to start; a stop-hook can `exit 2`-block a session that edited code with no matrix test, stronger but noisier)?"**. ASK ONLY: report the answers in the summary; `ccf-init` does the template fill — grill-me has no write tool.
- (j) Tech stack — must be the most stable, best-supported, least-buggy (mainstream); for each library pick the most popular/well-maintained option.
- (k) Monorepo rule: work in the root folder; if fullstack create `be/` + `fe/`; git init at the root, NOT in sub-folders; the root holds CLAUDE.md, `.claude/`, docker, CI/CD.
- (l) Git conventions: first check whether the repo already has commits (read-only `git log` / `git branch -a`). If a pattern exists, infer the commit/branch convention from it (don't invent). If history is empty or too thin, ask the user (or default to conventional commits: `feat:`/`fix:`/`refactor:`…). This fills `git-workflow.md`'s `{{COMMIT_CONVENTION}}` / `{{BRANCH_NAMING}}` / `{{PR_RULES}}`.

### Unrecognized / empty mode
If `$ARGUMENTS` does not name a known mode, run a general requirements interview under the discipline above, inferring the topics from the calling command's context.
