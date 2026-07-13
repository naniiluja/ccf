---
description: Refresh the CCF spec (.claude/rules + CLAUDE.md) AND system memory with what was learned this session, so future sessions start fresh and repeat fewer mistakes. Also records new tools with "when to use".
argument-hint: ""
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

You are running CCF `/ccf:updatespec`. Goal: distill this session's lessons into **two places** — the project spec (`.claude/`) and Claude Code's system memory — so future sessions start with fresh context and Claude repeats fewer mistakes.

> **Why two places (important — decides what goes where):**
> - **Spec** (`CLAUDE.md` + `.claude/rules/`) is loaded as a *user message*, tagged "may not be relevant" → lower weight. Good for **project rules**: conventions, architecture, tech-stack, tooling.
> - **Memory** (`~/.claude/projects/<path>/memory/`) is loaded into the *system prompt*, **not down-weighted** → Claude follows it more strongly. Good for **anti-mistake feedback** and **user preferences** across sessions.
> - **No duplication:** anything already in CLAUDE.md must NOT be copied into memory. If a rule in CLAUDE.md keeps getting forgotten/violated, write a `feedback` memory that *reinforces* it (stating why), rather than repeating its content.

## Steps

### 1. Reflect & classify
Review this session for lessons, then classify each as **spec** or **memory**:
- → **Spec**: project conventions/patterns, architecture, tech-stack, new tooling (rules derivable from code or belonging to the repo).
- → **Memory (`feedback`)** — the STRONGEST, most-followed memory type: mistakes you (Claude) made + their fixes, AND correct approaches the user confirmed. ALWAYS record both — a losses-only memory makes future sessions timid/over-cautious, so logging wins keeps confidence calibrated.
- → **Memory (`user`)**: preferences/habits/working style the user expressed (e.g. "always use X", "don't refactor unprompted").
- → **Memory (`project`)**: project constraints not derivable from code/git (deadlines, freezes...). Convert relative dates to absolute.
- Do NOT put in memory: anything derivable from code, git history, or already in CLAUDE.md; transient task progress (use the plan).

### 2. Locate the spec
Find every `CLAUDE.md` + `.claude/rules/*` (root + nested). Each lesson belongs to the file closest to cwd; path-scoped lessons go in a rule with `paths:` frontmatter.

### 3. Update modularly
- Write lessons as **specific, verifiable rules**.
- Each rule file < 50 lines, one topic; create a new `.claude/rules/<topic>.md` if none fits + add a `@.claude/rules/<topic>.md` import line to the relevant CLAUDE.md.
- Keep every CLAUDE.md < 200 lines (you may delegate drafting to `ccf-spec-writer` via Task).
- **Show a diff + a one-line "why"** before writing, then Edit/Write.

### 4. Record new tools (important)
If this session added a new **skill / MCP server / subagent / tool** (e.g. the user installed the Supabase MCP, added a skill), record it in `.claude/rules/tooling.md` **with an explanation of WHEN TO USE it** — specific trigger, input/output, example — so a future session's agent knows when to call it. This is the core of context-first: the spec says not just what exists but **when to use it**.

### 5. Update system memory (cross-session anti-mistake)
For the lessons classified as **memory** in step 1, write them to this project's memory directory: `~/.claude/projects/<sanitized-project-path>/memory/`.
> **Auto Memory interplay:** Claude Code's `autoMemoryEnabled` (on by default, v2.1.59+) may already have auto-saved notes from this session; `/ccf:updatespec` is the *deliberate curation* pass — review/dedupe what's there, then write the high-signal lessons explicitly rather than relying on the auto-extractor.
- Each memory is **one file** holding **one fact**, with frontmatter `name` (kebab-case), `description` (one line — used for recall), `metadata.type` (`feedback` | `user` | `project` | `reference`).
- For `feedback`/`project`: the body is followed by `**Why:**` and `**How to apply:**` lines. The `**Why:**` is MANDATORY, not decoration: without it Claude obeys rigidly and stalls on edge cases; with it Claude grasps the intent and handles ambiguous cases on its own.
- Before creating a new file, **check for an existing file** covering the same fact → update it instead of duplicating; delete memories that turn out to be wrong.
- After writing the file, add **one line** pointing to it in `MEMORY.md` (`- [Title](file.md) — hook`). **MEMORY.md is a PURE INDEX loaded every session — only its first 200 lines OR 25KB (whichever comes first) are read, so keep it lean (one line per memory, < ~200 chars, no memory content) and curate/prune it as it nears that limit.** Link related memories by their `name:` slug — `[[name]]`, not the filename.
- **Memory is point-in-time:** describe a memory by intent/behavior, NOT a code location (e.g. "auth via middleware in main.go", not "the check at line 42") — a recalled memory reflects what was true when written, so a reader must verify the file/function/flag still exists before asserting it as fact.

### 6. Sync the plan
If `.claude/plan/` changed (tasks done, reordered, added), update `PLAN.md` and each task's status. **This command is the SOLE writer of `done`:** a task that is `in-review` AND has passed `/ccf:check` + `/code-review` cleanly → mark it `done` here. `ccf-implementer` only ever reaches `in-review`; `/ccf:check` is read-only and never writes status. If a review surfaced findings, leave the task `in-review` (or move back to `in-progress`) — do NOT mark `done`.

## Closing (mandatory, per output style)
- **Check harness-level attribution:** confirm `.claude/settings.json` exists with an `attribution` key set (the deterministic, harness-enforced replacement for the deprecated `includeCoAuthoredBy` and for any "never add Co-Authored-By" narrative). If the file is missing or `attribution` is absent, **nudge the user** to set it (e.g. `attribution.commit`/`attribution.pr` = the desired trailer text, or `""` to suppress). Do NOT auto-write it and do NOT auto-commit.
- ASK the user whether to commit and/or push. **Do NOT run any git command unless the user explicitly agrees.** If they agree: if on the default branch, create a branch first, and use a conventional commit message.
