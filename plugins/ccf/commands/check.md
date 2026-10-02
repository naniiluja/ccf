---
description: Use when a task is implemented (in-review) and must be verified against the CCF spec before /ccf:updatespec marks it done — conformance, coding conventions, SOLID/OOP, and BE↔FE cross-check. Read-only review.
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
3. **Delegate the review to two fresh, read-only subagents, spawned via Task in ONE message so they run at the same time, each call with `run_in_background: false`**: since Claude Code v2.1.198 a Task spawn that omits it defaults to running in the background, and step 4 needs both finished reports first. Use two ordinary Task spawns rather than Claude Code's agent-teams feature, because teammates run as separate sessions that report through a shared task list, while step 6 needs both reports back in this context to merge them. The two scopes do not overlap:
   - `ccf-scope-checker` (Sonnet, medium effort) checks only whether the diff stays inside the task's `Files to touch` and criteria and covers every criterion. It is the cheaper model because matching a file list and a criteria list against a diff is well-bounded work.
   - `ccf-spec-checker` (Opus) does everything else. For a cross-check, spawn one `ccf-spec-checker` per side (BE and FE) plus one `ccf-scope-checker` for the whole diff, and wait for all of them before step 4. Each `ccf-spec-checker` verifies:
     - Spec conformance (every requirement implemented as specified)
     - Coding conventions (per `.claude/rules/`)
     - Spec violation / drift (code differs from spec without being recorded)
     - **SOLID / OOP violations**
     - Error-handling & logging (per the rules)
     - Test coverage of acceptance criteria
     - Cross-check: diff the BE API surface against how the FE consumes it

   **A cut-off review is not a finished one.** The checker runs under `maxTurns`. When it hits that cap, the harness opens the result with a note like `NOTE: this agent stopped at its N-turn limit before finishing. The text below is PARTIAL output`, while still reporting the spawn as completed; the checker may also open its own report with `PARTIAL:`. Apply this to each checker separately. On either signal, continue that same checker exactly once with `SendMessage` (address it by the agent id its spawn result returned; the note itself carries no id), asking it to finish the items it listed as not yet reviewed. If the continued result is still partial, stop continuing: put `PARTIAL: <checker name>: <what was not reviewed>` as the first line of your merged report, and state that the review is not clean. One partial checker makes the whole report partial, even when the other finished. `cook.md`, `updatespec.md` and the verify chain treat `PARTIAL:` like `FAIL:` for the `done` decision.
4. **Review the actual diff:** run `git diff <base>...HEAD` (base = the branch this work forked from, usually `main`/`master`) to see exactly what changed against the baseline. The diff is what catches scope creep and unrelated edits the spec never asked for. Limit the review to the changed surfaces plus their blast radius.
5. **Verification-first, prove it rather than claim it:** where possible RUN the tests (Bash, read-only) and report the actual output as the evidence. When you cannot prove a requirement is met, say so plainly instead of asserting that it works.
6. **Merge the reports, then produce one structured report** in the marker vocabulary the checkers return, so one grep finds every finding across CCF. Merge by location, and never drop a finding:
   - The key is the finding's `file:line`, with `./` and backslashes normalized. Two findings with the same key become one line that keeps the heavier marker (`FAIL:` over `WARN:`), both descriptions, and the source tag `(spec+scope)`. Every other finding keeps its own tag, `(spec)` or `(scope)`, right after the marker.
   - A finding with no `file:line` is never merged; keep it as its checker wrote it.
   - For `### Acceptance criteria`, keep one line per criterion. When the two checkers disagree, keep the less favorable verdict (not met over not verifiable over met) and name both readings.
   - Count the `FAIL:` and `WARN:` lines of each report before merging. The merged report must hold at least as many as the larger count and no more than their sum; a number outside that range means a finding was lost or duplicated.
   - A `FAIL:` stands only with a score of 80 or more and either a verbatim rule or criterion quote or a `repro:` (a command `ccf-spec-checker` ran and its real output), because a reproduced bug is evidence even when no rule names it.

   The merged report has these sections:
   - `### Conforms` — one `PASS:` line per thing verified, with the evidence named.
   - `### Violations` — one `FAIL:` line per blocking defect, each with `file:line` and a suggested fix.
   - `### Should-reconsider` — one `WARN:` line per non-blocking concern, spec drift included.
   - `### Acceptance criteria` — every task criterion as met, not met (Missing or Misunderstood), or not verifiable from the diff, plus an `Extra:` line for changes no criterion asks for.
   - `### Tests` — what you ran and the actual result.
   - `### Declined to judge` — what the checker set aside or scored below 50, each with its reason; "none" only when truly nothing, never omitted.
   - A closing `Checked for:` line naming the dimensions actually covered.
   6b. **Optional Jev annotation, only when `TYPESAFE_API_KEY` is set and the report has a `FAIL:` line.** Tell the user in one sentence that the diff (minus sensitive files) goes to `api.typesafe.ai`, then locate `scripts/jev-verify-findings.mjs` in the CCF plugin directory with Glob (`${CLAUDE_PLUGIN_ROOT}` is not reliable in a command body) and pipe your merged report into `node "<that path>"` from the project root, so each finding is judged once even when both checkers raised it. For each finding whose `verdict` is `not-confirmed`, append its `note` to that `FAIL:` line; never delete or downgrade a `FAIL:` on Jev's word, because a missed defect costs more than a second look. Any other `reason` in the JSON means skip this step and say so in one line.
   6c. **Refutation pass, only when the merged report has at least one `FAIL:` line.** A reviewer prompted to find gaps will usually report some even when the work is sound, so a fresh agent tries to disprove each one. Spawn one `ccf-finding-refuter` via Task with `run_in_background: false`, passing every `FAIL:` line verbatim, the task file path and the diff base from step 4, and wait for its completion notification before reading the result, because the spawn may still return an async ack first. A partial result is handled like step 3: continue the refuter once with `SendMessage`, and if it is still partial, note in one line which findings went unjudged. For each `REFUTED <file:line>` verdict, append `Refuted (ccf-finding-refuter): <its evidence>` to the matching `FAIL:` line; a `STANDS` verdict changes nothing. Never delete or downgrade a `FAIL:` on the refuter's word, because a missed defect costs more than a second look: the `FAIL:` line count before and after this step is equal. The user decides what to do with a refuted `FAIL:`.
   Keep each finding's quoted rule, `repro:` and confidence score as the checker wrote them: a `FAIL:` stands only on the condition in step 6's merge rules, so never promote a `WARN:` to `FAIL:` or demote the reverse without new evidence you name. Relay any `### Premortem` section a checker returned unchanged. Recommend the fixes and leave them to the next implementer task; this command edits nothing. Full marker table in `.claude/rules/prompt-standard.md`.

## Closing (mandatory)
0. **Optional cross-model second opinion:** if the official `/advisor` command is available (it may be absent on an older Claude Code build), the user may run `/advisor sonnet` or `/advisor fable` for a DIFFERENT-model read of this implementation. It supplements the `ccf-spec-checker` delegation in step 3 and never substitutes for it, which stays mandatory.
1. If the project opted into the test discipline and a function or slice still lacks its contract-level matrix, report it as spec drift (the matrix should have been designed and written during implement, as part of the failing-test-first flow), recommend adding it in the next pass, and run the project's test command to show what the existing tests do prove.
2. Recommend **`/ccf:updatespec`** to capture the drift and lessons found here into the spec, so later sessions start from fresh context. **If this review came back clean,** recommend that `/ccf:updatespec` also mark the `in-review` task `done`. This command is read-only: it recommends that transition and never writes the status itself. `/code-review` remains a good optional extra the user can run for additional quality feedback, but this command's clean result is what the verify chain requires.
