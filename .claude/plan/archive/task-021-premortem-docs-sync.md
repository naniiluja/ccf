# Task 021 — Spec + docs sync for the premortem lens (no count change)

- **Vertical slice:** docs sync — document the premortem lens everywhere plan-review / `ccf-spec-checker` is described; counts unchanged.
- **Depends on:** 020 (sync docs only after the behavior wording is final).
- **Spec refs:** `git-workflow.md` ("syncing on plugin structure changes"; README divergence = drift); `hooks.md` (plan-review-gate entry); `architecture.md`; `components.md`.
- **Implemented by:** ccf-implementer. **Test discipline:** off (docs slice — grep + validate + re-read).
- **Gate (closes the iteration):** grep `premortem` consistent across EVERY plan-review invoker/description — `ccf-spec-checker.md`, `ccf-plan.md`, `ccf-init.md`, `.claude/rules/hooks.md` + `architecture.md`, BOTH the agent table AND the plan-review-gate hook table in the 3 READMEs, `plugins/ccf/README.md`, `CLAUDE.md`; counts stay 6/6/6/1 with no new wrong count; `claude plugin validate`; `npx -p typescript tsc --noEmit` exit 0; `node --test` all green (regression; baseline 107/107); cross-read.

## Goal (one sentence)
Every doc that describes plan-review / `ccf-spec-checker` mentions the premortem lens (agent table + hook table + rules + CLAUDE.md), with counts unchanged, so the docs match the behavior shipped in 020.

## Acceptance criteria (verifiable)
- [ ] `.claude/rules/hooks.md`: the `plan-review-gate` entry notes the review now includes a premortem lens anchored to `PLAN.md` "Closed" + memory; gate MECHANISM unchanged (still keys on `ccf-spec-checker`, still 1 review).
- [ ] `.claude/rules/architecture.md`: one sentence — `ccf-spec-checker` plan-review includes a premortem (prospective-hindsight anchored to history) + rationale (criteria-decomposition + grounded self-critique); placed BY FIT (near the `ccf-plan`/review flow or beside "Deterministic vs prompt"), NOT under "Command ↔ agent boundary".
- [ ] `README.md` + `README.vi.md` + `README.zh-CN.md`: update BOTH the agent-table `ccf-spec-checker` row (add "premortem / prospective-failure") AND the `plan-review-gate` hook-table row (note "review now includes a premortem lens; gate mechanism unchanged") in ALL three languages.
- [ ] `plugins/ccf/README.md`: if it lists `ccf-spec-checker` → update the description.
- [ ] `CLAUDE.md`: "Current plan" updated to the premortem iteration (tasks 020–021); if the agent enumeration describes `ccf-spec-checker`, add premortem (counts unchanged 6/6/6/1).
- [ ] `.claude/plan/PLAN.md`: the "Origin — premortem-reviewer iteration (tasks 020–021)" + backlog table present and accurate; add the "Closed" section at iteration end. Do NOT touch the 017–019 entries.
- [ ] Scope-exclusion (STATED, to close the audit loop): `ccf-check.md:17` and `tooling.md.tmpl:22` NOT touched — they describe `ccf-spec-checker`'s CODE-review mode, not plan-review; premortem is plan-review only.
- [ ] Counts stay 6 cmd / 6 agent / 6 hook / 1 skill.

## Test first (write before implementing)
N/A (docs slice). The "failing test" stated first: BEFORE, `premortem` appears only in `ccf-spec-checker.md`/`ccf-plan.md`/`ccf-init.md` (from 020) and NOT in the rules/READMEs/CLAUDE.md; AFTER, the grep is consistent across all listed files and no stale plan-review description remains. Verify BOTH states.

## Files to touch
- `.claude/rules/hooks.md`, `.claude/rules/architecture.md`
- `README.md`, `README.vi.md`, `README.zh-CN.md`
- `plugins/ccf/README.md`
- `CLAUDE.md`
- `.claude/plan/PLAN.md`

## Steps (thin end-to-end slice)
1. Confirm before-state grep (`premortem` absent from rules/READMEs/CLAUDE.md).
2. Update the two rules + CLAUDE.md.
3. Update the 3 READMEs (BOTH tables) + `plugins/ccf/README.md`.
4. Ensure `PLAN.md` Origin/backlog accurate; grep-consistency + `validate` + `tsc` + `node --test`; cross-read.
5. Mark `in-review`; `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec` sets `done` (+ saves the premortem-reviewer memory).

## Notes / best-practice sources
A spec change that leaves any doc describing plan-review stale IS drift (`git-workflow.md`). The 3 READMEs describe the capability TWICE (agent table + hook table) — updating only one is the exact count-drift class (005–009) the premortem itself is built to catch, so update BOTH.
