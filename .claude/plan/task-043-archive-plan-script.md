# Task 043 — archive-plan script + Stop clause D

**Status:** in-review
**Depends on:** — (independent of cc-2.1.220-realign; touches no file that iteration still owns)
**Model:** opus (main loop, no implementer spawn — user asked directly)

## Origin
User asked for the plan-archive step to stop being prompt-only. Before this task, retiring a closed
iteration existed ONLY as prose in `commands/updatespec.md` step 6: if nobody ran `/ccf:updatespec`,
a closed iteration sat in `PLAN.md` and `lib/plan.mjs` counted its rows as live work. No hook, no
script, no detection.

User was offered two shapes and chose: **hook DETECTS, script MUTATES** (over a hook that writes by
itself), and **archive-only scope** (over a script owning the whole plan lifecycle).

## What was built
- `hooks/lib/archive.mjs` — the shared decision. Pure over lines, except `findRetirableIterationsIn`
  (defensive path reader for the hook). Exports `parseIterations`, `isRetirable`,
  `findRetirableIterations(In)`, `retirePlan`, `insertIntoArchive`.
- `hooks/lib/archive.test.mjs` — 21 tests.
- `scripts/archive-plan.mjs` — the CLI. Default previews; `--apply` performs. `--dir`, `--no-git`.
  A NEW artifact type (5th): a human-run script, documented in `architecture.md`.
- `hooks/updatespec-nudge.mjs` — clause **(D)**: nudge when a fully-closed iteration is still in
  `PLAN.md`, with the absolute command resolved from `import.meta.url`.
- `plan.mjs` — exported `collectTaskRows` + NEW `isClosedStatus` / `isRealTaskRow`, so archive and
  the Stop nudge share ONE definition of "closed". `findNonDoneTasks` now uses them (no behavior change).
- Spec sync: `architecture.md` (artifact type 5), `hooks.md` (clause D + archive.mjs; task-039
  measurements moved OUT to keep the file from growing unchecked), `tooling.md` (when-to-use),
  `testing.md` (count), `updatespec.md` step 6 (points at the script), `CLAUDE.md`, 3 READMEs.

## Design decisions worth keeping
1. **Positional grouping, not by name.** An iteration = `## Origin` to the next `## Origin`. Found
   by reading the repo's real `ARCHIVE.md`: `## Origin — bestpractice-audit → advisor+goal docs → …`
   sits above `## Task backlog — bestpractice-audit + advisory/goal + SubagentStop-gate`, and one
   backlog heading is the bare `## Task backlog (in execution order)`. Name matching would have cut
   the wrong lines. The first design was name-based and was discarded before any code was written.
2. **`isRetirable` requires `rows.length > 0`.** `[].every(...)` is vacuously true, so a new
   iteration with no backlog table yet would read "fully closed" and be archived instantly.
3. **ARCHIVE.md is written BEFORE PLAN.md is trimmed.** An interrupted run duplicates history
   (recoverable) instead of deleting it (not).
4. **The script does NOT trim `CLAUDE.md`'s `## Current plan`** — it prints that as the remaining
   manual step. Picking the new lead iteration is judgment.
5. **No commit.** `git mv` stages; committing stays the user's call.

## Gate — actually run, results below
- `node --test plugins/ccf/hooks/lib/*.test.mjs` → **227 pass, 0 fail** (206 → 227, +21).
  Test-first: the suite failed with `ERR_MODULE_NOT_FOUND` before `archive.mjs` existed.
- `npx -p typescript tsc --noEmit` → exit 0.
- `claude plugin validate plugins/ccf` → Validation passed.
- Hook smoke, 4 cases spawned as a real child process: closed iteration → nudge with absolute path;
  `in-review` row → clause D silent; `stop_hook_active:true` → silent; empty/`null`/garbage stdin →
  exit 0, no crash. Dual-channel (`--dual-channel-stop`) verified to carry both channels.
- **Script verified against REAL data on a COPY**, not on fixtures: `.claude/plan/` was copied to a
  sandbox, the 4 `in-review` rows flipped to `done`, `--apply` run. Result: PLAN.md 15987 → 1225
  bytes, ARCHIVE.md 71513 → 86276, total 87500 → 87501 (the +1 is the normalized trailing newline —
  no content lost), 6 task files moved, and the retired 12410-character iteration text confirmed
  present VERBATIM in ARCHIVE.md, inserted below `## Residual risk` and above the older iteration
  (newest-first preserved). `--check` against the real live PLAN.md correctly reports
  `4 of 6 task(s) still open: 038, 039, 040, 041`.

## Why this is `in-review`, not `done`
`/ccf:check` and `/code-review` have not run. Per CCF law only `/ccf:updatespec` writes `done`, and
only after both pass. Note `/code-review` may be unavailable on this harness (the `review` skill
accepts a GitHub PR only) — if so, say it plainly rather than marking `done` anyway.

## Known cost, stated not hidden
`.claude/rules/hooks.md` grew NET +1499 bytes (36169 → 37668) even after the task-039 measurements
were moved out, and the whole per-session spec set went 85744 → 89790 bytes. `CLAUDE.md` stays
inside its gate (58 lines / 8465 bytes). The standing proposal to split `hooks.md` by event is now
more urgent, not less; it was deliberately NOT done here (scope, and a bad split breaks `@import`).
