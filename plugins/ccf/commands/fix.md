---
description: Systematic, step-by-step debugging — no rushing. Reproduce the bug, trace logs + DB step by step, judge the root cause, write a failing test, then fix minimally.
argument-hint: "[bug / symptom description]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, mcp__plugin_ccf_context7__resolve-library-id, mcp__plugin_ccf_context7__query-docs, mcp__plugin_ccf_microsoft-learn__*, mcp__plugin_supabase_supabase__execute_sql, mcp__plugin_supabase_supabase__get_logs, mcp__plugin_supabase_supabase__list_tables
model: opus
---

You are running CCF `/ccf:fix`. You are a **disciplined debugger**. Never guess and fix on the spot. Process: reproduce → gather evidence → isolate → root cause → ONLY THEN fix. Report findings after each step before moving to the next.

## Steps

### 1. Reproduce (grill)
Invoke the `grill-me` skill via the Skill tool, passing `fix` as the argument. It interrogates the user **one question at a time** (exploring the code/logs to self-answer first) to reconstruct the bug and returns a summary. Use that summary as the reproduction baseline for the trace below.

### 2. Trace step by step
Read `.claude/rules/logging.md` + `.claude/rules/error-handling.md` as the standard. Follow the correlation/request ID across each boundary; read log entry + exit. **If the project has a database MCP** (Supabase/Railway...), query the DB state step by step (READ-only) to verify hypotheses about the data. Go sequentially, no jumping ahead.

> If the bug has ≥2 independent hypothesis branches, you MUST hand each branch to a `ccf-debugger` subagent (read-only) via Task **with `run_in_background: false`** to isolate them in parallel without flooding context, and wait for every branch to report back before step 3 — since Claude Code v2.1.198 an omitted `run_in_background` defaults to background, which could let step 3 judge the bug before a branch has actually reported. This is the read-only-research EXCEPTION to the sequential law (parallel read-only research is allowed per `architecture.md`), so it does NOT violate "no parallel work". The `ccf-debugger` frontmatter default (`opus`) is a starting point, not a fixed choice: ask the user once whether to keep it or override to a cheaper alias (`sonnet`/`haiku`) for a simple bug. If `AskUserQuestion` is unavailable (non-interactive), use the frontmatter default and say explicitly that the default was used.

### 3. Isolate & hypothesize
Narrow the suspect area **with evidence** (not gut feeling). State the root-cause hypothesis with concrete evidence (`file:line`, log line, DB row). Consult Context7/Microsoft Learn if the bug relates to library/platform behavior.

### 4. Judge the bug
Present it structured: symptom → trace path → evidence → root cause → blast radius.

### 5. Write a failing test first, then fix
Per the Anthropic bug-fix pattern: write a test that reproduces the bug (red) → fix **minimally** to make it green → re-run the test and report actual results. Fix only within the bug's scope; do NOT refactor on the side.

### 6. Step back — is this the elegant fix?
Once green, judge honestly whether the minimal fix is a band-aid (e.g. a guard that masks a design flaw, a special-case patch). If so, describe — knowing everything you now know about the root cause — the **elegant solution** you'd write from scratch, and offer it to the user as a SEPARATE, opt-in change. Do NOT auto-apply it: the bug fix and the redesign are different units of work (sequential law). The user decides whether to take the elegant path now or log it as a follow-up.

## Closing (mandatory)
1. Recommend running Claude's **`/code-review`** on the fix to improve code quality.
2. Recommend **`/ccf:updatespec`** to record the bug + root cause into the spec (rules `error-handling` / `debugging` / `testing`), so it doesn't recur in future sessions.
3. Do NOT commit/push unless the user explicitly asks.
