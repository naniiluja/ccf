# Task 092 — `plan-lint.mjs`: hotspot collision, criteria, files, depends

- **Vertical slice:** pure lib `plan-lint.mjs` + `scripts/plan-lint.mjs` + `plan` skill step + latch
- **Depends on:** —
- **Spec refs:** `.claude/rules/tooling.md` (script pattern, `scope-diff.mjs` as the model); `.claude/rules/architecture.md` (scripts are human-run, read-only here); `plan` skill step 4 (shared-spec files are a hotspot).
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, `npx -p typescript tsc --noEmit`
- **Touches UI:** no
- **Runtime evidence:** not run: offline script; the git-free cases run against temporary plan directories in the tests

## Goal (one sentence)
Before `/ccf:cook` runs, code tells the planner which open tasks would be forced into separate waves by a shared hotspot file, and which task files lack verifiable criteria, concrete files or real predecessors.

## Acceptance criteria (verifiable)
- [ ] `plan-lint.mjs [--dir] [--tasks a,b]` prints JSON `{ ok, findings, waves, ... }`, always exits 0, writes nothing, and reuses `slice-check.mjs` (`extractFiles`, `extractDependsOn`, `certainEdge`, `hotspotClasses`) and `plan.mjs` for reading tasks.
- [ ] Each finding has a `kind`: `hotspot-collision` (two open tasks on one hotspot class, naming both ids, the class and the files; the advice is one final sync task), `no-files` (no `Files to touch`), `no-criteria` (no `## Acceptance criteria` bullets), `unknown-dependency` (a `Depends on` id that is no task in `PLAN.md`), `dependency-cycle`.
- [ ] The output reports the wave count `plan-waves` would compute and, when it equals the number of tasks while there are 3 or more, says the hotspot or declared edges that cause it.
- [ ] The `plan` skill runs it before step 7 and fixes `hotspot-collision` by moving the shared-spec edits into one final task that `Depends on` the others; the skill latch pins that step.

## Test first (write before implementing)
`plugins/ccf/hooks/lib/plan-lint.test.mjs` (every finding kind, a clean plan, garbage input), `plan-lint-script.test.mjs` (temporary plan dir, always exit 0), and a `skill-plan.test.mjs` assertion; all seen RED first.

## Files to touch
- `plugins/ccf/hooks/lib/plan-lint.mjs`
- `plugins/ccf/hooks/lib/plan-lint.test.mjs`
- `plugins/ccf/hooks/lib/plan-lint-script.test.mjs`
- `plugins/ccf/scripts/plan-lint.mjs`
- `plugins/ccf/skills/plan/SKILL.md`
- `.claude/tests/skill-plan.test.mjs`

## Steps (thin end-to-end slice)
1. Write the failing tests
2. Implement the lib, then the script, then the skill step
3. Run the gate, mark the task `in-review` (NOT `done`)

## Notes / best-practice sources
Ideas: paper EPIC (spec quality is measurable) and superpowers (a plan a junior could follow). Root cause of sequential waves: see `PLAN.md` Origin.
