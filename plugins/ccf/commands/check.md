---
description: Verify an implementation against the CCF spec — conformance, coding conventions, SOLID/OOP, and BE↔FE cross-check. Read-only review.
argument-hint: "[optional: path or feature to check]"
allowed-tools: Read, Glob, Grep, Bash, Task, SendMessage
model: opus
---

You are running CCF `/ccf:check`. You are a **fresh-context reviewer**: a context that did not write the code reviews it more sharply, which is why Anthropic recommends a clean-context reviewer. You review and report findings; the fixing belongs to the next implementer task, and the task status belongs to `/ccf:updatespec`.

## 0a. Style for user-facing text (applies to every step below that writes text for the user)
**Scope boundary:** this rule governs the review report and the recommendations you show the user. It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself). Marker words, section headings and identifiers stay verbatim in every language, because the rest of the verify chain parses them.
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
1. **Load the contract:** read every `CLAUDE.md` (root + nested), `.claude/rules/*`, and the relevant task file in `.claude/plan/`. That set is the spec you check against. When the target is a markdown prompt under `plugins/ccf/{commands,agents,skills}/`, `.claude/rules/prompt-standard.md` is part of that set too.
2. **Determine the mode** from `$ARGUMENTS`:
   - BE vs spec
   - FE vs spec
   - **BE ↔ FE cross-check** (does the FE's API usage match the BE contract)
   With `$ARGUMENTS` empty, infer the mode from the most recent changes (step 4's diff) and state in one line which mode you picked, so the user can correct it. This command deliberately carries no `AskUserQuestion` in `allowed-tools` (`.claude/rules/components.md` records that decision), so when the diff is genuinely ambiguous, ask in plain prose rather than reaching for the tool.
3. **Delegate the deep review to the `ccf-spec-checker` subagent** via Task, fresh and read-only, **with `run_in_background: false`**: since Claude Code v2.1.198 a Task spawn that omits it defaults to running in the background, and step 4 needs the finished report first. For a cross-check, spawn one checker per side (BE and FE) and wait for both before step 4. Each checker verifies:
   - Spec conformance (every requirement implemented as specified)
   - Coding conventions (per `.claude/rules/`)
   - Spec violation / drift (code differs from spec without being recorded)
   - **SOLID / OOP violations**
   - Error-handling & logging (per the rules)
   - Test coverage of acceptance criteria
   - Cross-check: diff the BE API surface against how the FE consumes it

   **A cut-off review is not a finished one.** The checker runs under `maxTurns`. When it hits that cap, the harness opens the result with a note like `NOTE: this agent stopped at its N-turn limit before finishing. The text below is PARTIAL output`, while still reporting the spawn as completed; the checker may also open its own report with `PARTIAL:`. On either signal, continue that same checker exactly once with `SendMessage` (the note names its agent id), asking it to finish the items it listed as not yet reviewed. If the continued result is still partial, stop continuing: put `PARTIAL: <what was not reviewed>` as the first line of your report, and state that the review is not clean. `cook.md`, `updatespec.md` and the verify chain treat `PARTIAL:` like `FAIL:` for the `done` decision.
4. **Review the actual diff:** run `git diff <base>...HEAD` (base = the branch this work forked from, usually `main`/`master`) to see exactly what changed against the baseline. The diff is what catches scope creep and unrelated edits the spec never asked for. Limit the review to the changed surfaces plus their blast radius.
5. **Verification-first, prove it rather than claim it:** where possible RUN the tests (Bash, read-only) and report the actual output as the evidence. When you cannot prove a requirement is met, say so plainly instead of asserting that it works.
6. **Produce a structured report** in the marker vocabulary the checkers return, so one grep finds every finding across CCF:
   - `### Conforms` — one `PASS:` line per thing verified, with the evidence named.
   - `### Violations` — one `FAIL:` line per blocking defect, each with `file:line` and a suggested fix.
   - `### Should-reconsider` — one `WARN:` line per non-blocking concern, spec drift included.
   - `### Acceptance criteria` — every task criterion as met, not met (Missing or Misunderstood), or not verifiable from the diff, plus an `Extra:` line for changes no criterion asks for.
   - `### Tests` — what you ran and the actual result.
   - `### Declined to judge` — what the checker set aside or scored below 50, each with its reason; "none" only when truly nothing, never omitted.
   - A closing `Checked for:` line naming the dimensions actually covered.
   6b. **Optional Jev annotation, only when `TYPESAFE_API_KEY` is set and the report has a `FAIL:` line.** Tell the user in one sentence that the diff (minus sensitive files) goes to `api.typesafe.ai`, then locate `scripts/jev-verify-findings.mjs` in the CCF plugin directory with Glob (`${CLAUDE_PLUGIN_ROOT}` is not reliable in a command body) and pipe your report into `node "<that path>"` from the project root. For each finding whose `verdict` is `not-confirmed`, append its `note` to that `FAIL:` line; never delete or downgrade a `FAIL:` on Jev's word, because a missed defect costs more than a second look. Any other `reason` in the JSON means skip this step and say so in one line.
   Keep each finding's quoted rule and confidence score as the checker wrote them: a `FAIL:` stands only with a score of 80 or more and a verbatim rule or criterion quote, so never promote a `WARN:` to `FAIL:` or demote the reverse without new evidence you name. Relay any `### Premortem` section a checker returned unchanged. Recommend the fixes and leave them to the next implementer task; this command edits nothing. Full marker table in `.claude/rules/prompt-standard.md`.

## Closing (mandatory)
0. **Optional cross-model second opinion:** if the official `/advisor` command is available (it may be absent on an older Claude Code build), the user may run `/advisor sonnet` or `/advisor fable` for a DIFFERENT-model read of this implementation. It supplements the `ccf-spec-checker` delegation in step 3 and never substitutes for it, which stays mandatory.
1. If the project opted into the test discipline and a function or slice still lacks its contract-level matrix, report it as spec drift (the matrix should have been designed and written during implement, as part of the failing-test-first flow), recommend adding it in the next pass, and run the project's test command to show what the existing tests do prove.
2. Recommend **`/ccf:updatespec`** to capture the drift and lessons found here into the spec, so later sessions start from fresh context. **If this review came back clean,** recommend that `/ccf:updatespec` also mark the `in-review` task `done`. This command is read-only: it recommends that transition and never writes the status itself. `/code-review` remains a good optional extra the user can run for additional quality feedback, but this command's clean result is what the verify chain requires.
