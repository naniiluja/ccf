---
description: How to write a CCF command, agent or skill prompt — the 14-point checklist, the canonical user-facing style block, the codepoint policy, and the review marker vocabulary.
paths:
  - plugins/ccf/commands/**
  - plugins/ccf/agents/**
  - plugins/ccf/skills/**
---

# Prompt-writing standard (commands, agents, skills)

Applies to the markdown prompts under `plugins/ccf/commands/`, `plugins/ccf/agents/` and `plugins/ccf/skills/`. Those files ARE the product, so their wording is behavior, not documentation of behavior. `components.md` owns the frontmatter contract; this file owns the prose.

**Loading**: this file carries `paths:` and is deliberately NOT `@import`ed from `CLAUDE.md`, so it lazy-loads only when a prompt file is touched and costs nothing in the per-session budget. See "Why not `@import`" at the bottom for the grounded reason that the two mechanisms cannot be combined.

## The 14-point checklist

Apply every point when writing or revising a prompt. Each carries its reason, because a rule whose reason is missing gets "simplified" away by the next person who reads it.

1. **Be clear and direct, and number sequential steps.** This is the golden rule of prompt engineering: a new colleague with no context should be able to follow the prompt. Numbered headings also let other files cite a step by number.
2. **Every bare "Do NOT X" gets the replacement behavior.** A prohibition with no alternative leaves the model to invent one. Write "Do NOT spawn `Explore`; spawn `ccf-codebase-analyzer` instead", not "Do NOT spawn `Explore`".
3. **State the reason next to any rule that matters.** A rule with its rationale survives an edit by someone who does not know the history; a bare rule reads as arbitrary and gets dropped.
4. **Spend emphasis capitals sparingly.** Current models react strongly to CRITICAL / MUST / NEVER, so a file that shouts on every line loses the ability to mark what is actually load-bearing. Keep the decisive imperative mood (short, direct sentences); drop the shouting from ordinary instructions.
5. **Use XML tags when one passage mixes instructions with examples or input.** Tags stop the model from reading an example as an instruction. Do not wrap every heading in tags; a plain heading is clearer when the section is only instructions.
6. **An agent prompt opens with its role and closes with its output format.** The closing section defines the contract the caller parses, which is a different job from repeating the body as a summary. Do not close with a recap.
7. **An agent `description` states trigger, scope and limits.** That field is what decides whether Claude invokes the agent at all, so "Read-only", "does NOT fix code" and "plan OR code" belong in it.
8. **Few-shot only when the shape is hard to state, and then 3 to 5 examples inside `<example>` tags.** Fewer than three does not establish a pattern; more than five costs context for no gain. This is a rule about prompt CONTENT and has nothing to do with how many list items an output section may have.
9. **Long reference material first, the instruction last.** Models attend more reliably to an instruction that sits after the material it applies to.
10. **`ccf-implementer` carries an explicit anti-over-engineering block.** It is the only agent that writes files, so it is the only place where scope creep turns into committed code.
11. **Cut line by line, with a hard exemption list.** Every line must add information the model does not already have. Never cut: the prompt-side backup for a fail-open hook (`plan.md` steps 0 and 6, `init.md` A4, the "NOT done" sentence in `ccf-implementer.md`), any string another file parses (`Model: <alias>`, `TEST-RESULT:`, `discipline: on`, the status words), or a step number another file cites. When a rewrite deletes lines, list them.
12. **A skill `description` leads with its trigger words and stays inside the character cap.** The listing truncates `description` plus `when_to_use` at **1,536** characters (default of the `skillListingMaxDescChars` setting; grounded at code.claude.com/docs/en/slash-commands and /en/settings, re-verified 2026-07-31). Front-load the trigger because truncation cuts the tail.
13. **Tell the model how to think, do not script its reasoning.** "Weigh X against Y and say which wins" generalizes; a written-out chain of thought for one case does not, and it stops the model from reasoning about the case actually in front of it.
14. **No icons.** Review markers come from the word tables below.

**Tool pairing, generalized from `components.md`'s `AskUserQuestion` law:** every tool a command's BODY tells the model to use must appear in that command's `allowed-tools`, including `Bash` when the body says to run a shell command. The allowlist is a whitelist, so a missing tool silently disables the instruction that depends on it; the fix direction is always to ADD the tool, never to soften the instruction to match the missing tool. Point 11 covers deleted lines; this covers the missing-tool twin.

**Scoping the `Bash` grant depends on whether the exact command is knowable when the prompt is written** (task 049 finding, replacing an earlier version of this paragraph that treated every case the same way):
- **The command is fixed at authoring time** (`grill-me`'s `Bash(git log:*)`, a specific lookup the prompt names): scope the allowlist to that prefix, least-privilege in the literal sense.
- **The command is a stand-in for whatever the TARGET project's own tooling turns out to be** (`cook.md`'s re-gate step and `check.md`'s test-evidence step both say "run the project's test command", meaning npm, pytest, cargo, go test, or anything else `/ccf:init` finds in that project): no fixed prefix set can name every target project's test runner in advance, so a prefix-scoped grant would silently drop most of them. Bare `Bash` is the minimum SUFFICIENT set here, not a least-privilege violation. `check.md` already carried bare `Bash`; `cook.md` carried three CCF-tooling prefixes (`Bash(npx:*)`, `Bash(node:*)`, `Bash(claude:*)`) that did not cover this second case, so task 049 widened it to bare `Bash` to match `check.md` — see `.claude/rules/components.md`'s decision record next to the `AskUserQuestion` law.

## Canonical style block for user-facing text

Every command or agent that emits text a human reads carries this block. The bullet lines are **byte-identical everywhere** so one grep proves they have not drifted:

```
md5 of the bullet block (13 lines, 1479 bytes): deac0ef73d3c0cb9d26766027a906385
```

The block, verbatim:

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

### What may differ between copies, and nothing else

Three things are per-file by design; everything else is a drift bug.

1. **The heading.** A command numbers it into its own step sequence (`## 0a. Style for user-facing text`), an agent uses a plain `## Style for user-facing text`.
2. **The `Scope boundary:` line.** Each copy names the text THAT file actually produces (the plan body and task files in `plan.md`, the diff explanation in `updatespec.md`, the findings report in a reviewer). Every copy keeps the same second half: the CCF repo's own source stays English per `.claude/rules/components.md`.
3. **One extra sentence in `ccf-spec-writer.md` only.** It also drafts a TARGET project's `CLAUDE.md` and rules, so its scope line adds that such content follows the target project's chosen language instead.

Verify the copies with `grep -rln "^- Write in the SAME language" plugins/ccf`, then md5 each block against the hash above. The count grows as the remaining prompts adopt the block; it was 5 files when this rule was written (`plan.md`, `init.md`, `updatespec.md`, `ccf-spec-writer.md`, `ccf-spec-checker.md`) and the end state for this iteration is 9.

**Four prompts deliberately do NOT carry the block, and why:** `skills/grill-me/SKILL.md` runs inside the main loop, so the calling command's own copy is already in context when the interview runs; `ccf-implementer.md` writes code and its return goes to the orchestrating command, not to a human; `ccf-codebase-analyzer.md` and `ccf-best-practice-researcher.md` return structured reports that a COMMAND consumes and folds into specs or plans. Adding the block to one of these is not an improvement, it is drift from this list; if a fifth exemption is ever needed, record it here with its reason.

## Codepoint policy

**Blocked, by explicit codepoint** (no Unicode property names, because a property class silently pulls in far more than intended): U+1F52E, U+274C, U+2705, U+26A0, U+FE0F. U+26A0 and U+FE0F travel as a pair and are removed as a pair.

**Allowed**: arrows U+2190 / U+2192 / U+2194, box drawing U+2500 to U+257F, CJK characters, the ellipsis U+2026, and the math relations U+2264 / U+2265 / U+2260. These carry meaning that a word substitute would make longer, and none of them is decoration.

**One standing exemption, recorded here rather than in the file it applies to**: U+2716 and U+2717 appear inside the `FAIL_SIGNAL` regex in `plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.mjs`. They are DATA there, the literal bytes several test runners print on a failing assertion, so removing them would break failure detection. The two `test-gate-core` files are not to be edited by any task in this iteration; the exemption lives in this rule so nobody has to add an in-file comment defending it.

**Excluded from every scan**: `.claude/plan/ARCHIVE.md` and `.claude/plan/archive/**`. Closed history is a verbatim record, so rewriting it would falsify what a past session actually wrote.

Scan command, a Node one-liner over the tracked files (not `grep -P`, see the warning below):

```
git ls-files '*.md' '*.mjs' '*.tmpl' | grep -Ev '\.claude/plan/(ARCHIVE\.md|archive/)' | node -e '
const fs = require("fs");
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (buf += d));
process.stdin.on("end", () => {
  let hit = false;
  for (const f of buf.split("\n").filter(Boolean)) {
    if (/[\u{1F52E}\u{274C}\u{2705}\u{26A0}\u{FE0F}]/u.test(fs.readFileSync(f, "utf8"))) {
      console.log(f);
      hit = true;
    }
  }
  process.exit(hit ? 1 : 0);
});
'
```

**Do NOT use `grep -rlP` for this scan — its failure mode is a FALSE PASS.** macOS `/usr/bin/grep` has no `-P`: it exits 2 with an empty stdout and its usage text on stderr, which in a pipeline reads exactly like "no files matched". Hit for real in task 048, where the interactive shell resolved `grep` to a ugrep wrapper (which does support `-P`) while `/bin/sh -c` resolved it to BSD grep and reported clean, and confirmed again in task 049's own acceptance criteria, which ban `grep -P` outright for this reason. The Node regex above runs the same everywhere `node` runs, with no grep-flavor dependency to get wrong.

## Review marker vocabulary

Two tables, two different jobs. Do not mix them: a heading groups findings, a marker labels one finding.

### Inline markers, inside a single finding line

| Marker | Meaning |
| --- | --- |
| `FAIL:` | Blocking defect. The gate is not green until it is fixed or the user knowingly accepts it. |
| `WARN:` | Non-blocking for a CODE gate: decide it and record the decision. In a PLAN review it must still be resolved or explicitly accepted before `ExitPlanMode`, because `plan.md` step 6 and `init.md` A4 loop until `### Violations` and `### Should-reconsider` are both empty or knowingly accepted. |
| `PASS:` | Verified correct, with the evidence named. |

`FAIL:` is safe to introduce here: the template test-gate's failure heuristic deliberately excludes the bare word FAIL (it requires a failure COUNT of at least 1, or an anchored phrase), so a review marker cannot trip a test gate.

### Section headings, in a reviewer's return format

| Heading | Holds |
| --- | --- |
| `### Conforms` | The `PASS:` tier: what was checked and found correct. |
| `### Violations` | The `FAIL:` tier: blocking defects, each with `file:line` and a suggested fix. |
| `### Should-reconsider` | The `WARN:` tier: spec drift and non-blocking concerns. |
| `### Premortem` | Prospective failure modes, each with likelihood, anchor and one preventing change. |
| `### Tests` | The commands actually executed and their real results; `check.md` requires this section in every report. |

Both ends of this vocabulary must move together. `ccf-spec-checker.md` PRODUCES the headings; `plan.md` step 6, `cook.md` step 3 and 5, and `hooks/lib/verify-chain.mjs`'s reason string READ them. Changing one end alone leaves a gate keyed on a marker nobody emits.

## Why not `@import`

`CLAUDE.md` currently `@import`s `.claude/rules/hooks.md`, which carries `paths: plugins/ccf/hooks/**`. Observed live in the session that wrote this rule: `hooks.md` arrived in full at session start, before any file under `plugins/ccf/hooks/**` was read. So an `@import` loads the file unconditionally and the `paths:` scope on it has no effect.

The docs describe the two mechanisms separately and never state how they combine (`@path/to/import` is textual inclusion from `CLAUDE.md`; `paths:` gates the auto-discovery of `.claude/rules/*` — code.claude.com/docs/en/memory, /en/claude-directory, /en/glossary). The observation above resolves it: `@import` wins, so combining them is a way to pay for a scope you do not get. A `paths:`-scoped rule is referenced by PATH from prose, never imported.

Consequence for the budget, stated in the order that matters: what a session actually PAYS is `CLAUDE.md` plus every `@import`ed rule, i.e. the `wc -c CLAUDE.md .claude/rules/*.md` total minus this file's own bytes (the only rule that is `paths:`-scoped AND not imported). A subtraction that also removed `hooks.md` would be a hypothetical only: `hooks.md` is `@import`ed, so its `paths:` is void and its bytes are paid every session regardless of that frontmatter. Earlier notes carried four different figures in a row for this total (measured mid-task, then prose grew, then nobody re-measured), which is exactly the fixpoint this file must not repeat — so the paid figure is no longer restated in prose here. It lives in the single machine-readable claim below, which `.claude/tests/context-budget.test.mjs` (repo scope, see `.claude/rules/testing.md`) asserts against a real measurement on every run; re-run `wc -c` as the LAST step of any task that touches this set, then update the number in the label, not in a sentence.

<!-- ccf-budget: paid=98052 -->

This file is itself one of the bytes being measured, and it is the one file EXCLUDED from the paid total (it carries `paths:` and is deliberately not `@import`ed) — so editing the label above changes nothing about what it is checked against. Adding an `@import .claude/rules/prompt-standard.md` line to `CLAUDE.md` would break that: the file would re-enter the paid set it is labeling, closing the fixpoint loop this design exists to avoid. `.claude/tests/context-budget.test.mjs` asserts this file stays in the lazy (excluded) set for exactly that reason.
