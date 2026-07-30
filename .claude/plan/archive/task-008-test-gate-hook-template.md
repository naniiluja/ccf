# Task 008 — Stop-hook test-gate **template** for target projects (opt-in)

- **Vertical slice:** template hook (`.mjs.tmpl` + `hooks.json.tmpl`) + a real testable core `.mjs` lib + its `node --test` + tsconfig include
- **Depends on:** 007 (serial queue)
- **Spec refs:** `hooks.md` (I/O contract via `io.mjs`; CCF repo's own Stop hook is deliberately ADVISORY — `emitSystemMessage`; this is a DIFFERENT artifact); `testing.md` (pure logic → `node --test`, type-check via `tsc`); `coding-conventions.md` (JSDoc on the core lib, coerce untrusted stdin); Anthropic Stop-hook-as-gate (`exit 2`, 8-block safety valve, `stop_hook_active`) — `code.claude.com/docs/en/hooks-guide`, `/settings`
- **Implemented by:** ccf-implementer + MCP context7 (ground the hook-registration/toggle + settings schema before writing)
- **Gate (must be GREEN before the next slice):** `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` green (the dotted `.claude` segment must be spelled out — a `**` glob skips hidden dirs and silently matches nothing); `npx -p typescript tsc --noEmit` green (core lib now in `include`); smoke (pipe stdin JSON into the instantiated hook) → correct exit code (0 allow / 2 block); `claude plugin validate plugins/ccf` green; `hooks.json.tmpl` is valid JSON

## Goal (one sentence)
Provide an opt-in Stop-hook test-gate **template** that `/ccf-init` instantiates into a target project when the user chose stop-hook enforcement — it blocks (`exit 2`) the stop when the session edited code but tests FAILED or were not run — backed by a real, unit-tested pure decider so the logic is verified in the CCF repo.

## Acceptance criteria (verifiable)
- [ ] Pure decider `shouldBlockStop(signals)` (= `editedCode && (testFailed || !ranTests)`) lives at `plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.mjs` — a REAL `.mjs` (not `.tmpl`) so `node --test` runs; JSDoc present; coerces untrusted input; never throws.
- [ ] `plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.test.mjs` covers the EP of signals: editedCode × {testPassed, testFailed, noTest} → correct block/allow.
- [ ] `plugins/ccf/templates/root/.claude/hooks/test-gate.mjs.tmpl` — Stop hook that reuses the `verify-trace.mjs` + `io.mjs` PATTERN (content copied into the template; target project must be self-contained, NOT import from the CCF repo), imports/uses the core decider (single source — no DRY violation), checks `stop_hook_active`, and `exit 2` to block.
- [ ] Template carries a comment stating: this `exit 2` blocking hook is a DELIBERATELY different artifact from the CCF repo's advisory Stop hook (do not "fix" it to advisory); plus the 8-consecutive-block safety-valve + `stop_hook_active` loop-guard note.
- [ ] `plugins/ccf/templates/root/.claude/hooks/hooks.json.tmpl` — registers the Stop hook; its presence = gate ON (the toggle). Valid JSON.
- [ ] `settings.json.tmpl` is NOT used to toggle the hook (left as attribution-only; no self-invented flag).
- [ ] `tsconfig.json` `include` gains `plugins/ccf/templates/root/.claude/hooks/lib/**/*.mjs` (the `.tmpl` files are NOT added; `*.test.mjs` stays excluded by the existing global exclude).
- [ ] `.claude/rules/testing.md` (CCF repo) test-command list updated to add the `templates/*/.claude/hooks/lib/*.test.mjs` glob (NOT `**`, which skips the hidden `.claude` dir).

## Test first (write before implementing)
- Write `test-gate-core.test.mjs` RED first, asserting `shouldBlockStop` for each signal combination:
  - `{editedCode:true, ranTests:false}` → true (block)
  - `{editedCode:true, ranTests:true, testFailed:true}` → true (block)
  - `{editedCode:true, ranTests:true, testFailed:false}` → false (allow)
  - `{editedCode:false, ...}` → false (allow)
- Then implement `test-gate-core.mjs` to go green.
- Smoke the instantiated hook: pipe `{"stop_hook_active":false, ...}` → exit 2 when block, exit 0 when allow.

## Files to touch
- `plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.mjs` — NEW (real, type-checked, tested).
- `plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.test.mjs` — NEW (`node --test`).
- `plugins/ccf/templates/root/.claude/hooks/test-gate.mjs.tmpl` — NEW (Stop hook template, `exit 2`).
- `plugins/ccf/templates/root/.claude/hooks/hooks.json.tmpl` — NEW (registration = toggle).
- `tsconfig.json` — add the template-lib glob to `include`.
- `.claude/rules/testing.md` — add the templates `node --test` glob to the command list.

## Steps (thin end-to-end slice)
1. Context7-ground the hook-registration/toggle + settings schema; confirm presence-of-entry = enabled.
2. Write `test-gate-core.test.mjs` RED.
3. Implement `test-gate-core.mjs` (pure, JSDoc, defensive) → green.
4. Author `test-gate.mjs.tmpl` (copies io/verify-trace pattern, uses the core decider, `exit 2`, 8-block + `stop_hook_active` notes, "different-artifact" comment) + `hooks.json.tmpl`.
5. Add the tsconfig include glob + the testing.md command-list glob; run `tsc --noEmit` + both `node --test` globs.
6. Smoke the instantiated hook (stdin → exit code); `claude plugin validate plugins/ccf`.
7. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
Anthropic: Stop hook `exit 2` blocks until the gate passes; Claude Code overrides after 8 consecutive blocks; do NOT use `additionalContext` on Stop (use stderr for block) — `code.claude.com/docs/en/hooks-guide`, `/hooks`. Reuse the existing `verify-trace.mjs` (`needsVerifyNudge`/`readTranscriptSignals`) + `io.mjs` shape — but as a copied, self-contained target-project hook, and BLOCKING (the repo's is advisory). Pure decider + `node --test` per CCF testing law.
