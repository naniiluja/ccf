# Task 011 — Stop-hook clause 3: nudge "committed-but-not-done"

- **Vertical slice:** hook (`updatespec-nudge.mjs` clause C) + 2 libs (`plan.mjs` parser, new `git-trace.mjs`) + tests + doc sync
- **Depends on:** 010 (clause C treats `in-review` as not-done; needs the status to exist)
- **Spec refs:** `hooks.md` (Stop hook advisory, multi-clause compose, `stop_hook_active` guard, no new hooks.json entry); `coding-conventions.md` (pure helper + JSDoc, SRP); `testing.md` (`node --test`); memory [[heuristic-copy-drift-smoke-reveals]] (role-gate the scan), [[sync-hook-docs-both-places]]
- **Implemented by:** ccf-implementer + MCP none
- **Gate (must be GREEN before the next slice):** `node --test` for `findNonDoneTasks` + `committedThisSession` green; `tsc --noEmit` exit 0; 4-case stdin smoke on `updatespec-nudge.mjs`; `claude plugin validate plugins/ccf` green; hooks.md + README (en/vi/zh) describe the 3rd clause

## Goal (one sentence)
Add a third advisory clause to the existing Stop hook `updatespec-nudge.mjs` that nudges when THIS session ran `git commit` but `PLAN.md` still has tasks not `done`, so a push never silently leaves a task unmarked.

## Acceptance criteria (verifiable)
- [ ] `plan.mjs`: pure `findNonDoneTasks(file)` reusing `parseTableRow` → `[{id,title,status}]` for every row whose status != `done` (todo/in-progress/in-review/blocked); `[]` on missing/unreadable file; skips header/separator; never throws.
- [ ] NEW `plugins/ccf/hooks/lib/git-trace.mjs`: pure `committedThisSession(transcriptPath)` — role-gated scan (assistant `tool_use` only) of shell tools (`bash`/`shell`/`powershell`/`pwsh`, set COPIED locally — not imported) for a command matching `/\bgit\s+commit\b/`; best-effort, never throws; `false` on missing/empty/corrupt transcript. JSDoc present.
- [ ] `updatespec-nudge.mjs`: clause (C) composed into the existing `parts[]` — when `committedThisSession(transcriptPath)` AND `findNonDoneTasks(planPath).length > 0`, push a `<ccf>…</ccf>` message naming the count + ids. Keeps the `stop_hook_active` + `existsSync(rulesDir)` gates. PLAN path = `join(cwd, ".claude", "plan", "PLAN.md")`. No `hooks.json` change.
- [ ] `tsc` covers both libs (matched by `hooks/**/*.mjs` include; `*.test.mjs` excluded).
- [ ] Docs synced (both places): `.claude/rules/hooks.md` + `README.md`/`README.vi.md`/`README.zh-CN.md` describe `updatespec-nudge` as a 3-clause Stop nudge (A verify-work, B updatespec, C plan-status-sync).

## Test first (write before implementing)
- `plan.test.mjs` RED first: `findNonDoneTasks` returns all non-done rows, `[]` when all done, `[]` on missing file, ignores header/separator.
- NEW `git-trace.test.mjs` RED first: `committedThisSession` → true for `git commit` / `git commit -m` / `git commit --amend` in an assistant shell `tool_use`; false for the same string in user prose (role-gate); false on missing/empty/corrupt transcript.

## Files to touch
- `plugins/ccf/hooks/lib/plan.mjs` (+ `plan.test.mjs`) — `findNonDoneTasks`.
- `plugins/ccf/hooks/lib/git-trace.mjs` (+ `git-trace.test.mjs`) — NEW.
- `plugins/ccf/hooks/updatespec-nudge.mjs` — clause C.
- `.claude/rules/hooks.md` + `README.md` + `README.vi.md` + `README.zh-CN.md` — 3-clause description.

## Steps (thin end-to-end slice)
1. Write `plan.test.mjs` (findNonDoneTasks) + `git-trace.test.mjs` RED.
2. Implement `findNonDoneTasks` (plan.mjs) + `committedThisSession` (git-trace.mjs, role-gated, SHELL set copied) → green.
3. Compose clause C into `updatespec-nudge.mjs` `parts[]`.
4. `tsc`; 4-case stdin smoke (Windows path, not /tmp): committed+in-review→nudge; committed+all-done→none; not-committed→none; stop_hook_active→silent.
5. Sync hooks.md + 3 READMEs to the 3-clause description; `claude plugin validate`.
6. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
Reuse the `verify-trace.mjs` role-gated scan pattern (assistant tool_use only) — the [[heuristic-copy-drift-smoke-reveals]] lesson: scanning user prose would false-positive. `committedThisSession` lives in its own `git-trace.mjs` (SRP: plan.mjs only parses PLAN.md). Compose into the existing Stop hook — no new hooks.json entry ([[sync-hook-docs-both-places]] for the doc sync).
