# Task 010 — `in-review` status across prompt flow + reload

- **Vertical slice:** hook lib (plan.mjs rename + reload) + agents/commands (status lifecycle) + templates + repo PLAN.md legend
- **Depends on:** — (queue head of this iteration)
- **Spec refs:** `architecture.md` ("rename ⇒ update every reference"); `coding-conventions.md` (meaningful names, JSDoc); `hooks.md` (session-start reloads the in-progress task); `ccf-check.md:8` (read-only — must NOT write status); memory [[plan-status-sync-on-commit]]
- **Implemented by:** ccf-implementer + MCP none
- **Gate (must be GREEN before the next slice):** `node --test "plugins/ccf/hooks/lib/plan.test.mjs"` green; `tsc --noEmit` exit 0; grep-based prompt-consistency check (below) passes; `session-start.mjs` smoke reloads an `in-review` task

## Goal (one sentence)
Introduce an `in-review` task status so a task is only marked `done` after `/ccf-check` + `/code-review` pass (set exclusively by `/ccf:ccf-updatespec`), and teach the reload path (`plan.mjs` → session-start) to treat `in-review` as an active, reloadable task.

## Acceptance criteria (verifiable)
- [ ] `plan.mjs`: `findInProgressTask` RENAMED to `findActiveTask`; its status regex matches BOTH `in-progress` and `in-review` (whole-cell, positional); `done`/`todo`/`blocked` still excluded. JSDoc updated.
- [ ] Rename blast-radius updated — NO dangling `findInProgressTask` anywhere: `session-start.mjs` (import + use), `context-nudge.mjs` (import + use), `plan.test.mjs` (import + tests), `.claude/rules/coding-conventions.md:11` (the meaningful-names example).
- [ ] `session-start.mjs` reload message no longer says "mid-way through" for what may be an `in-review` task (reworded, e.g. "You have task {id} in progress/in-review: {title}").
- [ ] `ccf-implementer.md`: final step marks `in-review` (NOT `done`); explicitly states `done` is set only by `/ccf:ccf-updatespec` after review passes.
- [ ] `ccf-plan.md`: documents the lifecycle `todo → in-progress → in-review → done`; "Keep status up to date" wording includes `in-review`.
- [ ] `ccf-updatespec.md` step 6 (Sync the plan): the SOLE place that writes `in-review → done` after a clean review.
- [ ] `ccf-check.md` closing: only RECOMMENDS marking done — does NOT write it (read-only contract preserved).
- [ ] `ccf-fix.md` NOT touched (it does not write task status) — verified, not forgotten.
- [ ] Templates: `PLAN.md.tmpl:18` legend + `:6` session-start sentence updated to include `in-review`; `task-template.md.tmpl` Steps note that `done` follows review.
- [ ] Repo dogfood: `.claude/plan/PLAN.md:6` + `:20` legend updated to include `in-review`.
- [ ] `.claude/rules/hooks.md`: session-start reload wording "in-progress" → "in-progress/in-review"; `findInProgressTask` → `findActiveTask` if mentioned.

## Test first (write before implementing)
- Extend `plan.test.mjs` RED first: `findActiveTask` returns the task when its status cell is `in-review` (not only `in-progress`); still returns null for `done`/`todo`/`blocked`; keep the existing positional negative test (title contains "in-progress" but status is `done` → no match) green. Update the import name.
- Then rename + widen the regex to green.

## Files to touch
- `plugins/ccf/hooks/lib/plan.mjs` — rename + regex widen + JSDoc.
- `plugins/ccf/hooks/lib/plan.test.mjs` — import rename + `in-review` cases.
- `plugins/ccf/hooks/session-start.mjs` + `context-nudge.mjs` — import rename + use; reword the session-start message.
- `plugins/ccf/agents/ccf-implementer.md`, `commands/ccf-plan.md`, `commands/ccf-updatespec.md`, `commands/ccf-check.md` — lifecycle wording + done-writer routing.
- `plugins/ccf/templates/root/.claude/plan/PLAN.md.tmpl` (:6, :18) + `task-template.md.tmpl`.
- `.claude/plan/PLAN.md` (:6, :20) + `.claude/rules/coding-conventions.md:11` + `.claude/rules/hooks.md`.

## Steps (thin end-to-end slice)
1. Write the failing `plan.test.mjs` cases (rename + `in-review`).
2. Rename `findInProgressTask` → `findActiveTask` + widen regex; update both runtime callers + the message.
3. Update the prompt lifecycle (implementer/ccf-plan/ccf-updatespec/ccf-check) + templates + repo PLAN.md legend + coding-conventions.md:11 + hooks.md.
4. Run `node --test` + `tsc`; grep all touched artifacts to confirm: lifecycle string consistent, no dangling `findInProgressTask`, no artifact still says only `in-progress → done`, ccf-check does not write done.
5. Smoke `session-start.mjs` with an `in-review` task → it reloads.
6. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
Reuse `parseTableRow` (plan.mjs internal). Keep the rename atomic (architecture.md invariant). The done-writer must be ccf-updatespec (has Write/Edit); ccf-check is read-only.
