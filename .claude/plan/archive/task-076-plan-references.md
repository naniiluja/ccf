# Task 076 — plan skill: `references/` for Jev and step 5b, Gotchas

- **Vertical slice:** `plan` skill body split of conditional-only content + sourced Gotchas, with its own offline test
- **Depends on:** —
- **Spec refs:** code.claude.com/docs/en/slash-commands (supporting files load only when needed); `.claude/rules/components.md`; `.claude/rules/prompt-standard.md` (style block, codepoint policy); `.claude/rules/coding-conventions.md` (no comments in new code).
- **MCP to use:** none
- **discipline:** off
- **Gate:** `node --test .claude/tests/*.test.mjs` and `claude plugin validate plugins/ccf` (if the `claude` CLI is unavailable, say so in the report).

## Goal (one sentence)
`plan/SKILL.md` moves only its conditional content (the Jev paragraph of step 5 and the body of step 5b) into `references/`, gains a sourced `## Gotchas` section, and does not grow.

## Changes
- Move the Jev paragraph of step 5 (about 1,068 bytes) to `plugins/ccf/skills/plan/references/jev-slice-check.md` and the body of step 5b (about 846 bytes) to `plugins/ccf/skills/plan/references/test-discipline.md`.
- Keep the `### 5b` heading, the literal string `discipline: on`, and a one-line read condition for each moved part, e.g. "When `TYPESAFE_API_KEY` is set, read `references/jev-slice-check.md`".
- Do NOT touch step 0, the style block (md5 `deac0ef73d3c0cb9d26766027a906385`), any step number other files cite, or the model-choice rules of steps 1b and 6 (they are read every time).
- Add `## Gotchas`, every bullet citing its source:
  - A spawn returns the async ack even with `run_in_background: false`; wait for each completion notification (`architecture.md`, observed in task 073).
  - A status cell written `**done**` was once read as open (`hooks.md`, task 036).
  - A closed row left in PLAN.md is counted as live work (`CLAUDE.md`; e.g. 074 still read `todo` after its merge).
  - A wrong `Files to touch` makes the preflight report `out-of-scope` (`tooling.md`, worktree-preflight).
  - The YAML `": "` trap (`components.md`, task 045).
  - A latch never seen RED proves nothing (`testing.md`, task 050).

## Acceptance criteria (verifiable)
- [ ] `plugins/ccf/skills/plan/SKILL.md` is at most 15,749 bytes (Gotchas included).
- [ ] Both `references/` files exist, and each is linked from `SKILL.md` with its read condition.
- [ ] Headings `## 0.` through `## 7.` and `### 5b` still exist.
- [ ] The style block is byte-identical (md5 `deac0ef73d3c0cb9d26766027a906385`).
- [ ] `discipline: on` is present.
- [ ] `## Gotchas` has at least 5 bullets, each with a source (`/\.md|task \d{3}/`).
- [ ] `description` still matches `/^"?Use when/`.
- [ ] The count of `run_in_background: false` lines in `SKILL.md` is unchanged (2).

## Test first (write before implementing; confirm RED)
- `.claude/tests/skill-plan.test.mjs`: `readFileSync` + `assert`, one case per criterion. To check the style block md5, locate it the same way `.claude/rules/prompt-standard.md` describes (read that file for the block's delimiters) and hash it with `node:crypto`. No comments in the test.

## Files to touch
- `plugins/ccf/skills/plan/SKILL.md`
- `plugins/ccf/skills/plan/references/jev-slice-check.md` (new)
- `plugins/ccf/skills/plan/references/test-discipline.md` (new)
- `.claude/tests/skill-plan.test.mjs` (new)
