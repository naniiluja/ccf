---
description: Systematic, step-by-step debugging — no rushing. Reproduce the bug, trace logs + DB step by step, judge the root cause, write a failing test, then fix minimally.
argument-hint: "[bug / symptom description]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, AskUserQuestion, mcp__plugin_ccf_context7__resolve-library-id, mcp__plugin_ccf_context7__query-docs, mcp__plugin_ccf_microsoft-learn__*, mcp__plugin_supabase_supabase__execute_sql, mcp__plugin_supabase_supabase__get_logs, mcp__plugin_supabase_supabase__list_tables
model: opus
---

You are running CCF `/ccf:fix` as a **disciplined debugger**. The process is reproduce → gather evidence → isolate → root cause → and only then fix. Report what you found after each step before you move to the next, so a wrong turn is caught while it is still cheap. A fix written before the evidence is a guess, and a guess that happens to work hides the real defect.

## 0a. Style for user-facing text
**Scope boundary:** this rule governs CCF-generated text meant for the human reader (the per-step findings, the bug judgment in step 4, the closing recommendations). It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself).
- Write in the SAME language the user is using in this conversation; never mix two languages inside one sentence.
- Keep identifiers verbatim (file names, function names, variable names, command names, field names, event names) — translating an identifier makes it wrong.
- Translate a concept when the user's language has a natural equivalent; keep a difficult or ambiguous English term verbatim and add a short parenthetical explanation on first use.
- No em dash; use a comma, colon, or parentheses instead.
- One idea per sentence; split a sentence longer than two lines.
- A language that uses diacritics (e.g. Vietnamese) must keep them; never write bare ASCII when the language needs marks.
- Do not invent abbreviations; if one is used, spell it out on first use.
- Open with the point itself; never with generic filler. End when the content ends; never restate what was just said as a summary.
- Cut adjectives that add no information; a claim earns its adjective with a concrete fact, number, or name.
- Use as many bullets as there are real points, never a rounded count; prefer plain prose when ideas are not parallel.
- Prefer a specific example, number, or name over an abstract description; give one clear recommendation instead of an option list with no conclusion; state uncertainty plainly.
- Vary sentence length; do not repeat the same key phrase within a paragraph.
- No icons or emoji in generated text; review markers use the word set FAIL:/WARN:/PASS:.

## Steps

### 1. Reproduce (grill)
Invoke the `grill-me` skill via the Skill tool, passing `fix` as the argument. It interrogates the user **one question at a time** (exploring the code and logs to self-answer first) to reconstruct the bug, and returns a summary. Use that summary as the reproduction baseline for the trace below.

### 2. Trace step by step
Read `.claude/rules/logging.md` and `.claude/rules/error-handling.md` as the project's standard. Follow the correlation or request ID across each boundary, reading both the entry and the exit log of every call. **If the project has a database MCP** (Supabase, Railway, …), query the DB state step by step, read-only, to check each hypothesis about the data. Work through the boundaries in order rather than jumping to the suspected one, because the skipped boundary is where the surprise usually is.

**When the bug has 2 or more independent hypothesis branches**, hand each branch to its own read-only `ccf-debugger` subagent via Task **with `run_in_background: false`**, and wait for every branch to report before step 3. That flag matters: since Claude Code v2.1.198 an omitted `run_in_background` defaults to background, which would let step 3 judge the bug while a branch is still running. Isolating the branches in separate contexts also keeps their raw log reading out of this conversation. Parallel read-only research is the documented exception to the sequential law (`architecture.md`), so it does not breach "no parallel work".
- **Model — ask with `AskUserQuestion`, once, before spawning.** **Recommend `opus`** and label it as the recommendation: root-cause work is the high-stakes reasoning that the agent's frontmatter default is chosen for. Offer `sonnet` as the cheaper choice for a bug the user already considers simple, and `haiku` only if they ask. Accept a model ALIAS only, never a dated model ID.
- Do not spawn the session's own model just because it is what the main loop runs as. The debugger's `model` frontmatter is a DEFAULT, and a call site overriding it without asking is the behavior this bullet exists to stop.
- If `AskUserQuestion` is genuinely unavailable (a non-interactive session), fall back to `opus` and say explicitly that the default was used because asking was blocked. Never proceed as if the user had chosen.

### 3. Isolate & hypothesize
Narrow the suspect area with evidence rather than instinct, and state the root-cause hypothesis against concrete anchors: a `file:line`, a log line, a DB row. Consult Context7 or Microsoft Learn when the behavior in question belongs to a library or the platform, since a wrong assumption about someone else's contract produces a fix that only masks the symptom.

### 4. Judge the bug
Present the judgment in this order: symptom → trace path → evidence → root cause → blast radius.

### 5. Write a failing test first, then fix
Follow the Anthropic bug-fix pattern: write a test that reproduces the bug and confirm it is red, fix **minimally** until it is green, then re-run it and report the actual result with the exact command. A test that was never red proves nothing. Stay inside the bug's scope, and leave any refactor you notice to a separate task.

### 6. Step back — is this the elegant fix?
Once the test is green, judge honestly whether the minimal fix is a band-aid, for example a guard that masks a design flaw or a special case bolted onto a broken shape. If it is, describe the **elegant solution** you would write from scratch now that the root cause is known, and offer it to the user as a separate, opt-in change. Do not apply it in this run: the bug fix and the redesign are two units of work under the sequential law, and the user decides whether to take the redesign now or log it as a follow-up.

## Closing (mandatory)
1. Recommend running Claude's **`/code-review`** on the fix to raise its code quality.
2. Recommend **`/ccf:updatespec`** to record the bug and its root cause into the spec (the `error-handling`, `debugging` or `testing` rule), so a future session does not repeat it.
3. Commit or push only when the user explicitly asks.
