# Task 081 — FAIL by reproduction

- **Vertical slice:** `ccf-spec-checker` agent + `/ccf:check` merge rule + `finding-verify.mjs` parser + repo latch + eval case 09
- **Depends on:** —
- **Spec refs:** `.claude/rules/prompt-standard.md` (review markers, `FAIL:` tiers); `.claude/rules/architecture.md` (refuter never deletes or downgrades a `FAIL:`); `.claude/rules/testing.md` (latch must be seen RED); `.claude/rules/coding-conventions.md` (no comments in new code).
- **MCP to use:** none
- **discipline:** on
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, `node /home/hatch/coder/ccf/node_modules/typescript/bin/tsc --noEmit`, `claude plugin validate plugins/ccf`. The paid eval is NOT part of the gate (task 082 seeds it as an `action` row in `PENDING.md`).

## Goal (one sentence)
`ccf-spec-checker` may raise a `FAIL:` for a bug no rule mentions when it ran a command that reproduced it, and the parser keeps that reproduction separate from a quoted rule.

## Decision (approved)
A `FAIL:` stands when score >= 80 AND it carries ONE of: a verbatim quote of a rule/criterion (`rule: "..."`), OR `repro: "<command run>" -> "<real output>"`. Only `ccf-spec-checker` gets this. Analysis without running a command stays at most `WARN:`. The refuter (`check.md` step 6c, `ccf-finding-refuter.md`) is unchanged.

## Acceptance criteria (verifiable)
- [ ] `ccf-spec-checker.md` allows a `FAIL:` that carries only a real `repro:` (no rule quote), documents the `repro: "<cmd>" -> "<output>"` line format, and still says analysis without a run command is at most `WARN:`.
- [ ] `check.md` step 6 (merge) states the condition under which a `FAIL:` stands (rule quote OR `repro:`); step 6c's wording about the refuter is unchanged byte for byte.
- [ ] `parseFailFindings` returns a new `repro` field (`{ command, output }` or `null`); a line with only `repro:` gets `quote: null` (the repro's quoted command is never read as the rule quote); a line with both fills both; existing `rule:` behavior unchanged.
- [ ] `.claude/tests/check-refuter.test.mjs` latches the new `repro:` sentence in the checker and still latches "never deletes or downgrades"; seen RED before the prompt edit.
- [ ] `plugins/ccf/evals/09-unruled-bug/` exists (`case.yaml`, `prompt.md`, `scaffold.sh`, `graders/*.md`): an off-by-one with a red test, no rule mentioning it; a regex grader `FAIL:[^\n]*repro:`; `bash scaffold.sh` builds the fixture repo in a temp dir and the grader is seen GREEN and RED on sample reports.
- [ ] `plugins/ccf/evals/04-rule-violation/graders/quoted-rule.md` is unchanged.

## Test first (write before implementing; confirm RED)
- `finding-verify.test.mjs` matrix for `parseFailFindings`: `rule:` only / `repro:` only / both / neither (still parsed, `quote` null, `repro` null) / `repro:` inside a fenced block (ignored) / malformed `repro:` without `->` (repro null).
- `check-refuter.test.mjs` latch red before editing the prompts.

## Files to touch
- `plugins/ccf/agents/ccf-spec-checker.md` — tier 2: rule quote OR `repro:`; FAIL line format gains `repro:`
- `plugins/ccf/commands/check.md` — step 6 merge condition
- `plugins/ccf/hooks/lib/finding-verify.mjs` — `parseFailFindings` extracts `repro`, reusing existing regex style
- `plugins/ccf/hooks/lib/finding-verify.test.mjs`
- `.claude/tests/check-refuter.test.mjs`
- `plugins/ccf/evals/09-unruled-bug/case.yaml` (new)
- `plugins/ccf/evals/09-unruled-bug/prompt.md` (new)
- `plugins/ccf/evals/09-unruled-bug/scaffold.sh` (new)
- `plugins/ccf/evals/09-unruled-bug/graders/*.md` (new)

## Known risk
`finding-verify.mjs` falls back to the first double-quoted span as `quote`; a `repro:`-only line would be misread as a rule quote. Split the fields.

## Steps
1. Write the failing tests. 2. Implement minimally. 3. Run the gate; GREEN → `in-review`. 4. `/ccf:check` → `/ccf:updatespec`.
