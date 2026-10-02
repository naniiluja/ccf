# Task 080 — Spec, README, counts and ccf-budget sync

- **Vertical slice:** docs + spec sync for 075 to 079
- **Depends on:** 078, 079
- **Spec refs:** `CLAUDE.md` core invariants (size, ccf-budget); `.claude/rules/prompt-standard.md` (style-block copies, codepoint scan); `.claude/rules/components.md`.
- **MCP to use:** none
- **discipline:** off
- **Gate:** all 3 suites + tsc + `claude plugin validate plugins/ccf` + codepoint scan + md5 of all 9 style-block copies.

## Goal (one sentence)
Every count and rule reflects 6 agents, 9 `run_in_background: false` lines, 9 style-block copies, 8 eval cases and the skill `references/` convention.

## Changes
- Agent count 5 to 6 everywhere; add `ccf-finding-refuter` to the model/effort/maxTurns notes in components.md.
- `run_in_background: false` lines 8 to 9 (`check.md` 1 to 2); style-block copies 8 to 9.
- `${CLAUDE_PLUGIN_ROOT}` in a skill body: OBSERVED expanding (2026-10-02), replacing "documented, NOT yet observed".
- Skill `references/` convention: move only conditional content.
- Eval cases 7 to 8; new tests listed in testing.md.
- Re-measure ccf-budget and update its label.

## Acceptance criteria (verifiable)
- [ ] `grep -rn "5 agents\|all 5\|5 CCF agents"` hits only historical context.
- [ ] md5 matches on all 9 style-block copies.
- [ ] The codepoint scan in prompt-standard.md exits 0.
- [ ] All 3 suites, tsc and validate are green.
- [ ] `wc -lc CLAUDE.md` under 200 lines and under 12KB.

## Files to touch
- `CLAUDE.md`
- `.claude/rules/architecture.md`
- `.claude/rules/components.md`
- `.claude/rules/prompt-standard.md`
- `.claude/rules/testing.md`
- `README.md`
- `.claude/plan/PLAN.md`

## Carried from `/ccf:check` of 075-077 (WARN, 2026-10-02)
- `plugins/ccf/skills/plan/references/jev-slice-check.md`: loaded through `Read`, so `${CLAUDE_PLUGIN_ROOT}` is never substituted there and the Glob fallback is the only working path. Record it in the `${CLAUDE_PLUGIN_ROOT}` note (substitution covers the skill body, not its `references/`), or switch to a path relative to the skill base directory.
- `.claude/tests/descriptions.test.mjs`: asserts only "Read-only"; each agent's other limits ("does NOT fix code", "writes no files", "Proposes no solutions") are unguarded. Consider a per-file limit table.
- `plugins/ccf/skills/plan/SKILL.md`: says "next to this file" while `grill-me` says "this skill's base directory"; use the base-directory wording in both when writing the `references/` convention.
- `plan-waves.mjs` names the iteration after the FIRST `## Origin` in `PLAN.md`, so while lifecycle-cleanup is still there wave branches read `worktree-ccf-lifecycle-cleanup-tasks-NNN`. Harmless (preflight matches by id); retiring that iteration fixes it.
