# Task 020 — Premortem lens in ccf-spec-checker + wire ccf-plan/ccf-init review gates

- **Vertical slice:** behavior — add a premortem / prospective-failure lens to `ccf-spec-checker`'s plan-review mode; the two commands that spawn the plan-review (`ccf-plan` step 6 + `ccf-init` A4 gate) request it and loop on H-likelihood findings, recording each H-finding's disposition. End-to-end tracer: a fresh `ccf-spec-checker` plan-review returns a `🔮 Premortem` block anchored to a real `PLAN.md` "Closed" entry.
- **Depends on:** — (head of queue).
- **Spec refs:** `architecture.md` ("deterministic part vs prompt part" — judgment → prompt, NOT a hook); `components.md` (agent SRP/length, `description` = trigger); `ccf-plan.md` step 6; `ccf-init.md` A4 gate; `plan-review-gate.mjs` + `review-trace.mjs:71` (gate keys on `subagent_type` contains "ccf-spec-checker" → NO hook change). Grounding (SOTA, done at planning): Anthropic "building effective agents" (evaluator-optimizer; *add complexity only when it demonstrably improves outcomes*), criteria-decomposition (AIME), PreFlect / prospective-hindsight (anchor to REAL history), LLMs-cannot-self-correct-without-grounding. Memory: [[ground-claude-facts-primary-not-blog]], [[ccf-enforce-with-hook-not-prompt]].
- **Implemented by:** ccf-implementer. **Test discipline:** off (prose slice — verify by grep + validate + re-read + dogfood).
- **Gate (GREEN before 021):** grep wording in `ccf-spec-checker.md` + `ccf-plan.md` + `ccf-init.md` (`premortem`, `Closed`, `🔮 Premortem`, `disposition`); `claude plugin validate plugins/ccf` passed; `npx -p typescript tsc --noEmit` exit 0; cross-read for no SRP bloat; **DOGFOOD verify in MAIN session** (spawn a fresh `ccf-spec-checker` plan-review → confirm a `🔮 Premortem` block anchored to a real "Closed" entry).

## Goal (one sentence)
`ccf-spec-checker`'s plan-review mode emits a premortem (top failure modes anchored to this project's `PLAN.md` "Closed"/memory, each with a preventing change), and both `ccf-plan` + `ccf-init` request it and resolve H-likelihood findings before ExitPlanMode — with NO hook change and counts unchanged (6/6/6/1).

## Acceptance criteria (verifiable)
- [ ] `ccf-spec-checker.md` `description` frontmatter adds "...including a **premortem / prospective-failure** lens anchored to past iterations".
- [ ] `ccf-spec-checker.md` "Plan-review mode" gains a premortem procedure: after the structural critique, read **this project's `.claude/plan/PLAN.md` "Closed"/postmortem sections + any project memory IF PRESENT**; assume the plan shipped and FAILED in 3 months; list **2–4** most-likely failure modes, each anchored to a real past failure where one exists, each with **one** concrete preventing plan change; a HIGH-likelihood failure with no mitigation = ❌.
- [ ] `ccf-spec-checker.md` return format gains `### 🔮 Premortem (prospective failures)` with line shape `- <failure mode> — likelihood (H/M/L) — anchor: <past iteration | none> — preventing change`.
- [ ] `ccf-plan.md` step 6: the mandatory review now includes the premortem lens; the loop resolves every H-likelihood premortem finding (fix or knowingly accept) before ExitPlanMode AND records each H-finding's **disposition** (`fixed-by …` / `accepted-because …`).
- [ ] `ccf-init.md` A4 review gate (~line 47): same premortem + H-disposition wording added (it is the **second invoker** of the same plan-review).
- [ ] NO hook/agent-count change: counts stay 6 cmd / 6 agent / 6 hook / 1 skill; `plan-review-gate.mjs` / `review-trace.mjs` untouched.

## Test first (write before implementing)
N/A (prose slice). The "failing test" stated first: BEFORE, a `ccf-spec-checker` plan-review returns NO `🔮 Premortem` block and `PLAN.md` "Closed" is never read; AFTER, a fresh plan-review returns a `🔮 Premortem` block anchored to a real "Closed" entry, and grep finds the premortem wording in all three files. Verify BOTH states (the dogfood spawn is the after-proof).

## Files to touch
- `plugins/ccf/agents/ccf-spec-checker.md`
- `plugins/ccf/commands/ccf-plan.md`
- `plugins/ccf/commands/ccf-init.md`

## Steps (thin end-to-end slice)
1. Edit `ccf-spec-checker.md` (description + plan-review premortem procedure + return-format block).
2. Edit `ccf-plan.md` step 6 + `ccf-init.md` A4 gate (request premortem + H-disposition recording).
3. grep wording; `claude plugin validate`; `tsc --noEmit`; cross-read for SRP.
4. **DOGFOOD (MAIN session, not inside the implementer):** spawn a fresh `ccf-spec-checker` plan-review on `PLAN.md`/any plan → confirm `🔮 Premortem` anchored to a real "Closed".
5. Mark `in-review` (NOT `done`). 021 starts only after this gate is GREEN.

## Notes / best-practice sources
Premortem = a SECTION inside `ccf-spec-checker` (not a new agent / second pass): the gate (`review-trace.mjs:71`) keys on `subagent_type` "ccf-spec-checker" so it auto-recognizes the review with 0 hook edits; count unchanged; mandatory by construction. Soft-gate via the existing step-6 loop, NOT a deterministic hook (a hook can't judge premortem QUALITY — `architecture.md` "judgment → prompt"). Dogfood lag accepted: the new instruction is not active on plan 020 itself; the in-session dogfood spawn (agent `.md` is re-read each spawn) is the real proof.
