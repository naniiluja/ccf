---
name: grill-me
description: Use when `/ccf:plan` or `/ccf:init` needs to interview the user before acting. Internal requirements-interview engine, invoked only by those two through the Skill tool with a mode argument (plan / init); it interrogates the user one question at a time, exploring the code to self-answer first, and returns a summary of the decisions. Not a standalone command, and never triggered from ordinary conversation.
user-invocable: false
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(git log:*), Bash(git branch:*), Bash(git status:*)
---

# grill-me — CCF requirements interview engine

A CCF command invoked you through the Skill tool. `$ARGUMENTS` carries the **mode** that selects which topics to cover:

- `plan` — interrogate one feature/change before writing a plan.
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
Read `references/init-mode.md` (relative to this skill's base directory) and walk it.

### Unrecognized / empty mode
If `$ARGUMENTS` does not name a known mode, run a general requirements interview under the discipline above, inferring the topics from the calling command's context.

## Gotchas

- A question asked outside this skill silently dies when the calling command's `allowed-tools` lacks `AskUserQuestion`, so keep the interview inside the skill, whose allowlist carries it (`.claude/rules/components.md`).
- Bundling several questions in one ask returns shallow answers and loses the follow-up that mattered (discipline 1 of this `SKILL.md`).
- This skill has no write tool: report the answers, and let `/ccf:init` fill the templates (item (i) of `references/init-mode.md`).
- A Claude Design handoff URL is authenticated, so record it and never fetch it (item (e2) of `references/init-mode.md`).
