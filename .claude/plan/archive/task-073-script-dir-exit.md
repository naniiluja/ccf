# Task 073 — prune-archive exit code + relative `--dir` in both plan scripts

- **Vertical slice:** two human-run scripts (`scripts/prune-archive.mjs`, `scripts/archive-plan.mjs`) + process-level tests + `tooling.md` exit-contract sync
- **Depends on:** 070
- **Spec refs:** `.claude/rules/architecture.md` (Script); `.claude/rules/tooling.md` (prune-archive entry); `.claude/rules/testing.md`; task 070 (exit 1 on a real failure).
- **MCP to use:** none
- **Gate:** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, `npx -p typescript tsc --noEmit` (or `node node_modules/typescript/bin/tsc --noEmit`), and the smoke below. **discipline: on**, so the matrix below must be present AND actually run.

## Goal (one sentence)
A relative `--dir` stages the same git result as an absolute one in both scripts, and `prune-archive --apply` exits 1 when it skipped any file.

## Design
- Both scripts: `projectDir = resolve(<--dir> ?? $CLAUDE_PROJECT_DIR ?? cwd)`. Before, a relative value was joined into the git path argument AND used as `cwd`, so git applied it twice: `git rm` failed on every file, and `git mv` failed into the silent `renameSync` fallback (moved, not staged).
- `prune-archive --apply`: process every file as before, then exit `removed === prune.length ? 0 : 1`. Preview and "nothing to do" stay 0; a bad `--keep` stays 1.
- `archive-plan.mjs`'s exit code is unchanged (outside the request).

## Acceptance criteria (verifiable)
- [ ] Relative `--dir` gives the same staged result as an absolute one, in both scripts.
- [ ] `prune-archive --apply` exits 1 when at least one file was skipped, still removing and reporting the others; 0 when all were removed or nothing to do.
- [ ] The header comment and `tooling.md` state the new exit contract; the ccf-budget test is green.

## Test first (write before implementing; confirm RED)
- `plugins/ccf/hooks/lib/prune-archive-script.test.mjs`: flip the skip case to exit 1, add the cases below.
- `plugins/ccf/hooks/lib/archive-plan-script.test.mjs` (new).
- **Matrix (contract level):**
  - EP, `--dir` source: {absolute, relative (cwd = parent), `CLAUDE_PROJECT_DIR`, no flag + cwd = repo} → `D` staged (prune) / `R` staged (archive-plan), no commit.
  - Decision table, prune `--apply` exit: skipped {0, ≥1} × removed {0, ≥1} → 0 only when skipped = 0 (all clean 0; mixed 1; all refused 1; `--no-git` rmSync error 1).
  - BVA: nothing to prune → 0; preview with refusable files → 0; `--keep 0` → 1.

## Files to touch
- `plugins/ccf/scripts/prune-archive.mjs`
- `plugins/ccf/scripts/archive-plan.mjs`
- `plugins/ccf/hooks/lib/prune-archive-script.test.mjs`
- `plugins/ccf/hooks/lib/archive-plan-script.test.mjs` — new
- `.claude/rules/tooling.md`
- `.claude/rules/prompt-standard.md` — only the `ccf-budget` label, if the paid total moves

## Results
- RED confirmed before the fix: 7 failing (relative `--dir` and relative `CLAUDE_PROJECT_DIR` in both scripts; flipped skip case; all-refused; `--no-git` rmSync error). The archive-plan relative case showed `git diff --cached` empty while the file had moved: the silent unstaged-rename path.
- GREEN after `resolve()` + `removed === prune.length ? 0 : 1`: `node --test plugins/ccf/hooks/lib/*.test.mjs` 362/362; `node --test .claude/tests/*.test.mjs` 15 pass, 1 skip by design; `node node_modules/typescript/bin/tsc --noEmit` exit 0 (`npx` absent on this host).
- ccf-budget: paid total 104931 → 104959 (+28, the `tooling.md` clause); label updated.
- Smoke on this repo: `--dir .`, absolute `--dir`, and `--dir ..` from `plugins/` all preview 25 to prune, 9 orphans; `git status --porcelain` unchanged.
- Follow-up, not done: clause E prints the command without `--dir`, so it assumes the project root as cwd.
