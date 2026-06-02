# Task 016 — Propagate memory-protocol wording to template + 3 READMEs

- **Vertical slice:** doc-mirror sync — template `tooling.md.tmpl` + `README.md` + `README.vi.md` + `README.zh-CN.md` (no behavior change).
- **Depends on:** 015 (its ONLY predecessor — pure mechanical mirror of the wording 015 finalized).
- **Spec refs:** `git-workflow.md` ("syncing on plugin structure changes"; "README is the user doc — divergence = drift to fix"); `components.md` (template obeys the same conventions). Memory: [[sync-hook-docs-both-places]].
- **Implemented by:** ccf-implementer, then `/ccf:ccf-check` + `/code-review`.
- **Gate (must be GREEN) — grep is PRIMARY:** Grep **language-neutral tokens** (`200`, `25KB`, `feedback`) — NOT an English phrase, so vi/zh don't fail an English-only grep — confirming the index-cap fact + a `feedback`-strongest mention appear in all 4 mirror files AND `ccf-updatespec.md`, and no file still implies MEMORY.md is unbounded; `claude plugin validate plugins/ccf` exit 0; re-read confirms the 3 README sections are consistent across languages with no count drift.

## Goal (one sentence)
Mirror task 015's two headline facts — MEMORY.md is a 200-line/25KB-capped pure index, and `feedback`(+`Why`) is the strongest tier — into the init template and all 3 READMEs so the user-facing docs don't drift from the lõi instruction.

## Acceptance criteria (verifiable)
- [ ] `templates/root/.claude/rules/tooling.md.tmpl` "System memory vs Spec" block (lines 26-28): +1-2 lines (it's a catalog, not the full protocol) stating MEMORY.md is a 200-line/25KB-capped pure index and `feedback`(with its `Why`) is the strongest type.
- [ ] `README.md` "Spec vs Memory" (lines 97-104): +1 line — MEMORY.md is a pure index capped at 200 lines/25KB; `feedback`+`Why` is the strongest tier.
- [ ] `README.vi.md` + `README.zh-CN.md`: the SAME addition, translated, at the matching localized section (each must contain a greppable language-neutral token: `200` / `25KB` / `feedback`).
- [ ] No count drift introduced (still 6 cmd / 6 agent / 5 hook / 1 skill anywhere counts appear); no behavior change.

## Test first (write before implementing)
- N/A (docs slice). The "failing test" is the cross-doc grep stated FIRST: before editing, the 4 mirror files have NO "200/25KB index cap" mention; after editing, the language-neutral grep finds it in all 4 + `ccf-updatespec.md`. Verify both states.

## Files to touch
- `plugins/ccf/templates/root/.claude/rules/tooling.md.tmpl`
- `README.md`, `README.vi.md`, `README.zh-CN.md`

## Steps (thin end-to-end slice)
1. Add the index-cap + feedback-strongest line to the template block (keep it catalog-brief).
2. Add the matching line to `README.md`, then translate the same into `README.vi.md` + `README.zh-CN.md` at the parallel section.
3. Run the language-neutral cross-doc grep + `claude plugin validate plugins/ccf` + re-read all 3 README sections for cross-language consistency.
4. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
A spec change that leaves 2 of 3 READMEs stale IS drift (git-workflow.md). The lõi `ccf-updatespec.md` (task 015) is the source of truth; this task only keeps the doc mirrors honest. Grep on language-neutral tokens avoids a false-fail on the translated files.
