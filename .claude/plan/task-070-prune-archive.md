# Task 070 — prune-archive script + Stop clause E

- **Vertical slice:** pure lib (`lib/archive.mjs`) + human-run script (`scripts/prune-archive.mjs`) + Stop hook clause E (`updatespec-nudge.mjs`) + tests
- **Depends on:** —
- **Spec refs:** `.claude/rules/architecture.md` (Script: a mutation belongs in a script, detection in a hook); `.claude/rules/hooks.md` (`updatespec-nudge` clause D precedent, `lib/archive.mjs` positional grouping, no-dependency, Windows-clean, `spawnSync` with `shell:false`); `.claude/rules/testing.md`; approved plan `lifecycle-cleanup` (decisions 1, 2, 7).
- **MCP to use:** none
- **Gate (must be GREEN before task 072):** unit + script integration on real temp git repos. `node --test plugins/ccf/hooks/lib/*.test.mjs` green, `npx -p typescript tsc --noEmit` exit 0 (or `node node_modules/typescript/bin/tsc --noEmit`), and the preview smoke run on this repo below. **discipline: on**, so the contract-level EP/BVA/decision-table matrix below must be present AND actually run.

## Goal (one sentence)
Old archived task files can be pruned safely: a script previews and, on `--apply`, stages `git rm` of every task file belonging to an iteration older than the newest N (default 10) in `ARCHIVE.md`, and the Stop hook nudges with the exact command when there is something to prune.

## Design
- `planTaskFilePrune(archiveLines, fileNames, keep)` (pure, in `lib/archive.mjs`) → `{ keepIds: string[], prune: string[], orphans: string[] }`. Iterations come from `parseIterations` (POSITIONAL, from one `## Origin` to the next; ARCHIVE.md is newest first). Ids come from each iteration's real task rows (reuse `isRealTaskRow`/`collectTaskRows`, never a new regex). A file is `task-<id>-*.md`; a file whose id belongs to one of the first `keep` iterations is kept; one whose id belongs to an older iteration is pruned; one whose id belongs to NO iteration is an orphan (kept, reported). Non-task files are ignored. An id that appears in both a kept and an older iteration is kept (fail-safe).
- `findPrunableTaskFilesIn(planDir, keep)`: defensive reader (missing `ARCHIVE.md` or `archive/` → empty result, never throws), shared by the script and clause E so detector and mutator cannot disagree (same reason as `findRetirableIterationsIn`).
- `scripts/prune-archive.mjs`: same CLI shape as `archive-plan.mjs` (`readFlagValue`, `--dir` default `$CLAUDE_PROJECT_DIR` or cwd, `--apply`, `--no-git`), plus `--keep N` (default 10; a non-integer or a value below 1 → exit 1 with a message). Preview (default) writes nothing and lists prune + orphans. `--apply`: `git rm -q -- <path>` per file (`spawnSync`, `shell:false`), staged, never committed. A file git refuses (untracked, locally modified) is skipped and reported, never force-removed. `--no-git` uses `fs.rmSync`. Exit 0 on success or nothing to do, exit 1 on a real failure.
- Clause E in `updatespec-nudge.mjs`: independent of A-D; when `findPrunableTaskFilesIn(cwd/.claude/plan, 10).prune.length > 0`, push `{ directive, userNote }` naming the count and `node "<abs path from import.meta.url>/scripts/prune-archive.mjs"` (preview first, then `--apply`).

## Acceptance criteria (verifiable)
- [ ] `planTaskFilePrune` returns the documented shape; orphans and ids shared with a kept iteration are never in `prune`.
- [ ] Preview on this repo lists exactly 25 files to prune and 9 orphans (task-001 to task-009), and `git status --porcelain` is identical before and after.
- [ ] `--apply` in a temp git repo stages the deletions (`git diff --cached --name-status` shows `D`) and creates no commit (`git rev-list --count HEAD` unchanged).
- [ ] An untracked or modified file under `archive/` is skipped and reported, not deleted.
- [ ] `--keep 0` and `--keep abc` exit 1 with a message; a missing `archive/` dir exits 0 with "nothing to do".
- [ ] Clause E prints the absolute command when there is something to prune and stays silent otherwise; it does not affect clauses A-D.

## Test first (write before implementing; confirm RED)
- `plugins/ccf/hooks/lib/archive.test.mjs`: new cases for `planTaskFilePrune` and `findPrunableTaskFilesIn`.
- `plugins/ccf/hooks/lib/prune-archive-script.test.mjs` (new): real temp repo (`mkdtempSync` + `git init -q -b main` + commit), pattern from `worktree-preflight-script.test.mjs`.
- `plugins/ccf/hooks/lib/io.test.mjs`: one clause-E child-process case (tmp dir, NOT the live repo).
- **Matrix (contract level):**
  - EP: file name ∈ {mapped to kept iteration, mapped to old iteration, orphan, non-task file, suffixed id like `034a`}; mode ∈ {preview, apply git, apply `--no-git`}; file state ∈ {tracked clean, untracked, modified}.
  - BVA: iteration count ∈ {0, 9, 10, 11} with keep 10; keep ∈ {0 (rejected), 1, 10}; an iteration with zero task rows; empty `archive/` dir.
  - Decision table (clause E): prunable files {yes, no} × `stop_hook_active` {true, false} → nudge only on (yes, false).

## Files to touch
- `plugins/ccf/hooks/lib/archive.mjs` — `planTaskFilePrune`, `findPrunableTaskFilesIn`
- `plugins/ccf/hooks/lib/archive.test.mjs` — new cases
- `plugins/ccf/scripts/prune-archive.mjs` — new script
- `plugins/ccf/hooks/lib/prune-archive-script.test.mjs` — new
- `plugins/ccf/hooks/updatespec-nudge.mjs` — clause E
- `plugins/ccf/hooks/lib/io.test.mjs` — clause E case

## Steps (thin end-to-end slice)
1. Write the failing tests (matrix above) and confirm RED.
2. Implement the pure functions, then the script, then clause E.
3. Run the gate commands and the preview smoke run; record the actual numbers below, then mark the task `in-review` (NOT `done`).
4. `/ccf:check` → `/ccf:updatespec`; only that writes `done`.

## Notes / best-practice sources
- Preview-first with explicit apply (agent-harness / anamnesis prune semantics); cleanup applies only to terminal items (omniharness): only CLOSED, archived iterations are touched.
- Spec docs/count sync is task 072's job (shared-spec hotspot), not this task's.

## Results
(fill in during implementation)
