# Task 085 — eval-changelog script + CHANGELOG.md + version latch

- **Vertical slice:** pure lib + human-run script + root `CHANGELOG.md` + repo-scope latch
- **Depends on:** —
- **Spec refs:** `.claude/rules/architecture.md` (scripts: human-run, file-mutating actions only with `--apply`, never commit); `.claude/rules/tooling.md` (`claude plugin eval`, `evals/results/`); `.claude/rules/testing.md` (repo-scope suite; latch seen RED); `.claude/rules/git-workflow.md` (version in 3 places).
- **MCP to use:** none
- **discipline:** on
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"`, `node /home/hatch/coder/ccf/node_modules/typescript/bin/tsc --noEmit`, smoke `node plugins/ccf/scripts/eval-changelog.mjs --dir .` (preview against the existing `plugins/ccf/evals/results/`).

## Goal (one sentence)
Every released version has a `CHANGELOG.md` entry carrying either the eval score table or an explicit `eval: not run: <reason>`, written by a preview-then-`--apply` script and enforced by a repo latch.

## Acceptance criteria (verifiable)
- [ ] `plugins/ccf/hooks/lib/eval-changelog.mjs` (pure): `summarizeAggregate(json)` → rows `case | pass x/3 | mean score | cost`; `renderChangelogSection(version, rows | notRun)`; `hasVersionEntry(changelogText, version)`. Wrong-shape JSON throws a clear error (no silent default).
- [ ] `plugins/ccf/scripts/eval-changelog.mjs`: `--dir`, `--results <path>` (default: newest dir under `plugins/ccf/evals/results/` with `aggregate-result.json`), `--not-run "<reason>"`, `--apply`; preview by default; JSON out; exit 0 except a failed `--apply` write; never commits.
- [ ] `CHANGELOG.md` at repo root (not `@import`ed) with `## 0.14.0`: the score table from the newest `evals/results/` run if it covers the 8 current cases, else `eval: not run: <reason>`.
- [ ] `.claude/tests/changelog.test.mjs`: the `package.json` version must have an entry with a score table or an `eval: not run:` line; seen RED when `package.json`'s version is changed to one without an entry (record how in the report).
- [ ] `tsconfig.json` `include` already covers the new files (no edit needed unless the glob misses them).

## Test first (write before implementing; confirm RED)
- `summarizeAggregate` matrix: 8 cases with 3 runs each, a case with missing runs, empty `arms.with`, wrong-shape JSON (throws), score bounds 0 and 1.
- `hasVersionEntry`: has table, has `not run`, heading with empty body (false), different version.
- Inspect the real `aggregate-result.json` shape under `plugins/ccf/evals/results/` before writing fixtures.

## Files to touch
- `plugins/ccf/hooks/lib/eval-changelog.mjs` (new)
- `plugins/ccf/hooks/lib/eval-changelog.test.mjs` (new)
- `plugins/ccf/scripts/eval-changelog.mjs` (new)
- `CHANGELOG.md` (new)
- `.claude/tests/changelog.test.mjs` (new)
- `tsconfig.json`

## Steps
1. Write the failing tests. 2. Implement minimally. 3. Run the gate; GREEN → `in-review`. 4. `/ccf:check` → `/ccf:updatespec`.
