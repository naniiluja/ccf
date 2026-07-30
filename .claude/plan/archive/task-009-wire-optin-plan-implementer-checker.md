# Task 009 — Wire opt-in into `/ccf-plan` + discipline awareness in implementer/spec-checker

- **Vertical slice:** 2 command prompts (`ccf-plan`) + 2 agent prompts (`ccf-implementer`, `ccf-spec-checker`) — the wiring that makes the discipline actually flow through a plan
- **Depends on:** 008 (serial queue; the gate + command + templates must exist before wiring the opt-in that points at them)
- **Spec refs:** `ccf-plan.md` step 5 (plan output) / step 6 (MANDATORY review gate before ExitPlanMode); `hooks.md` (`plan-review-gate` DENIES `ExitPlanMode` until a `ccf-spec-checker` review is in the transcript — keyed on `subagent_type`); `ccf-implementer.md` (verification-first process); `ccf-spec-checker.md` (test-coverage dimension)
- **Implemented by:** ccf-implementer + MCP none
- **Gate (must be GREEN before the next slice):** try-it 3 scenarios PASS (see Test first); cross-references consistent (testing.md ↔ ccf-test ↔ implementer ↔ spec-checker ↔ ccf-plan); no spec drift; the ship-fast path is NOT forced to test; the `plan-review-gate` hook is NOT broken by the new question's placement

## Goal (one sentence)
Make `/ccf-plan` ask — placed within/after step 5 plan-output and BEFORE step 6's review gate — whether to adopt the test discipline for this plan; if yes, every task gate must include the matrix tests + a test run, and `ccf-implementer`/`ccf-spec-checker` enforce the contract-level matrix only when the discipline is ON.

## Acceptance criteria (verifiable)
- [ ] `ccf-plan.md` gains the opt-in question positioned within/after step 5 (plan output), BEFORE step 6 (review gate) — so it does NOT sit between the spec-checker review and ExitPlanMode (which would let `plan-review-gate` re-deny / confuse the sequence).
- [ ] When discipline ON: each task's gate must name matrix tests (EP/BVA/decision-table) + an actual test run; when OFF: plans behave exactly as today (ship-fast unaffected).
- [ ] `ccf-implementer.md`: when discipline ON → write the contract-level EP/BVA/decision-table matrix BEFORE writing tests; when OFF → unchanged.
- [ ] `ccf-spec-checker.md`: when discipline ON → verify matrix coverage of the contract; when OFF → existing test-coverage check unchanged.
- [ ] Cross-references are consistent across testing.md ↔ ccf-test ↔ implementer ↔ spec-checker ↔ ccf-plan.

## Test first (write before implementing)
- Try-it (concrete, not just read-confirm):
  1. Run `/ccf-plan` on a sample feature with discipline = ON → the opt-in question fires at the correct point; after the `ccf-spec-checker` review runs, `ExitPlanMode` is STILL allowed (the `plan-review-gate` hook does not re-deny because the question did not erase the review trace).
  2. Discipline = ON → the produced task gates include matrix tests + a test run; implementer/spec-checker prompts enforce the matrix.
  3. Discipline = OFF → no task is forced to test; implementer/spec-checker behave as today.

## Files to touch
- `plugins/ccf/commands/ccf-plan.md` — add the opt-in question at the correct step; gate-content rule when ON.
- `plugins/ccf/agents/ccf-implementer.md` — matrix-before-tests step gated on discipline ON.
- `plugins/ccf/agents/ccf-spec-checker.md` — matrix-coverage check gated on discipline ON.

## Steps (thin end-to-end slice)
1. Write the 3 try-it scenarios as the verification target.
2. Insert the opt-in question into `ccf-plan.md` at the verified position (after step 5, before step 6).
3. Add the discipline-gated steps to implementer + spec-checker.
4. Try-it all 3 scenarios; confirm the `plan-review-gate` hook still allows ExitPlanMode after review; confirm ship-fast is untouched.
5. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
`hooks.md` plan-review-gate: keyed on `subagent_type` containing `ccf-spec-checker` — an extra question after the review does not erase the trace, so ExitPlanMode stays allowed. Anthropic Explore→Plan→Implement; opt-in keeps ship-fast flows free of mandatory tests (the user's explicit requirement).
