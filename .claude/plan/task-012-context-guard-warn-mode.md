# Task 012 — context-guard.mjs in WARN mode, replacing context-nudge

- **Vertical slice:** new hook (`context-guard.mjs`) + lib (`context-usage.mjs` new `decideGuardAction`, drop `decideNudge`) + io helper (`emitPromptWarning`) + hooks.json wiring swap + tests + tsconfig
- **Depends on:** — (first slice)
- **Spec refs:** `hooks.md` (UserPromptSubmit I/O contract: `additionalContext` model-facing + `systemMessage` universal field; exit-code semantics; auto-load hooks.json); `architecture.md` (deterministic part = hook, not prompt); `coding-conventions.md` (pure helper + JSDoc, SRP, coerce untrusted input); `testing.md` (`node --test`, write failing test first); memory [[ccf-enforce-with-hook-not-prompt]]
- **Implemented by:** ccf-implementer + Context7 (only if a hook-schema question arises)
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs` green; `npx -p typescript tsc --noEmit` exit 0; stdin smoke (over-threshold → `{hookSpecificOutput:{additionalContext}, systemMessage}` JSON, exit 0; under-threshold → silent exit 0); the combined payload is ACCEPTED by `claude plugin validate` (no "Invalid input"); real-session visibility check (install locally, run past threshold, confirm the warning renders to the user)

## Goal (one sentence)
Replace the soft `PostToolUse` context-nudge with a `UserPromptSubmit` hook that, when context is over threshold, surfaces a non-blocking `/compact` warning through BOTH `systemMessage` (user) and `additionalContext` (model) every turn — deterministic, not dependent on model goodwill.

## Acceptance criteria (verifiable)
- [ ] NEW pure `decideGuardAction({ aboveThreshold, hardBlock, isEscape })` in `context-usage.mjs` → `"silent" | "warn" | "block"`; this slice only the `hardBlock:false` path (`aboveThreshold ? "warn" : "silent"`). JSDoc present.
- [ ] NEW `io.mjs` helper `emitPromptWarning(context, message)` → prints single JSON `{ hookSpecificOutput:{ hookEventName:"UserPromptSubmit", additionalContext:context }, systemMessage:message }` then `exit 0`.
- [ ] NEW `plugins/ccf/hooks/context-guard.mjs`: `readStdinJson` → `readContextUsage(transcript_path)`; `aboveThreshold = shouldNudgeCompact(tokens, windowSize)`; hint via `findActiveTask` + `buildCompactHint`; `decideGuardAction` (hardBlock false this slice) → on `"warn"` call `emitPromptWarning`, on `"silent"` exit 0. Best-effort: any read error → silent exit 0 (never break a session).
- [ ] `hooks.json`: remove the `PostToolUse → context-nudge.mjs` entry; ADD a second object to the existing `UserPromptSubmit` array → `node "${CLAUDE_PLUGIN_ROOT}/hooks/context-guard.mjs"` (timeout 10). Keep the existing `plan-mode-guard.mjs` entry.
- [ ] DELETE `plugins/ccf/hooks/context-nudge.mjs`; remove `decideNudge` from `context-usage.mjs` + its tests from `context-usage.test.mjs` (same commit as its only caller — no transitional dead code).
- [ ] `tsconfig.json`: `context-guard.mjs` covered by the `hooks/**/*.mjs` include; remove any explicit `context-nudge` include if present.

## Test first (write before implementing)
- `context-usage.test.mjs` RED first: `decideGuardAction` warn path — `{aboveThreshold:true, hardBlock:false}` → `"warn"`; `{aboveThreshold:false, hardBlock:false}` → `"silent"`.
- Remove the `decideNudge` tests in the same change (its caller is gone).

## Files to touch
- `plugins/ccf/hooks/lib/context-usage.mjs` (+ `context-usage.test.mjs`) — add `decideGuardAction`, drop `decideNudge`.
- `plugins/ccf/hooks/lib/io.mjs` — add `emitPromptWarning`.
- `plugins/ccf/hooks/context-guard.mjs` — NEW.
- `plugins/ccf/hooks/context-nudge.mjs` — DELETE.
- `plugins/ccf/hooks/hooks.json` — swap PostToolUse→context-nudge for UserPromptSubmit→context-guard.
- `tsconfig.json` — adjust includes if needed.

## Steps (thin end-to-end slice)
1. Write `decideGuardAction` warn-path tests RED; delete `decideNudge` tests.
2. Implement `decideGuardAction` (warn path) + `emitPromptWarning`; remove `decideNudge` → green.
3. Write `context-guard.mjs`; swap `hooks.json` wiring; delete `context-nudge.mjs`.
4. `tsc`; stdin smoke (over/under threshold, Windows path); `claude plugin validate` accepts the combined payload.
5. Real-session visibility check: install locally, run a session past threshold, confirm the user sees the warning.

## Notes / best-practice sources
`systemMessage` is the universal "Standard Output (All Hooks)" field (Context7 `/anthropics/claude-code`) — the user-facing surface; `additionalContext` rides alongside for the model. The combined `{hookSpecificOutput, systemMessage}` payload has no in-repo precedent → the validate + live gate proves it. Accepted KISS tradeoff: dropping PostToolUse loses mid-turn detection (warn only at the next prompt) — per-prompt firing is naturally rate-limited, so the temp-file dedup (`decideNudge`) is removed.
