# Task 075 — grill-me: `references/init-mode.md`, Gotchas, trigger-style description

- **Vertical slice:** `grill-me` skill body split + Gotchas + description, with its own offline test
- **Depends on:** —
- **Spec refs:** code.claude.com/docs/en/slash-commands (keep `SKILL.md` under 500 lines; supporting files linked from `SKILL.md` load only when needed); `.claude/rules/components.md` (skill rules, YAML `": "` trap, `AskUserQuestion` pairing); `.claude/rules/prompt-standard.md`; `.claude/rules/coding-conventions.md` (no comments in new code).
- **MCP to use:** none
- **discipline:** off
- **Gate:** `node --test .claude/tests/*.test.mjs` and `claude plugin validate plugins/ccf` (if the `claude` CLI is unavailable in your environment, say so in the report; do not skip the test suite).

## Goal (one sentence)
`grill-me` loads the `init` decision tree only in `init` mode, carries a sourced `## Gotchas` section, and its `description` states when to use it.

## Changes
- Move the `### init` section's decision tree, items (a) through (l) including (e2), VERBATIM into `plugins/ccf/skills/grill-me/references/init-mode.md`.
- The `### init` section keeps one line: "Read `references/init-mode.md` (relative to this skill's base directory) and walk it."
- Add a `## Gotchas` section. Every bullet cites its source (a `.md` file or a `task NNN`), e.g.:
  - A question asked outside the skill silently dies when the command's `allowed-tools` lacks `AskUserQuestion` (`.claude/rules/components.md`).
  - Bundling several questions in one ask returns shallow answers (discipline 1 of this skill).
- `description` opens with "Use when `/ccf:plan` or `/ccf:init` needs to interview the user…" and keeps the boundary "never triggered from ordinary conversation".
- Keep `user-invocable: false`. Change nothing else in the skill.

## Acceptance criteria (verifiable)
- [ ] `plugins/ccf/skills/grill-me/SKILL.md` is at most 4,500 bytes.
- [ ] `references/init-mode.md` contains every label (a) through (l), including (e2).
- [ ] `SKILL.md` links to `references/init-mode.md`.
- [ ] `SKILL.md` has `## Gotchas`, and every bullet in it matches `/\.md|task \d{3}/`.
- [ ] `description` matches `/^"?Use when/`, is at most 1,536 characters, and has no `": "` unless the scalar is quoted.
- [ ] `user-invocable: false` is kept.

## Test first (write before implementing; confirm RED)
- `.claude/tests/skill-grill-me.test.mjs`: reads the files with `readFileSync` and asserts each criterion above with `assert.match`/`assert.ok` (same style as `.claude/tests/parallel-cook.test.mjs`). No comments in the test.

## Manual try (not part of the gate)
Run `/ccf:init` on a scratch directory; confirm the model Reads `init-mode.md` and still asks (a) first.

## Files to touch
- `plugins/ccf/skills/grill-me/SKILL.md`
- `plugins/ccf/skills/grill-me/references/init-mode.md` (new)
- `.claude/tests/skill-grill-me.test.mjs` (new)
