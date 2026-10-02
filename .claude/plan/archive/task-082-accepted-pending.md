# Task 082 — `accepted` status + PENDING.md + session-start reminder

- **Vertical slice:** `lib/plan.mjs` + `session-start.mjs` + templates + `/ccf:init` + `/ccf:updatespec` step 6 + this repo's seeded `PENDING.md`
- **Depends on:** —
- **Spec refs:** `.claude/rules/hooks.md` (I/O contract, never crash, `CLOSED_STATUS_RE`, clauses C/D); `.claude/rules/components.md` (`AskUserQuestion` pairing); `.claude/plan/ARCHIVE.md` "Residual risk carried forward from the bulk-closes"; grounding `code.claude.com/docs/en/hooks` (`additionalContext` capped at 10,000 characters).
- **MCP to use:** none
- **discipline:** on
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, `node /home/hatch/coder/ccf/node_modules/typescript/bin/tsc --noEmit`, `claude plugin validate plugins/ccf`, smoke `echo '{"source":"startup","cwd":"."}' | node plugins/ccf/hooks/session-start.mjs` on this repo (the seeded rows appear).

## Goal (one sentence)
`accepted` is a closed status meaning "owner accepts closing despite residual risk", residual risks and human-waiting actions live in one `.claude/plan/PENDING.md` table that survives archiving, and every session start reminds of its open rows.

## Decisions (approved)
- `PENDING.md` table: `| ID | Kind | Task | What | Who | Closing evidence | Status |`, `Kind` = `risk` | `action`, `Status` = `open` | `closed`.
- A task may become `accepted` only when at least one `risk` row points to it and the user confirms through `AskUserQuestion`.
- `session-start` reminds the `open` rows on every `startup|clear|compact`: at most 5 rows, then "and N more in .claude/plan/PENDING.md"; total under 10,000 characters.

## Acceptance criteria (verifiable)
- [ ] `isClosedStatus("accepted")` is true (also `Accepted`, `**accepted**` via the existing emphasis strip); `accept` and `accepted-ish` are not closed.
- [ ] New `findOpenPendingItems(file)` in `plan.mjs` reuses `collectTaskRows`-style header-driven column lookup (Status column found by header, not position); missing/unreadable file → `[]`; skips fenced blocks.
- [ ] Stop clause C does not name an `accepted` task; `archive-plan.mjs` / `lib/archive.mjs` retire an iteration whose rows are all `done`/`accepted`.
- [ ] `session-start.mjs` adds the open PENDING rows (max 5 + count of the rest, < 10,000 chars) on every source; without `PENDING.md` its output is identical to today's; a malformed `PENDING.md` never crashes it.
- [ ] `PENDING.md.tmpl` (new) and `PLAN.md.tmpl` legend lists `accepted`; `/ccf:init` instantiates `PENDING.md`.
- [ ] `updatespec.md` step 6: when `accepted` may be written (at least one `risk` row + `AskUserQuestion` confirmation), writes the `risk` row, closes an `action` row when its closing evidence exists. `updatespec.md` keeps `AskUserQuestion` in `allowed-tools`.
- [ ] `init.md`'s "max depth 5" becomes "at most four hops" (grounded in code.claude.com/docs/en/memory).
- [ ] `.claude/plan/PENDING.md` (new) seeds the UN-OBSERVED items from ARCHIVE.md's "Residual risk carried forward" section as `risk` rows, plus `action` rows for the unrun paid evals (task 079's eval run; eval case 09 from task 081).

## Test first (write before implementing; confirm RED)
- `plan.test.mjs`: `isClosedStatus` matrix (`accepted`, `Accepted`, `**accepted**`, `accept`, `accepted-ish`); `findOpenPendingItems`: missing file, empty table, Status column not last, only `closed`, 0/1/5/6 `open` rows, a row inside a fenced block.
- `archive.test.mjs`: legend + an all-`accepted` iteration is retirable.
- `io.test.mjs`: run the real hook as a child process against a sample `PENDING.md` (0 rows / 6 rows / malformed) and with no `PENDING.md` (unchanged output).

## Files to touch
- `plugins/ccf/hooks/lib/plan.mjs`
- `plugins/ccf/hooks/lib/plan.test.mjs`
- `plugins/ccf/hooks/lib/archive.test.mjs`
- `plugins/ccf/hooks/session-start.mjs`
- `plugins/ccf/hooks/lib/io.test.mjs`
- `plugins/ccf/templates/root/.claude/plan/PENDING.md.tmpl` (new)
- `plugins/ccf/templates/root/.claude/plan/PLAN.md.tmpl`
- `plugins/ccf/commands/init.md`
- `plugins/ccf/commands/updatespec.md`
- `.claude/plan/PENDING.md` (new)

## Known risk
Adding `accepted` to `CLOSED_STATUS_RE` changes `findNonDoneTasks` and clause D; old tests relying on the closed set must go green again.

## Steps
1. Write the failing tests. 2. Implement minimally. 3. Run the gate; GREEN → `in-review`. 4. `/ccf:check` → `/ccf:updatespec`.
