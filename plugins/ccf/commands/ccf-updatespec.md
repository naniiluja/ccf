---
description: Refresh the CCF spec (.claude/rules + CLAUDE.md) AND system memory with what was learned this session, so future sessions start fresh and repeat fewer mistakes. Also records new tools with "when to use".
argument-hint: ""
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

You are running CCF `/ccf-updatespec`. Goal: distill this session's lessons into **two places** — the project spec (`.claude/`) and Claude Code's system memory — so future sessions start with fresh context and Claude repeats fewer mistakes.

> **Why two places (important — decides what goes where):**
> - **Spec** (`CLAUDE.md` + `.claude/rules/`) is loaded as a *user message*, tagged "may not be relevant" → lower weight. Good for **project rules**: conventions, architecture, tech-stack, tooling.
> - **Memory** (`~/.claude/projects/<path>/memory/`) is loaded into the *system prompt*, **not down-weighted** → Claude follows it more strongly. Good for **anti-mistake feedback** and **user preferences** across sessions.
> - **No duplication:** anything already in CLAUDE.md must NOT be copied into memory. If a rule in CLAUDE.md keeps getting forgotten/violated, write a `feedback` memory that *reinforces* it (stating why), rather than repeating its content.

## Steps

### 1. Reflect & classify
Review this session for lessons, then classify each as **spec** or **memory**:
- → **Spec**: project conventions/patterns, architecture, tech-stack, new tooling (rules derivable from code or belonging to the repo).
- → **Memory (`feedback`)**: mistakes you (Claude) made + their fixes, *and also correct approaches the user confirmed* — so you don't drift away from validated approaches.
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
- Each memory is **one file** holding **one fact**, with frontmatter `name` (kebab-case), `description` (one line — used for recall), `metadata.type` (`feedback` | `user` | `project` | `reference`).
- For `feedback`/`project`: the body is followed by `**Why:**` and `**How to apply:**` lines (include the why so Claude can handle edge cases later).
- Before creating a new file, **check for an existing file** covering the same fact → update it instead of duplicating; delete memories that turn out to be wrong.
- After writing the file, add **one line** pointing to it in `MEMORY.md` (`- [Title](file.md) — hook`). MEMORY.md is only an index (one line per memory, < ~200 chars), do NOT put memory content there. Link related memories with `[[file-name]]`.
- Memories that mention a specific file/function/flag: prefer line-independent descriptions (e.g. "auth via middleware in main.go" rather than "line 42").

### 6. Sync the plan
If `.claude/plan/` changed (tasks done, reordered, added), update `PLAN.md` and each task's status.

## Closing (mandatory, per output style)
ASK the user whether to commit and/or push. **Do NOT run any git command unless the user explicitly agrees.** If they agree: if on the default branch, create a branch first, and use a conventional commit message.
