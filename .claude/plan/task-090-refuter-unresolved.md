# Task 090 — Refuter `UNRESOLVED` verdict, carried into the `accepted` risk row

- **Vertical slice:** `ccf-finding-refuter` return format + `check.md` step 6c + `updatespec.md` risk-row step + prompt latch
- **Depends on:** —
- **Spec refs:** `.claude/rules/prompt-standard.md` (review marker vocabulary, both ends move together); `.claude/rules/components.md` (reviewer agents); `check.md` is read-only.
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** `node --test .claude/tests/*.test.mjs`
- **Touches UI:** no
- **Runtime evidence:** not run: a prompt-contract change; the paid eval that would measure it is PENDING A6 and needs a sandbox-capable host

## Goal (one sentence)
When the refuter can neither disprove nor confirm a `FAIL:` because one fact is unobservable, it says which fact (`UNRESOLVED`), the `FAIL:` keeps standing, and `/ccf:updatespec` copies that fact into the `risk` row it writes when a task is `accepted`.

## Acceptance criteria (verifiable)
- [ ] The refuter's return format has exactly three verdict words, `REFUTED`, `STANDS` and `UNRESOLVED <file:line> — <the one fact that would settle it>`, and its decision step says when `UNRESOLVED` applies (a needed fact the refuter could not observe) and that no evidence still means `STANDS`.
- [ ] `check.md` step 6c leaves the `FAIL:` count unchanged for `UNRESOLVED` (the finding stands and is not downgraded), appends `Unresolved (ccf-finding-refuter): <fact>` to that `FAIL:` line, and keeps `/ccf:check` read-only.
- [ ] `updatespec.md`, in the step that writes the `risk` row before marking `accepted`, tells the model to put each `Unresolved (ccf-finding-refuter)` fact of the accepted task into the row's `What` cell.
- [ ] `.claude/tests/check-refuter.test.mjs` pins all three: the three verdict words in the agent, the unchanged count and the appended text in `check.md`, and the `updatespec.md` sentence; seen RED before the prompts change.

## Test first (write before implementing)
Extend `.claude/tests/check-refuter.test.mjs` with the four assertions above and run it red.

## Files to touch
- `plugins/ccf/agents/ccf-finding-refuter.md`
- `plugins/ccf/commands/check.md`
- `plugins/ccf/commands/updatespec.md`
- `.claude/tests/check-refuter.test.mjs`

## Steps (thin end-to-end slice)
1. Write the failing latch assertions
2. Edit the agent, `check.md` 6c and `updatespec.md`
3. Run the gate, mark the task `in-review` (NOT `done`)

## Notes / best-practice sources
Idea from cloudflare/security-audit-skill (verdicts `confirmed / needs_validation / rejected`; a finding is never checked by the agent that found it). Deliberately NOT a downgrade: see the Origin decisions in `PLAN.md`.
