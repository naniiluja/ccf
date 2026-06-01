# Task 013 — HARD BLOCK mode + escape hatch (opt-in via --hard-block arg)

- **Vertical slice:** lib (`decideGuardAction` block branch) + hook (`context-guard.mjs` argv + escape + exit 2) + tests
- **Depends on:** 012 (extends the warn-mode hook + helper)
- **Spec refs:** `hooks.md` (exit 2 = blocking, `blockUserPrompt`; "presence of the hooks.json entry IS the toggle" convention); `coding-conventions.md` (coerce untrusted prompt via `String(...)`, pure helper + JSDoc); `testing.md` (EP/BVA decision-table, test first)
- **Implemented by:** ccf-implementer + MCP none
- **Gate (must be GREEN before the next slice):** `node --test` (full `decideGuardAction` decision-table) green; `tsc --noEmit` exit 0; stdin smoke — with `--hard-block` + over-threshold normal prompt → exit 2 + stderr; with `--hard-block` + `/compact …` → exit 0 (warn); WITHOUT `--hard-block` → never exit 2

## Goal (one sentence)
When `context-guard.mjs` is wired with `--hard-block` and context is over threshold, deterministically `exit 2`-block the prompt with a visible warning, UNLESS the prompt is an escape (`/compact` prefix or `ccf:override` token).

## Acceptance criteria (verifiable)
- [ ] `decideGuardAction` extended: `hardBlock && aboveThreshold && !isEscape` → `"block"`; `hardBlock && aboveThreshold && isEscape` → `"warn"` (surface, don't block the compact itself); all `!hardBlock` and `!aboveThreshold` paths unchanged from 012.
- [ ] `context-guard.mjs`: `hardBlock = process.argv.includes("--hard-block")`; `isEscape` from `String(input.prompt ?? "")` — true if it starts with `/compact` (case-insensitive, trimmed) OR contains `ccf:override` (case-insensitive); on `"block"` call `blockUserPrompt(reason)` (exit 2) with the `/compact` hint in the reason.
- [ ] Toggle is the `--hard-block` arg in `hooks.json` only — NO env var, NO settings.json flag (matches CCF convention).

## Test first (write before implementing)
- `context-usage.test.mjs` RED: full decision-table for `decideGuardAction` over `{hardBlock × aboveThreshold × isEscape}` (8 rows) → silent/warn/block. Assert: never `"block"` when `!hardBlock`; never `"block"` below threshold; escape → `"warn"` not `"block"`.

## Files to touch
- `plugins/ccf/hooks/lib/context-usage.mjs` (+ `context-usage.test.mjs`) — block branch.
- `plugins/ccf/hooks/context-guard.mjs` — argv read + isEscape + `blockUserPrompt`.

## Steps (thin end-to-end slice)
1. Write the full decision-table tests RED.
2. Extend `decideGuardAction` block branch → green.
3. Wire `process.argv` + `isEscape` + `blockUserPrompt` into `context-guard.mjs`.
4. `tsc`; stdin smoke (3 cases above, Windows path).

## Notes / best-practice sources
exit 2 (`blockUserPrompt`) is the only deterministic block per Context7 `/anthropics/claude-code`. The `--hard-block` argv toggle mirrors the established CCF pattern (hooks.md template-shipped hooks: hooks.json entry = the switch), avoiding the un-grounded env-propagation risk on Windows. Known minor limitation: a prompt that merely *discusses* `ccf:override` in prose counts as an escape — acceptable (override is intentional), documented not guarded.
