# Task 003 — Verify-work Stop nudge (hook + helper + test)

- **Vertical slice:** hook (`updatespec-nudge.mjs`) + pure lib helper + unit test
- **Depends on:** 002 (serial queue, not a logical dependency)
- **Spec refs:** `hooks.md` (Stop = `emitSystemMessage`, NEVER block; check `stop_hook_active`; transcript `.jsonl` read BEST-EFFORT → null/silent on error; decision logic in a pure helper + `node --test`; state before gate if any), `testing.md` (verification-first)
- **Implemented by:** ccf-implementer + MCP Context7 (look up Stop-hook schema if needed)
- **Gate (must be GREEN before the next slice):** `node --test` (incl. new helper) + `npx -p typescript tsc --noEmit` exit 0 + smoke covers 4 combinations

## Goal (one sentence)
When this session edited code (Write/Edit on code files) but no test command ran, nudge "verify your work" at Stop — using SESSION evidence from the transcript, independent of the existing spec-staleness nudge.

## Acceptance criteria (verifiable)
- [ ] Verify signal is derived from the SESSION transcript (edited-code ∧ ¬ran-tests), NOT from `specsOlderThanCode`.
- [ ] The two clauses are INDEPENDENT — neither gates the other — composed into one `emitSystemMessage` (Stop has a single non-blocking channel); both off → silent.
- [ ] Decision logic lives in a PURE helper with `node --test` tests.
- [ ] `node --test plugins/ccf/hooks/lib/*.test.mjs` green (incl. new tests).
- [ ] `npx -p typescript tsc --noEmit` exit 0.
- [ ] Hook never crashes on empty/malformed/missing transcript; still advisory `exit 0`; keeps `stop_hook_active` guard.

## Test first (write before implementing)
- `verify-trace.test.mjs` (`node --test`) for the pure decision: edited+notest → nudge; edited+tested → no nudge; no-edit → no nudge; bad/empty input → no nudge (never throws).
- Smoke `updatespec-nudge.mjs` with sample stdin covering 4 combos (verify on/off × updatespec on/off): pipe `{stop_hook_active:false, cwd, transcript_path}` → correct composed message.
- Empty/broken transcript → no crash, exit 0, silent.

## Files to touch
- `plugins/ccf/hooks/lib/verify-trace.mjs` — NEW pure helper: `needsVerifyNudge({editedCode, ranTests})` (pure) + `readTranscriptSignals(transcriptPath)` best-effort `.jsonl` reader detecting (1) edit/write of code files, (2) a test command run; error/empty → false/null, never throw. Follow `review-trace.mjs` / `context-usage.mjs` pattern.
- `plugins/ccf/hooks/lib/verify-trace.test.mjs` — NEW unit tests for the pure decision.
- `plugins/ccf/hooks/updatespec-nudge.mjs` — read `transcript_path`, call helper, compose 2 independent clauses (A verify, B updatespec) into one `emitSystemMessage`; keep `stop_hook_active` + `exit 0`.
- `tsconfig.json` — VERIFY the `include` glob actually matches `hooks/lib/verify-trace.mjs` (don't assume); add if not. `.test.mjs` already excluded.

## Steps (thin end-to-end slice)
1. Write `verify-trace.test.mjs` (failing) for the pure decision first.
2. Implement `verify-trace.mjs` (pure decision + best-effort reader) to pass it.
3. Wire into `updatespec-nudge.mjs` composing the 2 independent clauses.
4. Smoke the 4 combos + run `node --test` + `tsc`. Gate must be GREEN.
5. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
shanraisshan repo — "End-of-Turn Nudges" (Stop hooks prompt Claude to verify work). CCF `hooks.md` Stop contract (`emitSystemMessage`, never block) + the `state-before-gate` / best-effort-transcript invariants from existing libs.
