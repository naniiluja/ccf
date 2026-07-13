---
description: Verify an implementation against the CCF spec — conformance, coding conventions, SOLID/OOP, and BE↔FE cross-check. Read-only review.
argument-hint: "[optional: path or feature to check]"
allowed-tools: Read, Glob, Grep, Bash, Task
model: opus
---

You are running CCF `/ccf-check`. You are a **fresh-context reviewer** (Anthropic recommends a clean-context reviewer for sharper review). You only review — you do NOT modify code.

## Steps
1. **Load the contract:** read every `CLAUDE.md` (root + nested) + `.claude/rules/*` + the relevant task file in `.claude/plan/`. This is the spec to check against.
2. **Determine the mode** from `$ARGUMENTS`:
   - BE vs spec
   - FE vs spec
   - **BE ↔ FE cross-check** (does the FE's API usage match the BE contract)
   If `$ARGUMENTS` is empty, ask or infer from the most recent changes.
3. **Delegate the deep review to the `ccf-spec-checker` subagent** (via Task — fresh, read-only). For cross-check, spawn one checker per side (BE and FE). Each checker verifies:
   - Spec conformance (every requirement implemented as specified)
   - Coding conventions (per `.claude/rules/`)
   - Spec violation / drift (code differs from spec without being recorded)
   - **SOLID / OOP violations**
   - Error-handling & logging (per the rules)
   - Test coverage of acceptance criteria
   - Cross-check: diff the BE API surface against how the FE consumes it
4. **Review the actual diff:** run `git diff <base>...HEAD` (base = the branch this work forked from, usually `main`/`master`) to review exactly what changed against the baseline — catches scope creep and unrelated edits the spec didn't ask for. Limit the review to changed surfaces + their blast radius.
5. **Verification-first — prove it, don't claim it:** where possible, RUN the tests (Bash, read-only) and report actual results. Do not assert "this works"; show the passing output / observed behavior as evidence. If you cannot prove a requirement is met, say so plainly.
6. **Produce a structured report:** Conforms / Violations (with `file:line`) / Spec drift / Recommended fixes. Do NOT fix anything.

## Closing (mandatory)
0. **OPTIONAL cross-model second opinion:** if the official `/advisor` command is available (OPTIONAL, may be absent on an older Claude Code build), the user MAY run `/advisor sonnet` or `/advisor fable` for a DIFFERENT-model review of this implementation alongside `ccf-spec-checker`. This is a SUPPLEMENT, never a substitute — it does NOT replace the `ccf-spec-checker` delegation in step 3, which stays mandatory.
1. If the project opted into the test discipline and a function/slice still lacks its contract-level matrix, flag it as spec drift (the matrix should have been written by `ccf-implementer` during implement) and recommend the next implementer task add it — then run the project's test command to prove it passes.
2. Recommend the user run Claude's **`/code-review`** on this change to surface additional quality/correctness issues.
3. Then recommend **`/ccf:ccf-updatespec`** to capture any drift/lessons discovered into the spec, keeping context fresh for future sessions. **If this review (and `/code-review`) came back clean,** recommend that `/ccf:ccf-updatespec` then mark the `in-review` task `done` — this command is read-only and does NOT write task status itself; it only RECOMMENDS the transition.
