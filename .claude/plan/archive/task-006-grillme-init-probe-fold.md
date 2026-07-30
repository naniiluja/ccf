# Task 006 — `grill-me` init probe + `/ccf-init` fold answer

- **Vertical slice:** skill (grill-me interview) + command (ccf-init fill step) — one end-to-end path: interview answer → template fill
- **Depends on:** 005 (the placeholders this task fills were added in 005)
- **Spec refs:** `components.md` (skill `description` narrow, `allowed-tools` least-privilege; grill-me has NO write tools — fill happens in ccf-init which has `Write`/`Edit`); `tooling.md` (grill-me how-to-call); the grill-me `init` mode decision tree (SKILL.md `(i) Testing strategy?`)
- **Implemented by:** ccf-implementer + MCP none
- **Gate (must be GREEN before the next slice):** grill-me dispatch consistent (one-question-at-a-time, recommend-with-question preserved); `ccf-init.md` has an EXPLICIT fill step (no longer implicit) mapping the answer → `testing.md.tmpl` placeholders; the grill-me/ccf-init write-boundary is respected (grill-me only asks, ccf-init folds)

## Goal (one sentence)
Turn grill-me's existing `(i) Testing strategy?` init probe into a sub-question that asks whether to adopt the test-design discipline (EP/BVA/decision-table, contract-level) and the enforcement level (prompt-only vs stop-hook gate), and add an explicit step in `ccf-init.md` that folds that answer into the `testing.md.tmpl` placeholders (and, if stop-hook chosen, into the hook template files from task 008).

## Acceptance criteria (verifiable)
- [ ] grill-me `init` `(i) Testing strategy?` now probes: framework/cmd/location/coverage (as today) PLUS "Adopt test-design discipline (EP/BVA/decision-table matrix, contract-level)?" PLUS "enforcement: prompt-only or stop-hook gate?" — recommend a default with one-line rationale, one question at a time.
- [ ] grill-me stays read/ask only (no write tool added to `SKILL.md:5` `allowed-tools`); the boundary is stated so the implementer doesn't grant it write powers.
- [ ] `ccf-init.md` (both EMPTY and EXISTING branches) gains an EXPLICIT step: map the testing answer → fill `{{TEST_MATRIX_REQUIRED}}`, `{{TEST_GATE_ENFORCEMENT}}`, `{{INTEGRATION_TEST_SCOPE}}`, `{{E2E_TEST_SCOPE}}` in `testing.md.tmpl`; if `TEST_GATE_ENFORCEMENT=stop-hook` → also instantiate `test-gate.mjs.tmpl` + `hooks.json.tmpl` (presence of the entry = gate ON). NOT settings.json.
- [ ] If opt-in OFF → ccf-init drops the discipline section (per task 005's HTML-comment guidance) and does NOT generate the hook files.

## Test first (write before implementing)
- Read-confirm scenario:
  1. Trace grill-me `init` → the testing probe surfaces the discipline + enforcement sub-questions, one at a time, with a recommended default.
  2. Trace `ccf-init.md` (both branches) → the fill step deterministically maps each answer to the right placeholder/file; opt-in OFF path generates today's sparse testing.md and no hook.
  3. Confirm `SKILL.md` `allowed-tools` is unchanged (no write tool).

## Files to touch
- `plugins/ccf/skills/grill-me/SKILL.md` — extend `init` decision `(i) Testing strategy?` (line ~57) with the discipline + enforcement sub-questions.
- `plugins/ccf/commands/ccf-init.md` — add the explicit testing-answer → template-fill step in both the EMPTY (A) and EXISTING (B) branches.

## Steps (thin end-to-end slice)
1. Write the read-confirm scenarios above.
2. Extend the grill-me `init` testing probe (ask-only, recommend-with-question).
3. Add the explicit fill step to ccf-init (both branches); state the grill-me-asks / ccf-init-folds boundary.
4. Read-confirm consistency end-to-end (answer → fill → generated files).
5. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
grill-me discipline (one question at a time, explore-then-ask, recommend-with-every-question). Anthropic: persist test discipline in `.claude/rules/testing.md` (`code.claude.com/docs/en/best-practices`). Write boundary: skills are least-privilege; the writing command is the one with `Write`/`Edit`.
