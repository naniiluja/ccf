---
description: Refresh the CCF spec (.claude/rules + CLAUDE.md) AND system memory with what was learned this session, so future sessions start fresh and repeat fewer mistakes. Also records new tools with "when to use".
argument-hint: ""
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

You are running CCF `/ccf:updatespec`. Distill this session's lessons into **two places** — the project spec (`.claude/`) and Claude Code's system memory — so future sessions start with fresh context and repeat fewer mistakes.

> **Why two places, and what goes where:**
> - **Spec** (`CLAUDE.md` + `.claude/rules/`) is loaded as a *user message* tagged "may not be relevant", so it carries lower weight. It suits **project rules**: conventions, architecture, tech stack, tooling.
> - **Memory** (`~/.claude/projects/<path>/memory/`) is loaded into the *system prompt* and is not down-weighted, so Claude follows it more strongly. It suits **anti-mistake feedback** and **user preferences** across sessions.
> - **No duplication:** anything already in `CLAUDE.md` stays there. When a rule in `CLAUDE.md` keeps getting forgotten, write a `feedback` memory that reinforces it and states why, instead of copying its content.

## 0a. Style for user-facing text (applies to every step below that writes text for the user)
**Scope boundary:** this rule governs CCF-generated text meant for the human reader (the diff explanation, the "why" line, the plan and task sync notes shown to the user). It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself).
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

### 1. Reflect & classify
Review this session for lessons, then classify each as **spec** or **memory**:
- → **Spec**: project conventions and patterns, architecture, tech stack, new tooling — anything derivable from the code or belonging to the repo.
- → **Memory (`feedback`)** — the strongest, most-followed memory type: mistakes you (Claude) made plus their fixes, AND correct approaches the user confirmed. Record both: a losses-only memory makes future sessions timid, so logging the wins keeps confidence calibrated.
- → **Memory (`user`)**: preferences, habits and working style the user expressed (e.g. "always use X", "don't refactor unprompted").
- → **Memory (`project`)**: project constraints not derivable from code or git (deadlines, freezes). Convert relative dates to absolute ones.
- Keep out of memory anything derivable from code, git history, or already in `CLAUDE.md`, and transient task progress — the latter belongs in the plan.

### 2. Locate the spec
Find every `CLAUDE.md` and `.claude/rules/*` (root + nested). Each lesson belongs to the file closest to cwd; a lesson that applies to one area of the tree goes in a rule with `paths:` frontmatter, which lazy-loads only when a matching file is touched.

### 3. Update modularly
- Write lessons as **specific, verifiable rules**.
- Keep each rule file < 50 lines on one topic; create a new `.claude/rules/<topic>.md` when none fits, and add a `@.claude/rules/<topic>.md` import line to the relevant `CLAUDE.md`.
- Keep every `CLAUDE.md` < 200 lines. You may delegate the drafting to `ccf-spec-writer` via Task **with `run_in_background: false`**, since Claude Code v2.1.198 an omitted `run_in_background` defaults to background and this step needs the draft back before it can write anything.
- **Show a diff plus a one-line "why"** before writing, then Edit/Write.

### 4. Record new tools (with when to use)
If this session added a new **skill / MCP server / subagent / tool** (e.g. the user installed the Supabase MCP), record it in `.claude/rules/tooling.md` **with an explanation of WHEN TO USE it**: the specific trigger, input and output, one example. This is the core of context-first — the spec says not just what exists but when to reach for it.

### 5. Update system memory (cross-session anti-mistake)
Write the lessons classified as **memory** in step 1 into this project's memory directory: `~/.claude/projects/<sanitized-project-path>/memory/`.
> **Auto Memory interplay:** Claude Code's `autoMemoryEnabled` (on by default, v2.1.59+) may already have auto-saved notes from this session. This step is the *deliberate curation* pass: review and dedupe what is there, then write the high-signal lessons explicitly rather than trusting the auto-extractor.
- Each memory is **one file holding one fact**, with frontmatter `name` (kebab-case), `description` (one line, used for recall) and `metadata.type` (`feedback` | `user` | `project` | `reference`).
- For `feedback` and `project`, follow the body with `**Why:**` and `**How to apply:**` lines. The `**Why:**` is mandatory, not decoration: without it Claude obeys rigidly and stalls on edge cases; with it Claude grasps the intent and handles ambiguous cases on its own.
- Before creating a file, **look for an existing one** covering the same fact and update that instead; delete memories that turn out to be wrong.
- After writing the file, add **one line** pointing to it in `MEMORY.md` (`- [Title](file.md) — hook`). **`MEMORY.md` is a pure index loaded every session, and only its first 200 lines OR 25KB (whichever comes first) are read**, so keep it to one line per memory, under ~200 characters, with no memory content in it, and prune as it nears the limit. Link related memories by their `name:` slug — `[[name]]`, not the filename.
- **Memory is point-in-time:** describe a memory by intent or behavior, not by a code location ("auth via middleware in main.go", not "the check at line 42"). A recalled memory reflects what was true when it was written, so verify the file, function or flag still exists before asserting it as fact.

### 6. Sync the plan
If `.claude/plan/` changed (tasks finished, reordered, added), update `PLAN.md` and each task's status. **This command is the SOLE writer of `done`:** a task that is `in-review` AND has passed `/ccf:check` + `/code-review` cleanly becomes `done` here. `ccf-implementer` only ever reaches `in-review`, and `/ccf:check` is read-only and never writes status. If a review surfaced findings, leave the task `in-review` or move it back to `in-progress`.

**Write the status as a BARE word** (`done`, `in-review`) with no markdown emphasis around it. `lib/plan.mjs` strips `**bold**`, `*italic*` and `` `code` `` before matching, so a decorated cell is tolerated — write it plain anyway, because the decoration carries no information and it already caused one real misread: a `**done**` row counted as unfinished by the Stop nudge before that stripping existed.

**Retire a CLOSED iteration out of `PLAN.md` in this same pass.** `PLAN.md` holds the CURRENT iteration only. When every task of an iteration is `done`:
1. **Run the script rather than editing the two files by hand.** `node "<plugin-root>/scripts/archive-plan.mjs"` previews (writes nothing, and names any row still holding an iteration open); add `--apply` to perform it. It moves the iteration's `## Origin` / `## Task backlog` / `## Closed` sections VERBATIM into `.claude/plan/ARCHIVE.md` newest-first, and `git mv`s its `task-NNN-*.md` files into `.claude/plan/archive/`. Verbatim is deliberate: the archive's value is being an auditable record, so a heading that still says `OPEN` next to a `done` row is itself part of the history. Hand-editing risks cutting the wrong section, because an iteration's headings do NOT share a common name — the script groups by position, from one `## Origin` heading to the next. With no shell access, say so plainly and do it by hand following that same positional rule.
2. Then trim `CLAUDE.md`'s `## Current plan` to the iteration now in flight and let the archive carry the rest. The script deliberately leaves this to you: picking the new lead iteration is judgment, not mechanics.
3. Leave committing to the user. The script stages the moved files and nothing more (`git-workflow.md`).

Why this matters in both directions: a closed row left in `PLAN.md` is counted as LIVE work by `lib/plan.mjs` (`findActiveTask` / `findNonDoneTasks`) and by the Stop nudge, while deleting the history instead of archiving it would degrade every future `ccf-spec-checker` premortem to `anchor: none`, since that lens anchors predicted failures to real past ones. Archive, never delete.

## Closing (mandatory)
- **Check harness-level attribution:** confirm `.claude/settings.json` exists with an `attribution` key set (the deterministic, harness-enforced replacement for the deprecated `includeCoAuthoredBy` and for any "never add Co-Authored-By" prose). If the file is missing or `attribution` is absent, **nudge the user** to set it (`attribution.commit` / `attribution.pr` = the trailer text they want, or `""` to suppress). Leave the writing to them, since it changes how every future commit in the repo is attributed.
- **Re-measure the ccf-budget latch after every spec edit, in the CCF plugin repo itself.** This command always rewrites `CLAUDE.md`, a PAID file (it and every file it `@import`s are loaded every session), yet nothing else in the workflow re-measures it. If this session edited `CLAUDE.md` or any `.claude/rules/*.md` while working ON the CCF plugin repo (not a project `/ccf:init` generated), run `node --test .claude/tests/*.test.mjs` after step 3; when the self-consistency check reports drift, re-derive the true byte count with `measurePaidBytes` (`.claude/tests/context-budget.mjs`) and refill the `<!-- ccf-budget: paid=NNN -->` label in `.claude/rules/prompt-standard.md` as the LAST write of the session, never before — refilling it earlier would race any spec edit still to come and leave the label stale again.
- ASK the user whether to commit and push, and run a git command only after they explicitly agree. If they agree: on the default branch, create a branch first, then use a conventional commit message.
